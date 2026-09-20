const axios = require('axios');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Endpoint non officiel de Google Translate (gratuit, sans clé). Partagé par
// beaucoup de projets sur les IP Vercel, donc parfois limité en débit (429) —
// on retente une fois après une courte pause avant d'abandonner.
async function translateGoogle(text, target) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
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
    } catch (err) {
      const status = err.response ? err.response.status : null;
      console.error(`Erreur traduction Google (tentative ${attempt + 1}, status ${status}):`, err.message);
      if (status === 429 && attempt === 0) {
        await sleep(400);
        continue;
      }
      return null;
    }
  }
  return null;
}

// Infrastructure différente de Google : sert de repli si Google est limité
// en débit. Découpe par lots car MyMemory limite ~500 caractères/requête
// en usage anonyme.
async function translateMyMemory(text, target) {
  const lines = text.split('\n');
  const translatedLines = [];

  for (const line of lines) {
    if (!line.trim()) {
      translatedLines.push('');
      continue;
    }
    try {
      const res = await axios.get('https://api.mymemory.translated.net/get', {
        params: { q: line.slice(0, 490), langpair: `autodetect|${target}` },
        timeout: 6000,
      });
      const translated = res.data && res.data.responseData && res.data.responseData.translatedText;
      translatedLines.push(translated || line);
    } catch (err) {
      translatedLines.push(line);
    }
  }

  const joined = translatedLines.join('\n').trim();
  return joined || null;
}

module.exports = async (req, res) => {
  const { text, target } = req.query;
  if (!text || !target) {
    return res.status(400).json({ error: 'Paramètres "text" et "target" requis.' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const googleResult = await translateGoogle(text, target);
  if (googleResult) {
    return res.status(200).json({ translated: googleResult, source: 'google' });
  }

  // Google est limité en débit ou indisponible : on tente MyMemory en repli
  // seulement pour des textes raisonnablement courts (au-delà, trop de
  // requêtes ligne par ligne pour rester rapide).
  if (text.length <= 3000) {
    const myMemoryResult = await translateMyMemory(text, target);
    if (myMemoryResult) {
      return res.status(200).json({ translated: myMemoryResult, source: 'mymemory' });
    }
  }

  return res.status(502).json({ error: 'Traduction indisponible pour le moment (limite atteinte), réessaie dans quelques secondes.' });
};
