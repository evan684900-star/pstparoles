const axios = require('axios');

const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;
const PER_PAGE = 50; // maximum accepté par Genius

// Discographie d'un artiste Genius, page par page, des plus populaires aux
// moins connues (ou par ordre alphabétique avec sort=title).
module.exports = async (req, res) => {
  const id = parseInt(req.query.id, 10);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const sort = req.query.sort === 'title' ? 'title' : 'popularity';
  if (!id || id < 1) {
    return res.status(400).json({ error: 'Paramètre "id" requis.' });
  }
  if (!GENIUS_ACCESS_TOKEN) {
    return res.status(503).json({ error: "Genius n'est pas configuré." });
  }

  const headers = { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` };
  try {
    const [songsRes, artistRes] = await Promise.all([
      axios.get(`https://api.genius.com/artists/${id}/songs`, {
        params: { sort, per_page: PER_PAGE, page },
        headers,
      }),
      // Nom et photo : utiles seulement à l'ouverture de la page.
      page === 1 ? axios.get(`https://api.genius.com/artists/${id}`, { headers }) : Promise.resolve(null),
    ]);

    const data = songsRes.data.response;
    const songs = (data.songs || []).map((song) => ({
      source: 'genius',
      id: song.id,
      title: song.title,
      artist: song.primary_artist ? song.primary_artist.name : '',
      artistId: song.primary_artist ? song.primary_artist.id : null,
      thumbnail: song.song_art_image_thumbnail_url,
      url: song.url,
    }));

    let artist = null;
    if (artistRes) {
      const a = artistRes.data.response.artist;
      artist = { id: a.id, name: a.name, image: a.image_url || null };
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ artist, songs, nextPage: data.next_page || null });
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ error: 'Artiste introuvable.' });
    }
    console.error('Erreur artiste Genius:', err.message);
    return res.status(502).json({ error: 'Impossible de contacter Genius.' });
  }
};
