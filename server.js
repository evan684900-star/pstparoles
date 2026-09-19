require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

app.use(express.static('public'));

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

app.get('/api/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Paramètre "q" requis.' });
  }

  let geniusHits = [];
  let geniusError = null;

  if (GENIUS_ACCESS_TOKEN) {
    try {
      const response = await axios.get('https://api.genius.com/search', {
        params: { q: query },
        headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
      });

      geniusHits = response.data.response.hits.map((hit) => {
        const song = hit.result;
        return {
          source: 'genius',
          id: song.id,
          title: song.title,
          artist: song.primary_artist.name,
          thumbnail: song.song_art_image_thumbnail_url,
          url: song.url,
        };
      });
    } catch (err) {
      console.error('Erreur recherche Genius:', err.message);
      geniusError = 'Impossible de contacter Genius pour la recherche.';
    }
  }

  if (geniusHits.length > 0) {
    return res.json({ results: geniusHits });
  }

  // Genius n'a rien trouvé (ou n'est pas disponible) : on tente lyrics.ovh en repli.
  const fallback = await guessLyricsOvh(query);
  if (fallback) {
    return res.json({
      results: [
        {
          source: 'lyricsovh',
          title: fallback.title,
          artist: fallback.artist,
          thumbnail: null,
          lyrics: fallback.lyrics,
        },
      ],
    });
  }

  if (geniusError && !GENIUS_ACCESS_TOKEN) {
    return res.status(404).json({ error: 'Aucun résultat trouvé sur lyrics.ovh, et Genius n\'est pas configuré.' });
  }
  if (geniusError) {
    return res.status(502).json({ error: geniusError });
  }
  return res.json({ results: [] });
});

app.get('/api/lyrics', async (req, res) => {
  const { url, artist, title } = req.query;

  if (url) {
    if (!url.startsWith('https://genius.com/')) {
      return res.status(400).json({ error: 'Paramètre "url" invalide.' });
    }

    try {
      const page = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; pstparoles/1.0)' },
      });

      const $ = cheerio.load(page.data);
      const containers = $('[data-lyrics-container="true"]');

      if (containers.length > 0) {
        containers.find('br').replaceWith('\n');
        const lyrics = containers
          .map((_, el) => $(el).text().trim())
          .get()
          .join('\n\n')
          .trim();
        return res.json({ lyrics, source: 'genius' });
      }
    } catch (err) {
      console.error('Erreur récupération paroles Genius:', err.message);
    }

    // Genius n'a pas les paroles (page instrumentale, scraping échoué...) : repli lyrics.ovh.
    if (artist && title) {
      const lyrics = await fetchLyricsOvh(artist, title);
      if (lyrics) {
        return res.json({ lyrics, source: 'lyricsovh' });
      }
    }

    return res.status(404).json({ error: 'Paroles introuvables sur Genius, et pas de repli disponible.' });
  }

  if (artist && title) {
    const lyrics = await fetchLyricsOvh(artist, title);
    if (lyrics) {
      return res.json({ lyrics, source: 'lyricsovh' });
    }
    return res.status(404).json({ error: 'Paroles introuvables sur lyrics.ovh.' });
  }

  return res.status(400).json({ error: 'Paramètre "url" ou "artist"+"title" requis.' });
});

app.listen(PORT, () => {
  console.log(`pstparoles démarré sur http://localhost:${PORT}`);
});
