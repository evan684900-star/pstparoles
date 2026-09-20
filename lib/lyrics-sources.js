const axios = require('axios');

// LRCLIB fournit aussi une version horodatée (syncedLyrics, format LRC) :
// c'est elle qui permet le surlignage ligne par ligne synchronisé avec
// la lecture Spotify.
async function fetchLrclib(artist, title) {
  try {
    // Endpoint "get" = correspondance précise.
    const res = await axios.get('https://lrclib.net/api/get', {
      params: { artist_name: artist, track_name: title },
      timeout: 6000,
    });
    const lyrics = (res.data.plainLyrics || '').trim();
    const synced = (res.data.syncedLyrics || '').trim();
    if (lyrics) return { lyrics, synced: synced || null };
  } catch (err) {
    // pas de correspondance exacte, on tente la recherche floue ci-dessous
  }

  try {
    const res = await axios.get('https://lrclib.net/api/search', {
      params: { artist_name: artist, track_name: title },
      timeout: 6000,
    });
    const rows = res.data || [];
    // On privilégie une correspondance qui a la version horodatée.
    const match = rows.find((r) => r.plainLyrics && r.syncedLyrics) || rows.find((r) => r.plainLyrics);
    if (match) {
      return {
        lyrics: match.plainLyrics.trim(),
        synced: (match.syncedLyrics || '').trim() || null,
      };
    }
  } catch (err) {
    // rien trouvé
  }

  return null;
}

async function fetchLyricsOvh(artist, title) {
  try {
    const res = await axios.get(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      { timeout: 6000 }
    );
    const lyrics = (res.data.lyrics || '').trim();
    return lyrics || null;
  } catch (err) {
    return null;
  }
}

async function fetchTextyl(artist, title) {
  try {
    const res = await axios.get('https://api.textyl.co/api/lyrics', {
      params: { q: `${artist} ${title}` },
      timeout: 6000,
    });
    const lines = res.data || [];
    const lyrics = lines
      .map((line) => line.lyrics)
      .filter(Boolean)
      .join('\n')
      .trim();
    return lyrics || null;
  } catch (err) {
    return null;
  }
}

async function fetchLyrist(artist, title) {
  try {
    const res = await axios.get(
      `https://lyrist.vercel.app/api/${encodeURIComponent(title)}/${encodeURIComponent(artist)}`,
      { timeout: 6000 }
    );
    const lyrics = (res.data.lyrics || '').trim();
    return lyrics || null;
  } catch (err) {
    return null;
  }
}

function decodeXmlEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function fetchChartLyrics(artist, title) {
  try {
    const res = await axios.get('http://api.chartlyrics.com/apiv1.asmx/SearchLyricDirect', {
      params: { artist, song: title },
      timeout: 6000,
      responseType: 'text',
    });
    const match = /<Lyric>([\s\S]*?)<\/Lyric>/i.exec(res.data);
    const lyrics = match ? decodeXmlEntities(match[1]).trim() : '';
    return lyrics || null;
  } catch (err) {
    return null;
  }
}

// Registre des sources, dans l'ordre de priorité par défaut.
const SOURCES = [
  { key: 'lrclib', fetch: fetchLrclib },
  { key: 'lyricsovh', fetch: fetchLyricsOvh },
  { key: 'textyl', fetch: fetchTextyl },
  { key: 'lyrist', fetch: fetchLyrist },
  { key: 'chartlyrics', fetch: fetchChartLyrics },
];
const ALL_SOURCE_KEYS = SOURCES.map((s) => s.key);

// Essaie les sources activées, dans l'ordre, jusqu'à en trouver une qui a les paroles.
// Une source renvoie soit une chaîne, soit { lyrics, synced } quand elle
// dispose aussi d'une version horodatée (seul LRCLIB pour l'instant).
async function fetchLyrics(artist, title, enabledKeys) {
  const enabled = enabledKeys && enabledKeys.length ? new Set(enabledKeys) : null;

  for (const { key, fetch } of SOURCES) {
    if (enabled && !enabled.has(key)) continue;
    const result = await fetch(artist, title);
    if (!result) continue;

    if (typeof result === 'string') return { lyrics: result, synced: null, source: key };
    return { lyrics: result.lyrics, synced: result.synced || null, source: key };
  }

  return null;
}

// Ni LRCLIB ni lyrics.ovh n'ont de recherche floue robuste : on tente
// quelques découpages plausibles de "artiste titre".
async function guessLyrics(query, enabledKeys) {
  const candidates = [];

  if (query.includes(' - ')) {
    const [artist, ...rest] = query.split(' - ');
    candidates.push({ artist: artist.trim(), title: rest.join(' - ').trim() });
  }

  const words = query.trim().split(/\s+/);
  if (words.length >= 2) {
    candidates.push({ artist: words[0], title: words.slice(1).join(' ') });
    candidates.push({ artist: words.slice(0, -1).join(' '), title: words[words.length - 1] });
  }

  for (const { artist, title } of candidates) {
    if (!artist || !title) continue;
    const result = await fetchLyrics(artist, title, enabledKeys);
    if (result) {
      return { artist, title, ...result };
    }
  }
  return null;
}

// Genius formate ses titres/artistes avec du "bruit" que les bases de
// paroles n'ont pas : "(Remastered 2011)", "- Live", "(feat. X)"... Alors
// qu'un titre venu de Spotify (via "Suivre Spotify") est déjà propre et
// trouve bien plus souvent une correspondance. On nettoie donc le texte
// avant une éventuelle deuxième tentative.
function cleanQueryText(text) {
  return (text || '')
    .replace(/\s*[([][^()[\]]*[)\]]/g, ' ') // (Remastered 2011), [Live], (feat. X)
    .replace(/\s[-–—]\s.*$/, ' ') // "- Remastered 2011", "- Live", "- Radio Edit"
    .replace(/\b(feat\.?|ft\.?|featuring|with)\b.*$/i, ' ') // "feat. X" sans parenthèses
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { fetchLyrics, guessLyrics, ALL_SOURCE_KEYS, cleanQueryText };
