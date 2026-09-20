const axios = require('axios');

// Utilise l'endpoint oEmbed public de YouTube : pas de clé API, pas de
// connexion nécessaire, juste le titre/auteur/miniature d'une vidéo à
// partir de son URL. Sert à retrouver artiste/titre pour un lien collé
// par l'utilisateur, sans avoir besoin de connecter un compte YouTube.
module.exports = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Paramètre "url" requis.' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return res.status(400).json({ error: 'URL invalide.' });
  }

  const host = parsed.hostname.replace(/^www\./, '');
  const isYouTube = host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com';
  if (!isYouTube) {
    return res.status(400).json({ error: "Ce n'est pas un lien YouTube." });
  }

  try {
    const oembed = await axios.get('https://www.youtube.com/oembed', {
      params: { url, format: 'json' },
      timeout: 6000,
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      title: oembed.data.title || null,
      author: oembed.data.author_name || null,
      thumbnail: oembed.data.thumbnail_url || null,
    });
  } catch (err) {
    return res.status(404).json({ error: 'Vidéo YouTube introuvable.' });
  }
};
