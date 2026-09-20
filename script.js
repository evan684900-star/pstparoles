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
const spotifyProgress = document.getElementById('spotify-progress');
const spotifyProgressTrack = document.getElementById('spotify-progress-track');
const spotifyProgressFill = document.getElementById('spotify-progress-fill');
const spotifyProgressElapsed = document.getElementById('spotify-progress-elapsed');
const spotifyProgressDuration = document.getElementById('spotify-progress-duration');
const translateBar = document.getElementById('translate-bar');
const translateSelect = document.getElementById('translate-select');
const translateResetBtn = document.getElementById('translate-reset');
const menuToggle = document.getElementById('menu-toggle');
const libraryPanel = document.getElementById('library-panel');
const libraryList = document.getElementById('library-list');
const libraryEmpty = document.getElementById('library-empty');
const libraryCount = document.getElementById('library-count');
const saveButton = document.getElementById('save-button');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const settingsSourcesList = document.getElementById('settings-sources-list');

function setStatus(message) {
  statusEl.textContent = message || '';
}

function showResults() {
  lyricsView.classList.add('hidden');
  resultsEl.classList.remove('hidden');
  form.classList.remove('hidden');
  stopSpotifyProgressTracking();
}

function showLyricsView() {
  lyricsView.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  updateSpotifyBanner();
  startSpotifyProgressTracking();
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
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&sources=${getEnabledSources().join(',')}`);
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
    const sourceLabels = {
      lyricsovh: 'lyrics.ovh',
      lrclib: 'LRCLIB',
      textyl: 'Textyl',
      lyrist: 'Lyrist',
      chartlyrics: 'ChartLyrics',
      genius: 'Genius',
    };
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

let originalLyricsText = '';
let currentSong = null;

function resetTranslateBar() {
  translateSelect.value = '';
  translateResetBtn.classList.add('hidden');
}

function showTranslatableLyrics(text) {
  originalLyricsText = text;
  lyricsContent.textContent = text;
  resetTranslateBar();
  translateBar.classList.remove('hidden');
  saveButton.classList.remove('hidden');
  updateSaveButtonState();
}

function hideTranslateBar() {
  translateBar.classList.add('hidden');
  saveButton.classList.add('hidden');
  resetTranslateBar();
}

async function loadLyrics(song) {
  setStatus('');
  currentSong = { artist: song.artist, title: song.title, thumbnail: song.thumbnail || null };
  lyricsTitle.textContent = `${song.title} — ${song.artist}`;
  showGeniusLink(null);
  hideTranslateBar();
  showLyricsView();
  closeLibraryPanel();

  // Le repli lyrics.ovh renvoie déjà les paroles directement lors de la recherche.
  if (song.source === 'lyricsovh' && song.lyrics) {
    showTranslatableLyrics(song.lyrics);
    scrollToLyrics();
    return;
  }

  lyricsContent.textContent = 'Chargement des paroles...';
  scrollToLyrics();

  const params = new URLSearchParams();
  if (song.url) params.set('url', song.url);
  params.set('artist', song.artist);
  params.set('title', song.title);
  params.set('sources', getEnabledSources().join(','));

  try {
    const res = await fetch(`/api/lyrics?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      lyricsContent.textContent = data.error || 'Erreur lors du chargement des paroles.';
      scrollToLyrics();
      return;
    }

    if (data.lyrics) {
      showTranslatableLyrics(data.lyrics);
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

// ---- Menu déroulant / Bibliothèque de paroles enregistrées ----

const LIBRARY_KEY = 'pstparoles_library';

function getLibrary() {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
  } catch (err) {
    return [];
  }
}

function saveLibraryData(list) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
}

function findLibraryIndex(artist, title) {
  const library = getLibrary();
  return library.findIndex(
    (item) => item.artist.toLowerCase() === artist.toLowerCase() && item.title.toLowerCase() === title.toLowerCase()
  );
}

function isInLibrary(artist, title) {
  return findLibraryIndex(artist, title) !== -1;
}

function addToLibrary(song, lyrics) {
  const library = getLibrary();
  if (findLibraryIndex(song.artist, song.title) !== -1) return;
  library.unshift({
    artist: song.artist,
    title: song.title,
    thumbnail: song.thumbnail || null,
    lyrics,
    savedAt: Date.now(),
  });
  saveLibraryData(library);
  renderLibrary();
}

function removeFromLibrary(artist, title) {
  const library = getLibrary();
  const index = findLibraryIndex(artist, title);
  if (index === -1) return;
  library.splice(index, 1);
  saveLibraryData(library);
  renderLibrary();
}

function updateSaveButtonState() {
  if (!currentSong) return;
  const saved = isInLibrary(currentSong.artist, currentSong.title);
  saveButton.classList.toggle('saved', saved);
  saveButton.querySelector('.save-label').textContent = saved ? 'Enregistré' : 'Enregistrer';
}

saveButton.addEventListener('click', () => {
  if (!currentSong) return;
  const saved = isInLibrary(currentSong.artist, currentSong.title);
  if (saved) {
    removeFromLibrary(currentSong.artist, currentSong.title);
  } else {
    addToLibrary(currentSong, originalLyricsText);
  }
  updateSaveButtonState();
});

function renderLibrary() {
  const library = getLibrary();
  libraryCount.textContent = String(library.length);
  libraryEmpty.classList.toggle('hidden', library.length > 0);
  libraryList.innerHTML = '';

  for (const item of library) {
    const li = document.createElement('li');
    li.innerHTML = `
      ${item.thumbnail ? `<img src="${item.thumbnail}" alt="" width="36" height="36" style="border-radius:8px;object-fit:cover;flex-shrink:0;" />` : '<div class="result-thumb-fallback" style="width:36px;height:36px;"></div>'}
      <div class="library-item-info">
        <strong>${item.title}</strong>
        <span>${item.artist}</span>
      </div>
      <button class="library-remove" type="button" aria-label="Retirer">&times;</button>
    `;
    li.addEventListener('click', () => loadFromLibrary(item));
    li.querySelector('.library-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromLibrary(item.artist, item.title);
      if (currentSong && currentSong.artist === item.artist && currentSong.title === item.title) {
        updateSaveButtonState();
      }
    });
    libraryList.appendChild(li);
  }
}

function loadFromLibrary(item) {
  setStatus('');
  currentSong = { artist: item.artist, title: item.title, thumbnail: item.thumbnail };
  lyricsTitle.textContent = `${item.title} — ${item.artist}`;
  showGeniusLink(null);
  showLyricsView();
  showTranslatableLyrics(item.lyrics);
  closeLibraryPanel();
  scrollToLyrics();
}

function openLibraryPanel() {
  libraryPanel.classList.add('open');
  menuToggle.setAttribute('aria-expanded', 'true');
}

function closeLibraryPanel() {
  libraryPanel.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}

menuToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  closeSettingsPanel();
  if (libraryPanel.classList.contains('open')) {
    closeLibraryPanel();
  } else {
    renderLibrary();
    openLibraryPanel();
  }
});

document.addEventListener('click', (e) => {
  if (!libraryPanel.classList.contains('open')) return;
  if (libraryPanel.contains(e.target) || menuToggle.contains(e.target)) return;
  closeLibraryPanel();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLibraryPanel();
    closeSettingsPanel();
  }
});

renderLibrary();

// ---- Paramètres : choix des sources de paroles ----

const SETTINGS_SOURCES_KEY = 'pstparoles_sources';
const AVAILABLE_SOURCES = [
  { key: 'lrclib', label: 'LRCLIB' },
  { key: 'lyricsovh', label: 'lyrics.ovh' },
  { key: 'textyl', label: 'Textyl' },
  { key: 'lyrist', label: 'Lyrist' },
  { key: 'chartlyrics', label: 'ChartLyrics' },
];
const ALL_SOURCE_KEYS = AVAILABLE_SOURCES.map((s) => s.key);

function getEnabledSources() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_SOURCES_KEY) || 'null');
    if (Array.isArray(stored) && stored.length) return stored;
  } catch (err) {
    // valeur corrompue, on repart sur toutes les sources
  }
  return ALL_SOURCE_KEYS;
}

function setEnabledSources(keys) {
  localStorage.setItem(SETTINGS_SOURCES_KEY, JSON.stringify(keys));
}

function renderSettings() {
  const enabled = new Set(getEnabledSources());
  settingsSourcesList.innerHTML = '';

  for (const source of AVAILABLE_SOURCES) {
    const li = document.createElement('li');
    const id = `source-${source.key}`;
    li.innerHTML = `
      <label for="${id}">
        <input type="checkbox" id="${id}" data-source="${source.key}" ${enabled.has(source.key) ? 'checked' : ''} />
        ${source.label}
      </label>
    `;
    settingsSourcesList.appendChild(li);
  }
}

settingsSourcesList.addEventListener('change', (e) => {
  const checkbox = e.target.closest('input[type="checkbox"]');
  if (!checkbox) return;

  const enabled = new Set(getEnabledSources());
  if (checkbox.checked) {
    enabled.add(checkbox.dataset.source);
  } else {
    enabled.delete(checkbox.dataset.source);
  }

  // Toujours garder au moins une source active.
  if (enabled.size === 0) {
    checkbox.checked = true;
    enabled.add(checkbox.dataset.source);
  }

  setEnabledSources(ALL_SOURCE_KEYS.filter((key) => enabled.has(key)));
});

function openSettingsPanel() {
  settingsPanel.classList.add('open');
  settingsToggle.setAttribute('aria-expanded', 'true');
}

function closeSettingsPanel() {
  settingsPanel.classList.remove('open');
  settingsToggle.setAttribute('aria-expanded', 'false');
}

settingsToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  closeLibraryPanel();
  if (settingsPanel.classList.contains('open')) {
    closeSettingsPanel();
  } else {
    renderSettings();
    openSettingsPanel();
  }
});

document.addEventListener('click', (e) => {
  if (!settingsPanel.classList.contains('open')) return;
  if (settingsPanel.contains(e.target) || settingsToggle.contains(e.target)) return;
  closeSettingsPanel();
});

// ---- Traduction des paroles ----

translateSelect.addEventListener('change', async () => {
  const target = translateSelect.value;
  if (!target) {
    lyricsContent.textContent = originalLyricsText;
    translateResetBtn.classList.add('hidden');
    return;
  }

  const previousText = lyricsContent.textContent;
  lyricsContent.textContent = 'Traduction en cours...';

  try {
    const params = new URLSearchParams({ text: originalLyricsText, target });
    const res = await fetch(`/api/translate?${params.toString()}`);
    const data = await res.json();

    if (!res.ok || !data.translated) {
      lyricsContent.textContent = previousText;
      setStatus(data.error || 'Traduction indisponible pour le moment.');
      translateSelect.value = '';
      return;
    }

    lyricsContent.textContent = data.translated;
    translateResetBtn.classList.remove('hidden');
  } catch (err) {
    lyricsContent.textContent = previousText;
    setStatus('Erreur réseau, réessaie.');
    translateSelect.value = '';
  }
});

translateResetBtn.addEventListener('click', () => {
  lyricsContent.textContent = originalLyricsText;
  resetTranslateBar();
});

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

async function fetchPlaybackState() {
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
    progressMs: data.progress_ms || 0,
    durationMs: data.item.duration_ms || 0,
    isPlaying: Boolean(data.is_playing),
  };
}

function updateSpotifyBanner() {
  const dismissed = sessionStorage.getItem('spotify_banner_dismissed') === '1';
  spotifyBanner.classList.toggle('hidden', isSpotifyConnected() || dismissed);
}

function updateSpotifyUI() {
  spotifyNowPlayingBtn.classList.toggle('hidden', !isSpotifyConnected());
  updateSpotifyBanner();
  if (!isSpotifyConnected()) stopSpotifyProgressTracking();
}

// ---- Barre de progression "en écoute" au-dessus des paroles ----

let spotifyPollTimer = null;
let spotifyTickTimer = null;
let spotifyLocalProgressMs = 0;
let spotifyLocalDurationMs = 0;
let spotifyIsPlaying = false;

function formatMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderSpotifyProgressTimes() {
  const pct = spotifyLocalDurationMs
    ? Math.min(100, (spotifyLocalProgressMs / spotifyLocalDurationMs) * 100)
    : 0;
  spotifyProgressFill.style.width = `${pct}%`;
  spotifyProgressElapsed.textContent = formatMs(spotifyLocalProgressMs);
  spotifyProgressDuration.textContent = formatMs(spotifyLocalDurationMs);
}

async function refreshSpotifyProgress() {
  const state = await fetchPlaybackState();

  if (!state) {
    spotifyProgress.classList.add('hidden');
    spotifyIsPlaying = false;
    return;
  }

  spotifyLocalProgressMs = state.progressMs;
  spotifyLocalDurationMs = state.durationMs;
  spotifyIsPlaying = state.isPlaying;
  spotifyProgressTrack.textContent = `${state.title} — ${state.artist}`;
  renderSpotifyProgressTimes();
  spotifyProgress.classList.remove('hidden');
}

function tickSpotifyProgress() {
  if (!spotifyIsPlaying || spotifyProgress.classList.contains('hidden')) return;
  spotifyLocalProgressMs = Math.min(spotifyLocalProgressMs + 1000, spotifyLocalDurationMs);
  renderSpotifyProgressTimes();
}

function startSpotifyProgressTracking() {
  stopSpotifyProgressTracking();
  if (!isSpotifyConnected()) return;

  refreshSpotifyProgress();
  spotifyPollTimer = setInterval(refreshSpotifyProgress, 8000);
  spotifyTickTimer = setInterval(tickSpotifyProgress, 1000);
}

function stopSpotifyProgressTracking() {
  if (spotifyPollTimer) clearInterval(spotifyPollTimer);
  if (spotifyTickTimer) clearInterval(spotifyTickTimer);
  spotifyPollTimer = null;
  spotifyTickTimer = null;
  spotifyProgress.classList.add('hidden');
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
    const track = await fetchPlaybackState();
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
