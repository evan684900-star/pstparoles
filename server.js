require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

app.use(express.static('public'));

function requireToken(req, res, next) {
  if (!GENIUS_ACCESS_TOKEN) {
    return res.status(500).json({
      error: "GENIUS_ACCESS_TOKEN manquant. Ajoute-le dans un fichier .env (voir .env.example).",
    });
  }
  next();
}

app.get('/api/search', requireToken, async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Paramètre "q" requis.' });
  }

  try {
    const response = await axios.get('https://api.genius.com/search', {
      params: { q: query },
      headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
    });

    const hits = response.data.response.hits.map((hit) => {
      const song = hit.result;
      return {
        id: song.id,
        title: song.title,
        artist: song.primary_artist.name,
        thumbnail: song.song_art_image_thumbnail_url,
        url: song.url,
      };
    });

    res.json({ results: hits });
  } catch (err) {
    console.error('Erreur recherche Genius:', err.message);
    res.status(502).json({ error: 'Impossible de contacter Genius pour la recherche.' });
  }
});

app.get('/api/lyrics', requireToken, async (req, res) => {
  const songUrl = req.query.url;
  if (!songUrl || !songUrl.startsWith('https://genius.com/')) {
    return res.status(400).json({ error: 'Paramètre "url" invalide.' });
  }

  try {
    const page = await axios.get(songUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; pstparoles/1.0)' },
    });

    const $ = cheerio.load(page.data);
    const containers = $('[data-lyrics-container="true"]');

    if (containers.length === 0) {
      return res.status(404).json({ error: 'Paroles introuvables sur cette page.' });
    }

    containers.find('br').replaceWith('\n');
    const lyrics = containers
      .map((_, el) => $(el).text().trim())
      .get()
      .join('\n\n')
      .trim();

    res.json({ lyrics });
  } catch (err) {
    console.error('Erreur récupération paroles:', err.message);
    res.status(502).json({ error: 'Impossible de récupérer les paroles.' });
  }
});

app.listen(PORT, () => {
  console.log(`pstparoles démarré sur http://localhost:${PORT}`);
});
