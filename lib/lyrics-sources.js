const axios = require('axios');

async function fetchLrclib(artist, title) {
  try {
    // Endpoint "get" = correspondance précise.
    const res = await axios.get('https://lrclib.net/api/get', {
      params: { artist_name: artist, track_name: title },
      timeout: 6000,
    });
    const lyrics = (res.data.plainLyrics || '').trim();
    if (lyrics) return lyrics;
  } catch (err) {
    // pas de correspondance exacte, on tente la recherche floue ci-dessous
  }

  try {
    const res = await axios.get('https://lrclib.net/api/search', {
      params: { artist_name: artist, track_name: title },
      timeout: 6000,
    });
    const match = (res.data || []).find((r) => r.plainLyrics);
    if (match) return match.plainLyrics.trim();
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

// Essaie les sources dans l'ordre jusqu'à en trouver une qui a les paroles.
async function fetchLyrics(artist, title) {
  const lrclib = await fetchLrclib(artist, title);
  if (lrclib) return { lyrics: lrclib, source: 'lrclib' };

  const ovh = await fetchLyricsOvh(artist, title);
  if (ovh) return { lyrics: ovh, source: 'lyricsovh' };

  const textyl = await fetchTextyl(artist, title);
  if (textyl) return { lyrics: textyl, source: 'textyl' };

  const lyrist = await fetchLyrist(artist, title);
  if (lyrist) return { lyrics: lyrist, source: 'lyrist' };

  const chartlyrics = await fetchChartLyrics(artist, title);
  if (chartlyrics) return { lyrics: chartlyrics, source: 'chartlyrics' };

  return null;
}

// Ni LRCLIB ni lyrics.ovh n'ont de recherche floue robuste : on tente
// quelques découpages plausibles de "artiste titre".
async function guessLyrics(query) {
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
    const result = await fetchLyrics(artist, title);
    if (result) {
      return { artist, title, ...result };
    }
  }
  return null;
}

module.exports = { fetchLyrics, guessLyrics };
