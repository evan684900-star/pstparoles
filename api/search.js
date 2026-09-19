const axios = require('axios');
const { guessLyrics } = require('../lib/lyrics-sources');

const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

module.exports = async (req, res) => {
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
    return res.status(200).json({ results: geniusHits });
  }

  // Genius n'a rien trouvé (ou n'est pas disponible) : on tente les autres sources en repli.
  const fallback = await guessLyrics(query);
  if (fallback) {
    return res.status(200).json({
      results: [
        {
          source: fallback.source,
          title: fallback.title,
          artist: fallback.artist,
          thumbnail: null,
          lyrics: fallback.lyrics,
        },
      ],
    });
  }

  if (geniusError && !GENIUS_ACCESS_TOKEN) {
    return res.status(404).json({ error: "Aucun résultat trouvé, et Genius n'est pas configuré." });
  }
  if (geniusError) {
    return res.status(502).json({ error: geniusError });
  }
  return res.status(200).json({ results: [] });
};
