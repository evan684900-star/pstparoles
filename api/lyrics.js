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
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: 'https://genius.com/',
        },
        timeout: 8000,
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
      const status = err.response ? err.response.status : 'no-response';
      console.error(`Erreur récupération paroles Genius (status ${status}):`, err.message);
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
