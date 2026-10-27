const axios = require('axios');
const { fetchLyricsAny } = require('../lib/lyrics-sources');

const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

// Genius bloque le scraping de ses pages (403), mais propose un widget
// d'intégration officiel (embed_content) : il se charge dans le navigateur
// du visiteur, pas depuis notre serveur, donc il passe leur protection
// anti-bot sans contourner quoi que ce soit — c'est fait pour être embarqué.
// Renvoie aussi le marquage "instrumental" de Genius, quand il existe.
async function fetchGeniusSong(songId) {
  if (!songId || !GENIUS_ACCESS_TOKEN) return {};

  try {
    const res = await axios.get(`https://api.genius.com/songs/${songId}`, {
      headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
      timeout: 6000,
    });
    const song = (res.data && res.data.response && res.data.response.song) || {};
    return { embedHtml: song.embed_content || null, instrumental: song.instrumental === true };
  } catch (err) {
    return {};
  }
}

module.exports = async (req, res) => {
  const { artist, title, url, id, sources } = req.query;
  // Durée du morceau qui joue sur Spotify (secondes) : aide à choisir la
  // bonne version synchronisée.
  const duration = Math.round(Number(req.query.duration)) || null;

  if (!artist || !title) {
    return res.status(400).json({ error: 'Paramètres "artist" et "title" requis.' });
  }

  const enabledKeys = sources ? sources.split(',').filter(Boolean) : null;

  // On récupère le texte via les sources activées (LRCLIB, lyrics.ovh, ...),
  // en essayant aussi des versions nettoyées du titre et de l'artiste : ceux
  // de Genius ont souvent un "bruit" (typographie, feat., remaster...) que
  // les bases de paroles n'ont pas.
  const ctx = {};
  const result = await fetchLyricsAny(artist, title, enabledKeys, ctx, duration > 0 && duration < 3600 ? duration : null);

  // Une réponse trouvée est mise en cache par Vercel : rouvrir la chanson
  // redonne exactement les mêmes paroles, sans dépendre de l'humeur des
  // sources ce jour-là. Un échec n'est jamais mis en cache, ni une version
  // sans synchro obtenue pendant une panne de LRCLIB (la synchro existe
  // peut-être, elle n'a juste pas pu être récupérée).
  const cacheable = result && (result.synced || result.instrumental || !ctx.failed);
  res.setHeader('Cache-Control', cacheable
    ? 'public, s-maxage=86400, stale-while-revalidate=604800'
    : 'no-store');

  if (result && result.instrumental) {
    return res.status(200).json({ lyrics: null, instrumental: true, source: result.source });
  }

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
  const genius = await fetchGeniusSong(id);
  if (genius.instrumental) {
    return res.status(200).json({ lyrics: null, instrumental: true, source: 'genius' });
  }

  return res.status(200).json({
    lyrics: null,
    embedHtml: genius.embedHtml || null,
    geniusUrl: url && url.startsWith('https://genius.com/') ? url : null,
    // Une source était en panne : "introuvable" n'est peut-être que passager.
    retryable: !!ctx.failed,
  });
};
