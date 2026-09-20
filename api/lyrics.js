const axios = require('axios');
const { fetchLyrics } = require('../lib/lyrics-sources');

const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

// Genius bloque le scraping de ses pages (403), mais propose un widget
// d'intégration officiel (embed_content) : il se charge dans le navigateur
// du visiteur, pas depuis notre serveur, donc il passe leur protection
// anti-bot sans contourner quoi que ce soit — c'est fait pour être embarqué.
async function fetchGeniusEmbed(songId) {
  if (!songId || !GENIUS_ACCESS_TOKEN) return null;

  try {
    const res = await axios.get(`https://api.genius.com/songs/${songId}`, {
      headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
      timeout: 6000,
    });
    const embedHtml = res.data && res.data.response && res.data.response.song && res.data.response.song.embed_content;
    return embedHtml || null;
  } catch (err) {
    return null;
  }
}

module.exports = async (req, res) => {
  const { artist, title, url, id, sources } = req.query;

  if (!artist || !title) {
    return res.status(400).json({ error: 'Paramètres "artist" et "title" requis.' });
  }

  const enabledKeys = sources ? sources.split(',').filter(Boolean) : null;

  // On récupère le texte via les sources activées (LRCLIB, lyrics.ovh, ...).
  const result = await fetchLyrics(artist, title, enabledKeys);

  res.setHeader('Cache-Control', 'no-store');

  if (result) {
    return res.status(200).json({
      lyrics: result.lyrics,
      // Version horodatée (format LRC) quand la source en a une : sert au
      // surlignage synchronisé avec la lecture Spotify.
      syncedLyrics: result.synced || null,
      source: result.source,
    });
  }

  // Aucune source texte n'a trouvé la chanson : on propose le widget Genius
  // officiel si on a l'id de la chanson (résultat issu de la recherche Genius).
  const embedHtml = await fetchGeniusEmbed(id);

  return res.status(200).json({
    lyrics: null,
    embedHtml,
    geniusUrl: url && url.startsWith('https://genius.com/') ? url : null,
  });
};
