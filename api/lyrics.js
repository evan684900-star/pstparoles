const axios = require('axios');
const cheerio = require('cheerio');
const { fetchLyricsOvh } = require('../lib/lyrics-ovh');

module.exports = async (req, res) => {
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
        return res.status(200).json({ lyrics, source: 'genius' });
      }
    } catch (err) {
      console.error('Erreur récupération paroles Genius:', err.message);
    }

    // Genius n'a pas les paroles (page instrumentale, scraping échoué...) : repli lyrics.ovh.
    if (artist && title) {
      const lyrics = await fetchLyricsOvh(artist, title);
      if (lyrics) {
        return res.status(200).json({ lyrics, source: 'lyricsovh' });
      }
    }

    return res.status(404).json({ error: 'Paroles introuvables sur Genius, et pas de repli disponible.' });
  }

  if (artist && title) {
    const lyrics = await fetchLyricsOvh(artist, title);
    if (lyrics) {
      return res.status(200).json({ lyrics, source: 'lyricsovh' });
    }
    return res.status(404).json({ error: 'Paroles introuvables sur lyrics.ovh.' });
  }

  return res.status(400).json({ error: 'Paramètre "url" ou "artist"+"title" requis.' });
};
