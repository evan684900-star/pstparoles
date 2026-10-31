const axios = require('axios');
const { fetchLyricsAny, httpGet, looseMatchSong, primaryArtist, cleanQueryText } = require('../lib/lyrics-sources');

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

// Le même morceau tel que Genius l'écrit. Le suivi Spotify passe le titre et
// l'artiste de Spotify ; la recherche du site, ceux de Genius. Quand le
// premier ne mène pas à une version synchronisée, on essaie le second, pour
// que les deux chemins trouvent la même chose.
async function findGeniusTwin(artist, title) {
  if (!GENIUS_ACCESS_TOKEN) return null;
  try {
    const res = await httpGet('https://api.genius.com/search', {
      params: { q: `${primaryArtist(artist) || artist} ${cleanQueryText(title) || title}` },
      headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
      timeout: 6000,
    }, null, 'Genius');
    const hits = (res.data.response.hits || []).map((h) => h.result).filter((s) => s && s.primary_artist);
    const twin = hits
      .map((s) => ({ artist: s.primary_artist.name, title: s.title }))
      .find((s) => looseMatchSong(s, { artist, title }));
    if (!twin || (twin.artist === artist && twin.title === title)) return null;
    return twin;
  } catch (err) {
    return null;
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
  const dur = duration > 0 && duration < 3600 ? duration : null;
  let result = await fetchLyricsAny(artist, title, enabledKeys, ctx, dur);

  // Pas de version synchronisée : dernier essai avec l'écriture de Genius
  // (seulement pour LRCLIB, seule source à avoir la synchro).
  const lrclibOn = !enabledKeys || enabledKeys.includes('lrclib');
  // Inutile si LRCLIB vient de refuser (limite de débit) : ce serait pareil.
  if (lrclibOn && !ctx.failed && !(result && (result.synced || result.instrumental))) {
    const twin = await findGeniusTwin(artist, title);
    if (twin) {
      const alt = await fetchLyricsAny(twin.artist, twin.title, ['lrclib'], ctx, dur);
      if (alt && (alt.synced || alt.instrumental || !result)) result = alt;
    }
  }

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
      // Pas de synchro et LRCLIB en panne : elle existe peut-être, le
      // client peut aller la chercher lui-même.
      retryable: !result.synced && !!ctx.failed,
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
