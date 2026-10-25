const { httpGet, guessLyrics, searchLrclib, normalizeForMatch, cleanQueryText } = require('../lib/lyrics-sources');

const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

// Artiste dont le nom figure dans la recherche ("Daft Punk", "daft punk
// one more time") : le front propose alors d'ouvrir toute sa discographie.
function findQueriedArtist(query, artists) {
  const q = ` ${normalizeForMatch(query)} `;
  let best = null;
  for (const a of artists) {
    const name = normalizeForMatch(a.name);
    if (name.length < 2 || !q.includes(` ${name} `)) continue;
    if (!best || name.length > normalizeForMatch(best.name).length) best = a;
  }
  return best ? { id: best.id, name: best.name, image: best.image_url || null } : null;
}

module.exports = async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Paramètre "q" requis.' });
  }

  let geniusHits = [];
  let geniusArtists = [];
  let geniusError = null;

  const enabledKeys = req.query.sources ? req.query.sources.split(',').filter(Boolean) : null;
  const lrclibEnabled = !enabledKeys || enabledKeys.includes('lrclib');
  // Lancée en parallèle de Genius : pas d'attente supplémentaire.
  const lrclibPromise = lrclibEnabled ? searchLrclib(query) : Promise.resolve([]);

  if (GENIUS_ACCESS_TOKEN) {
    try {
      const response = await httpGet('https://api.genius.com/search', {
        params: { q: query },
        headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
        timeout: 8000,
      }, null, 'Genius');

      const songs = response.data.response.hits.map((hit) => hit.result);
      geniusArtists = songs.map((song) => song.primary_artist).filter(Boolean);
      geniusHits = songs.map((song) => ({
        source: 'genius',
        id: song.id,
        title: song.title,
        artist: song.primary_artist.name,
        artistId: song.primary_artist.id,
        thumbnail: song.song_art_image_thumbnail_url,
        url: song.url,
      }));
    } catch (err) {
      console.error('Erreur recherche Genius:', err.message);
      geniusError = 'Impossible de contacter Genius pour la recherche.';
    }
  }

  const lrclibResponse = await lrclibPromise;
  const lrclibHits = lrclibResponse || [];
  // Les deux sources ont répondu : la même recherche doit redonner la même
  // liste, on laisse Vercel la garder en cache une heure. Sinon (une source
  // en panne), pas de cache, pour que la recherche suivante ait sa chance.
  if (!geniusError && lrclibResponse) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  const artist = findQueriedArtist(query, geniusArtists);
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
      artist,
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
