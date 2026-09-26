const axios = require('axios');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Endpoint non officiel de Google Translate (gratuit, sans clé). Partagé par
// beaucoup de projets sur les IP Vercel, donc parfois limité en débit (429) —
// on retente une fois après une courte pause avant d'abandonner.
// Renvoie le texte brut, sans trim : le mode aligné a besoin que la
// structure des lignes soit préservée telle quelle.
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

      return output || null;
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

// MyMemory limite ~500 caractères par requête en usage anonyme.
async function translateMyMemoryLine(line, target) {
  try {
    const res = await axios.get('https://api.mymemory.translated.net/get', {
      params: { q: line.slice(0, 490), langpair: `autodetect|${target}` },
      timeout: 6000,
    });
    const translated = res.data && res.data.responseData && res.data.responseData.translatedText;
    return translated || null;
  } catch (err) {
    return null;
  }
}

// Infrastructure différente de Google : sert de repli si Google est limité.
async function translateMyMemory(text, target) {
  const lines = text.split('\n');
  const translatedLines = [];

  for (const line of lines) {
    if (!line.trim()) {
      translatedLines.push('');
      continue;
    }
    translatedLines.push((await translateMyMemoryLine(line, target)) || line);
  }

  const joined = translatedLines.join('\n').trim();
  return joined || null;
}

async function translateSingleLine(line, target) {
  const viaGoogle = await translateGoogle(line, target);
  if (viaGoogle && viaGoogle.trim()) return viaGoogle.trim();
  return (await translateMyMemoryLine(line, target)) || line;
}

// Traduit un lot en une seule requête, et vérifie que le nombre de lignes
// est conservé. Sinon on retombe sur du ligne par ligne pour ce lot
// seulement : l'alignement est garanti, et le coût reste borné.
async function translateChunk(lines, target) {
  const raw = await translateGoogle(lines.join('\n'), target);
  if (raw) {
    const got = raw.split('\n').map((l) => l.trim());
    if (got.length === lines.length) return got;
  }

  const results = [];
  for (const line of lines) results.push(await translateSingleLine(line, target));
  return results;
}

const CHUNK_SIZE = 20;
const CONCURRENCY = 3;

// Renvoie exactement autant de lignes qu'en entrée, pour pouvoir replacer
// la traduction sur les horodatages des paroles synchronisées.
async function translateLinesAligned(lines, target) {
  // Les lignes vides sont la première cause de désalignement : on ne les
  // envoie pas du tout et on les réinsère à la fin.
  const indices = [];
  const payload = [];
  lines.forEach((line, i) => {
    if (line.trim()) {
      indices.push(i);
      payload.push(line);
    }
  });

  const out = new Array(lines.length).fill('');
  if (!payload.length) return out;

  const chunks = [];
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    chunks.push({ start: i, lines: payload.slice(i, i + CHUNK_SIZE) });
  }

  // Quelques lots en parallèle : bien plus rapide qu'en série, sans pour
  // autant déclencher la limite de débit.
  let cursor = 0;
  async function worker() {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor++];
      const translated = await translateChunk(chunk.lines, target);
      translated.forEach((text, k) => {
        out[indices[chunk.start + k]] = text;
      });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker)
  );

  return out;
}

module.exports = async (req, res) => {
  const { text, target, lines } = req.query;
  if (!text || !target) {
    return res.status(400).json({ error: 'Paramètres "text" et "target" requis.' });
  }

  res.setHeader('Cache-Control', 'no-store');

  // Mode aligné : utilisé pour les paroles synchronisées, où chaque ligne
  // traduite doit rester collée à son horodatage.
  if (lines === '1') {
    const sourceLines = text.split('\n');
    if (sourceLines.length > 300) {
      return res.status(413).json({ error: 'Chanson trop longue pour la traduction synchronisée.' });
    }

    const translated = await translateLinesAligned(sourceLines, target);
    if (!translated.some((l) => l.trim())) {
      return res.status(502).json({ error: 'Traduction indisponible pour le moment (limite atteinte), réessaie dans quelques secondes.' });
    }
    return res.status(200).json({ lines: translated });
  }

  const googleResult = await translateGoogle(text, target);
  if (googleResult && googleResult.trim()) {
    return res.status(200).json({ translated: googleResult.trim(), source: 'google' });
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
