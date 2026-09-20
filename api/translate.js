const axios = require('axios');

// Endpoint non officiel de Google Translate (gratuit, sans clé).
async function translateGoogle(text, target) {
  const res = await axios.get('https://translate.googleapis.com/translate_a/single', {
    params: { client: 'gtx', sl: 'auto', tl: target, dt: 't', q: text },
    timeout: 8000,
  });

  const segments = res.data && res.data[0];
  if (!Array.isArray(segments)) return null;

  let output = '';
  for (const seg of segments) {
    const translatedPart = seg[0] || '';
    const originalPart = seg[1] || '';
    output += translatedPart;
    // Reconstitue les sauts de ligne présents dans le texte d'origine.
    const trailingNewlines = (originalPart.match(/\n+$/) || [''])[0];
    output += trailingNewlines;
  }

  return output.trim() || null;
}

module.exports = async (req, res) => {
  const { text, target } = req.query;
  if (!text || !target) {
    return res.status(400).json({ error: 'Paramètres "text" et "target" requis.' });
  }

  try {
    const translated = await translateGoogle(text, target);
    if (translated) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ translated });
    }
  } catch (err) {
    console.error('Erreur traduction:', err.message);
  }

  return res.status(502).json({ error: 'Traduction indisponible pour le moment, réessaie.' });
};
