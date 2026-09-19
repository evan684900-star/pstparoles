const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const lyricsView = document.getElementById('lyrics-view');
const lyricsTitle = document.getElementById('lyrics-title');
const lyricsContent = document.getElementById('lyrics-content');
const lyricsLink = document.getElementById('lyrics-link');
const backButton = document.getElementById('back-button');
const spotifyBanner = document.getElementById('spotify-banner');
const spotifyConnectBtn = document.getElementById('spotify-connect');
const spotifyDismissBtn = document.getElementById('spotify-dismiss');
const spotifyNowPlayingBtn = document.getElementById('spotify-now-playing');

function setStatus(message) {
  statusEl.textContent = message || '';
}

function showResults() {
  lyricsView.classList.add('hidden');
  resultsEl.classList.remove('hidden');
  form.classList.remove('hidden');
}

function showLyricsView() {
  lyricsView.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  updateSpotifyBanner();
}

function scrollToLyrics() {
  lyricsContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  resultsEl.innerHTML = '';
  setStatus('Recherche en cours...');

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || 'Erreur inconnue.');
      return;
    }

    if (data.results.length === 0) {
      setStatus('Aucun résultat trouvé.');
      return;
    }

    setStatus(`${data.results.length} résultat(s)`);
    renderResults(data.results);
    input.blur();
  } catch (err) {
    setStatus('Erreur réseau, réessaie.');
  }
});

function renderResults(results) {
  resultsEl.innerHTML = '';
  for (const song of results) {
    const li = document.createElement('li');
    const sourceLabels = { lyricsovh: 'lyrics.ovh', lrclib: 'LRCLIB', genius: 'Genius' };
    const sourceLabel = sourceLabels[song.source] || song.source;
    li.innerHTML = `
      ${song.thumbnail ? `<img src="${song.thumbnail}" alt="" />` : '<div class="result-thumb-fallback"></div>'}
      <div class="result-info">
        <strong>${song.title}</strong>
        <span>${song.artist} · ${sourceLabel}</span>
      </div>
    `;
    li.addEventListener('click', () => loadLyrics(song));
    resultsEl.appendChild(li);
  }
}

function showGeniusLink(url) {
  if (!url) {
    lyricsLink.classList.add('hidden');
    return;
  }
  lyricsLink.querySelector('a').href = url;
  lyricsLink.classList.remove('hidden');
}

async function loadLyrics(song) {
  setStatus('');
  lyricsTitle.textContent = `${song.title} — ${song.artist}`;
  showGeniusLink(null);
  showLyricsView();

  // Le repli lyrics.ovh renvoie déjà les paroles directement lors de la recherche.
  if (song.source === 'lyricsovh' && song.lyrics) {
    lyricsContent.textContent = song.lyrics;
    scrollToLyrics();
    return;
  }

  lyricsContent.textContent = 'Chargement des paroles...';
  scrollToLyrics();

  const params = new URLSearchParams();
  if (song.url) params.set('url', song.url);
  params.set('artist', song.artist);
  params.set('title', song.title);

  try {
    const res = await fetch(`/api/lyrics?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      lyricsContent.textContent = data.error || 'Erreur lors du chargement des paroles.';
      scrollToLyrics();
      return;
    }

    if (data.lyrics) {
      lyricsContent.textContent = data.lyrics;
      scrollToLyrics();
      return;
    }

    lyricsContent.textContent =
      "Les paroles de cette chanson ne sont pas disponibles via lyrics.ovh.";
    showGeniusLink(data.geniusUrl);
    scrollToLyrics();
  } catch (err) {
    lyricsContent.textContent = 'Erreur réseau, réessaie.';
    scrollToLyrics();
  }
}

backButton.addEventListener('click', showResults);

// ---- Connexion Spotify (PKCE, sans backend secret) ----

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SCOPE = 'user-read-currently-playing';
const LS_ACCESS_TOKEN = 'spotify_access_token';
const LS_REFRESH_TOKEN = 'spotify_refresh_token';
const LS_EXPIRES_AT = 'spotify_expires_at';

let spotifyClientIdPromise = null;

function getSpotifyClientId() {
  if (!spotifyClientIdPromise) {
    spotifyClientIdPromise = fetch('/api/spotify-config')
      .then((res) => res.json())
      .then((data) => data.clientId);
  }
  return spotifyClientIdPromise;
}

function spotifyRedirectUri() {
  return `${window.location.origin}/`;
}

function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) result += chars[values[i] % chars.length];
  return result;
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function codeChallengeFromVerifier(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

async function connectSpotify() {
  const clientId = await getSpotifyClientId();
  if (!clientId) {
    alert("Spotify n'est pas configuré sur ce site pour le moment.");
    return;
  }

  const verifier = randomString(64);
  const state = randomString(16);
  sessionStorage.setItem('spotify_verifier', verifier);
  sessionStorage.setItem('spotify_state', state);

  const challenge = await codeChallengeFromVerifier(verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SPOTIFY_SCOPE,
    state,
  });

  window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

function disconnectSpotify() {
  localStorage.removeItem(LS_ACCESS_TOKEN);
  localStorage.removeItem(LS_REFRESH_TOKEN);
  localStorage.removeItem(LS_EXPIRES_AT);
  updateSpotifyUI();
}

function isSpotifyConnected() {
  return Boolean(localStorage.getItem(LS_REFRESH_TOKEN));
}

async function handleSpotifyRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code) return;

  // Nettoie l'URL tout de suite pour éviter de retenter l'échange au refresh.
  window.history.replaceState({}, document.title, window.location.pathname);

  const expectedState = sessionStorage.getItem('spotify_state');
  const verifier = sessionStorage.getItem('spotify_verifier');
  if (!verifier || state !== expectedState) return;

  const clientId = await getSpotifyClientId();
  if (!clientId) return;

  try {
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: spotifyRedirectUri(),
        code_verifier: verifier,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || 'Échange du code échoué.');

    storeSpotifyTokens(data);
  } catch (err) {
    console.error('Erreur connexion Spotify:', err);
  } finally {
    sessionStorage.removeItem('spotify_verifier');
    sessionStorage.removeItem('spotify_state');
  }
}

function storeSpotifyTokens(data) {
  localStorage.setItem(LS_ACCESS_TOKEN, data.access_token);
  localStorage.setItem(LS_EXPIRES_AT, String(Date.now() + data.expires_in * 1000));
  if (data.refresh_token) {
    localStorage.setItem(LS_REFRESH_TOKEN, data.refresh_token);
  }
}

async function refreshSpotifyToken() {
  const refreshToken = localStorage.getItem(LS_REFRESH_TOKEN);
  const clientId = await getSpotifyClientId();
  if (!refreshToken || !clientId) return null;

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    disconnectSpotify();
    return null;
  }

  const data = await res.json();
  storeSpotifyTokens(data);
  return data.access_token;
}

async function getValidSpotifyToken() {
  if (!isSpotifyConnected()) return null;

  const expiresAt = Number(localStorage.getItem(LS_EXPIRES_AT) || 0);
  if (Date.now() < expiresAt - 5000) {
    return localStorage.getItem(LS_ACCESS_TOKEN);
  }
  return refreshSpotifyToken();
}

async function fetchCurrentlyPlaying() {
  const token = await getValidSpotifyToken();
  if (!token) return null;

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204) return null; // rien en cours de lecture
  if (!res.ok) return null;

  const data = await res.json();
  if (!data || !data.item) return null;

  return {
    title: data.item.name,
    artist: data.item.artists.map((a) => a.name).join(', '),
  };
}

function updateSpotifyBanner() {
  const dismissed = sessionStorage.getItem('spotify_banner_dismissed') === '1';
  spotifyBanner.classList.toggle('hidden', isSpotifyConnected() || dismissed);
}

function updateSpotifyUI() {
  spotifyNowPlayingBtn.classList.toggle('hidden', !isSpotifyConnected());
  updateSpotifyBanner();
}

spotifyConnectBtn.addEventListener('click', connectSpotify);

spotifyDismissBtn.addEventListener('click', () => {
  sessionStorage.setItem('spotify_banner_dismissed', '1');
  updateSpotifyBanner();
});

spotifyNowPlayingBtn.addEventListener('click', async () => {
  spotifyNowPlayingBtn.disabled = true;
  setStatus('Récupération de la chanson en cours...');
  try {
    const track = await fetchCurrentlyPlaying();
    if (!track) {
      setStatus("Aucune lecture en cours sur Spotify (ou session expirée).");
      return;
    }
    input.value = `${track.artist} ${track.title}`;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  } finally {
    spotifyNowPlayingBtn.disabled = false;
  }
});

(async () => {
  await handleSpotifyRedirect();
  updateSpotifyUI();
})();
