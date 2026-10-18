const axios = require('axios');

// Relaie une pochette depuis notre propre domaine : le navigateur peut alors
// lire ses pixels (pour en extraire la couleur dominante) sans dépendre des
// en-têtes CORS de Genius, Spotify ou YouTube. Limité aux hébergeurs de
// pochettes connus, pour ne pas servir de relais vers n'importe quelle URL.
const ALLOWED_HOSTS = ['genius.com', 'rapgenius.com', 'scdn.co', 'spotifycdn.com', 'ytimg.com', 'mzstatic.com'];
const MAX_BYTES = 5 * 1024 * 1024;

function isAllowed(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (err) {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url || !isAllowed(url)) {
    return res.status(400).json({ error: 'URL de pochette non autorisée.' });
  }

  try {
    const upstream = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 6000,
      maxContentLength: MAX_BYTES,
      maxRedirects: 0,
    });
    const type = String(upstream.headers['content-type'] || '');
    if (!type.startsWith('image/')) {
      return res.status(415).json({ error: "Ce n'est pas une image." });
    }
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.status(200).send(Buffer.from(upstream.data));
  } catch (err) {
    return res.status(502).json({ error: 'Pochette indisponible.' });
  }
};

module.exports.isAllowed = isAllowed;
