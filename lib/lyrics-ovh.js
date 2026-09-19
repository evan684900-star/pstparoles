const axios = require('axios');

async function fetchLyricsOvh(artist, title) {
  try {
    const res = await axios.get(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    );
    const lyrics = (res.data.lyrics || '').trim();
    return lyrics || null;
  } catch (err) {
    return null;
  }
}

// lyrics.ovh n'a pas de recherche floue : on tente quelques découpages
// plausibles de "artiste titre" jusqu'à en trouver un qui matche.
async function guessLyricsOvh(query) {
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
    const lyrics = await fetchLyricsOvh(artist, title);
    if (lyrics) {
      return { artist, title, lyrics };
    }
  }
  return null;
}

module.exports = { fetchLyricsOvh, guessLyricsOvh };
