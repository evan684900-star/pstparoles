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

// Essaie les sources dans l'ordre jusqu'à en trouver une qui a les paroles.
async function fetchLyrics(artist, title) {
  const lrclib = await fetchLrclib(artist, title);
  if (lrclib) return { lyrics: lrclib, source: 'lrclib' };

  const ovh = await fetchLyricsOvh(artist, title);
  if (ovh) return { lyrics: ovh, source: 'lyricsovh' };

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
