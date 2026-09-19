module.exports = async (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID || null;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ clientId });
};
