const { fetchLyricsOvh } = require('../lib/lyrics-ovh');

module.exports = async (req, res) => {
  const { artist, title, url } = req.query;

  if (!artist || !title) {
    return res.status(400).json({ error: 'Paramètres "artist" et "title" requis.' });
  }

  // Genius bloque le scraping de ses pages (403) et ses conditions demandent
  // de renvoyer vers leur site : on récupère le texte via lyrics.ovh, sinon
  // on propose le lien Genius.
  const lyrics = await fetchLyricsOvh(artist, title);

  res.setHeader('Cache-Control', 'no-store');

  if (lyrics) {
    return res.status(200).json({ lyrics, source: 'lyricsovh' });
  }

  return res.status(200).json({
    lyrics: null,
    geniusUrl: url && url.startsWith('https://genius.com/') ? url : null,
  });
};
