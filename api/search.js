const axios = require('axios');
const { guessLyrics, searchLrclib, normalizeForMatch, cleanQueryText } = require('../lib/lyrics-sources');

const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

module.exports = async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Paramètre "q" requis.' });
  }

  let geniusHits = [];
  let geniusError = null;

  const enabledKeys = req.query.sources ? req.query.sources.split(',').filter(Boolean) : null;
  const lrclibEnabled = !enabledKeys || enabledKeys.includes('lrclib');
  // Lancée en parallèle de Genius : pas d'attente supplémentaire.
  const lrclibPromise = lrclibEnabled ? searchLrclib(query) : Promise.resolve([]);

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

  const lrclibHits = await lrclibPromise;
  const keyOf = (r) => `${normalizeForMatch(cleanQueryText(r.title))}|${normalizeForMatch(r.artist)}`;

  if (geniusHits.length > 0) {
    // Genius ne référence presque pas les morceaux instrumentaux : on ajoute
    // ceux de LRCLIB. Les versions instrumentales d'une chanson déjà trouvée
    // ("Titre (Instrumental)") sont écartées pour ne pas encombrer.
    const seen = new Set(geniusHits.map(keyOf));
    const extras = [];
    for (const hit of lrclibHits) {
      if (!hit.instrumental) continue;
      const key = keyOf(hit);
      if (seen.has(key)) continue;
      seen.add(key);
      extras.push(hit);
      if (extras.length >= 5) break;
    }
    // Un morceau instrumental dont le titre figure dans la recherche passe en tête.
    const q = normalizeForMatch(query);
    const matchesQuery = (hit) => {
      const t = normalizeForMatch(hit.title);
      return t.length > 2 && q.includes(t);
    };
    return res.status(200).json({
      results: [...extras.filter(matchesQuery), ...geniusHits, ...extras.filter((h) => !matchesQuery(h))],
    });
  }

  // Genius n'a rien trouvé : les résultats de LRCLIB (avec ou sans paroles).
  if (lrclibHits.length > 0) {
    const seen = new Set();
    const results = lrclibHits.filter((hit) => {
      const key = `${normalizeForMatch(hit.title)}|${normalizeForMatch(hit.artist)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
    return res.status(200).json({ results });
  }

  // Rien nulle part : on tente de deviner artiste et titre dans la saisie.
  const fallback = await guessLyrics(query, enabledKeys);
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
