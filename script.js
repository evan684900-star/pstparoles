const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const skeletons = document.getElementById('skeletons');
const emptyEl = document.getElementById('empty');
const recentsEl = document.getElementById('recents');
const recentChips = document.getElementById('recent-chips');
const lyricsView = document.getElementById('lyrics-view');
const lyricsTitle = document.getElementById('lyrics-title');
const lyricsArtist = document.getElementById('lyrics-artist');
const lyricsContent = document.getElementById('lyrics-content');
const lyricsCover = document.getElementById('lyrics-cover');
const backButton = document.getElementById('back-button');
const copyButton = document.getElementById('copy-button');
const shareButton = document.getElementById('share-button');
const halo = document.getElementById('halo');
const sizeLabel = document.getElementById('size-label');
const lyricsLink = document.getElementById('lyrics-link');

const spotifyNowPlayingBtn = document.getElementById('spotify-now-playing');
const spotifyBanner = document.getElementById('spotify-banner');
const spotifyConnectBtn = document.getElementById('spotify-connect');
const spotifyDismissBtn = document.getElementById('spotify-dismiss');
const spotifyProgress = document.getElementById('spotify-progress');
const spotifyProgressTrack = document.getElementById('spotify-progress-track');
const spotifyProgressFill = document.getElementById('spotify-progress-fill');
const spotifyProgressElapsed = document.getElementById('spotify-progress-elapsed');
const spotifyProgressDuration = document.getElementById('spotify-progress-duration');

const translateControl = document.querySelector('.translate-control');
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

const geniusEmbedWrapper = document.getElementById('genius-embed-wrapper');
const geniusEmbedContainer = document.getElementById('genius-embed');

const HALO_DEFAULT = '#ffb545';
const SOURCE_LABELS = {
  lyricsovh: 'lyrics.ovh',
  lrclib: 'LRCLIB',
  textyl: 'Textyl',
  lyrist: 'Lyrist',
  chartlyrics: 'ChartLyrics',
  genius: 'Genius',
};

let currentLyrics = '';
let originalLyricsText = '';
let lastResults = [];
let currentSong = null;

/* ---------- petites aides ---------- */

function setStatus(message, isError) {
  statusEl.textContent = message || '';
  statusEl.classList.toggle('error', !!isError);
}

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

// Teinte stable déduite du titre : sert au halo quand la pochette n'est pas lisible (CORS).
function hueOf(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 62%)`;
}

function setHalo(color) {
  document.documentElement.style.setProperty('--halo', color);
  halo.style.animation = 'none';
  void halo.offsetWidth;
  halo.style.animation = 'haloIn 1.2s cubic-bezier(.2,.8,.2,1) both';
}

function coverMarkup(song, big) {
  const tint = hueOf(song.title + song.artist);
  const style = `background:linear-gradient(140deg,${tint},#0a0a0c)`;
  const inner = song.thumbnail
    ? `<img src="${song.thumbnail}" alt="" loading="lazy" />`
    : `<span>${initials(song.artist)}</span>`;
  return `<div class="cover${big ? ' cover-lg' : ''}" style="${style}">${inner}</div>`;
}

// Met à jour la pochette en place (garde le même élément DOM d'un chargement
// à l'autre, contrairement à outerHTML qui casserait la référence).
function setCover(container, song) {
  const tint = hueOf(song.title + song.artist);
  container.style.background = `linear-gradient(140deg,${tint},#0a0a0c)`;
  container.innerHTML = song.thumbnail
    ? `<img src="${song.thumbnail}" alt="" loading="lazy" />`
    : `<span>${initials(song.artist)}</span>`;
}

/* ---------- recherches récentes ---------- */

function getRecents() {
  try { const r = JSON.parse(localStorage.getItem('pst-recents') || '[]'); return Array.isArray(r) ? r : []; }
  catch (e) { return []; }
}

function pushRecent(query) {
  const list = [query, ...getRecents().filter((r) => r.toLowerCase() !== query.toLowerCase())].slice(0, 4);
  try { localStorage.setItem('pst-recents', JSON.stringify(list)); } catch (e) {}
  renderRecents();
}

function renderRecents() {
  const list = getRecents();
  recentsEl.hidden = list.length === 0;
  recentChips.innerHTML = '';
  list.forEach((q) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = q;
    b.addEventListener('click', () => { input.value = q; runSearch(q); });
    recentChips.appendChild(b);
  });
}

/* ---------- taille du texte ---------- */

function getSize() {
  const s = parseInt(localStorage.getItem('pst-size') || '', 10);
  return s >= 15 && s <= 30 ? s : 19;
}

function setSize(n) {
  const size = Math.min(30, Math.max(15, n));
  try { localStorage.setItem('pst-size', String(size)); } catch (e) {}
  document.documentElement.style.setProperty('--lyr-size', size + 'px');
  sizeLabel.textContent = size + 'px';
}

document.getElementById('size-down').addEventListener('click', () => setSize(getSize() - 1));
document.getElementById('size-up').addEventListener('click', () => setSize(getSize() + 1));

/* ---------- vues ---------- */

function showResults() {
  lyricsView.hidden = true;
  resultsEl.hidden = false;
  form.hidden = false;
  recentsEl.hidden = getRecents().length === 0;
  emptyEl.hidden = lastResults.length > 0;
  setHalo(HALO_DEFAULT);
  if (lastResults.length) setStatus(lastResults.length + ' résultats');
  closeLibraryPanel();
  closeSettingsPanel();
  stopSpotifyProgressTracking();
}

function showLyricsView() {
  lyricsView.hidden = false;
  resultsEl.hidden = true;
  emptyEl.hidden = true;
  recentsEl.hidden = true;
  setStatus('');
  updateSpotifyBanner();
  startSpotifyProgressTracking();
}

/* ---------- recherche ---------- */

async function runSearch(query) {
  query = (query || '').trim();
  if (!query) return;

  pushRecent(query);
  resultsEl.innerHTML = '';
  lastResults = [];
  emptyEl.hidden = true;
  lyricsView.hidden = true;
  resultsEl.hidden = false;
  skeletons.hidden = false;
  setStatus('');

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&sources=${getEnabledSources().join(',')}`);
    const data = await res.json();
    skeletons.hidden = true;

    if (!res.ok) { setStatus(data.error || 'Erreur inconnue.', true); return; }
    if (!data.results || data.results.length === 0) { setStatus('Aucun résultat trouvé.', true); return; }

    lastResults = data.results;
    setStatus(data.results.length + ' résultats');
    renderResults(data.results);
  } catch (err) {
    skeletons.hidden = true;
    setStatus('Erreur réseau, réessaie.', true);
  }
}

form.addEventListener('submit', (e) => { e.preventDefault(); runSearch(input.value); });

function renderResults(results) {
  resultsEl.innerHTML = '';
  results.forEach((song, i) => {
    const li = document.createElement('li');
    li.style.animationDelay = (i * 70) + 'ms';
    li.innerHTML = `
      ${coverMarkup(song, false)}
      <div class="info">
        <strong>${song.title}</strong>
        <span>${song.artist}</span>
      </div>
      <span class="source">${SOURCE_LABELS[song.source] || song.source}</span>
      <span class="arrow">→</span>
    `;
    li.addEventListener('click', () => loadLyrics(song));
    resultsEl.appendChild(li);
  });
}

/* ---------- paroles ---------- */

function renderLyrics(text) {
  currentLyrics = text || '';
  lyricsContent.innerHTML = '';
  const lines = currentLyrics.split('\n');
  lines.forEach((line, i) => {
    const p = document.createElement('p');
    const trimmed = line.trim();
    if (!trimmed) { p.className = 'blank'; p.innerHTML = '&nbsp;'; }
    else if (trimmed.startsWith('[')) { p.className = 'tag'; p.textContent = trimmed; }
    else p.textContent = trimmed;
    // cascade limitée aux ~40 premières lignes pour rester nerveux sur les textes longs
    p.style.animationDelay = Math.min(i, 40) * 45 + 'ms';
    lyricsContent.appendChild(p);
  });
}

function showTranslatableLyrics(text) {
  originalLyricsText = text;
  renderLyrics(text);
  resetTranslateBar();
  translateControl.classList.remove('hidden');
  saveButton.classList.remove('hidden');
  updateSaveButtonState();
}

function hideLyricsExtras() {
  translateControl.classList.add('hidden');
  saveButton.classList.add('hidden');
  resetTranslateBar();
  hideGeniusEmbed();
  showGeniusLink(null);
}

function hideGeniusEmbed() {
  geniusEmbedWrapper.classList.add('hidden');
  geniusEmbedContainer.innerHTML = '';
}

// Le widget officiel Genius (embed_content) : chargé dans le navigateur du
// visiteur, donc pas bloqué comme le scraping direct.
function renderGeniusEmbed(html) {
  // Le script embed.js de Genius s'appuie sur document.write(), ce que les
  // navigateurs modernes bloquent silencieusement pour un <script> injecté
  // après coup dans la page principale (résultat : seul le texte de repli
  // "Read More" reste visible). Solution standard pour ce genre de vieux
  // widgets : on l'écrit dans un iframe fraîchement créé, où le script est
  // "parsé normalement" comme s'il faisait partie du chargement initial de
  // cette page — document.write y fonctionne alors comme prévu.
  geniusEmbedContainer.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.className = 'genius-embed-frame';
  iframe.setAttribute('scrolling', 'yes');
  geniusEmbedContainer.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><base target="_top" />
    <style>
      html,body{margin:0;padding:0;background:#fff;font-family:'Space Grotesk',system-ui,sans-serif;overflow-x:hidden;}
      a{color:#ffb545;}
      /* Le widget imbriqué de Genius garde sa largeur fixe par défaut :
         on force son propre iframe à occuper toute la largeur dispo. */
      iframe{width:100% !important;max-width:100% !important;height:100% !important;border:0 !important;display:block !important;}
      .rg_embed_link{display:block;}
    </style>
  </head><body>${html}</body></html>`);
  doc.close();

  geniusEmbedWrapper.classList.remove('hidden');
}

function showGeniusLink(url) {
  if (!url) { lyricsLink.classList.add('hidden'); return; }
  lyricsLink.querySelector('a').href = url;
  lyricsLink.classList.remove('hidden');
}

async function loadLyrics(song) {
  currentSong = { artist: song.artist, title: song.title, thumbnail: song.thumbnail || null, id: song.id || null };

  lyricsTitle.textContent = song.title;
  lyricsArtist.innerHTML = `${song.artist} · <em>${SOURCE_LABELS[song.source] || song.source}</em>`;
  setCover(lyricsCover, song);
  setHalo(hueOf(song.title + song.artist));
  hideLyricsExtras();
  showLyricsView();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  copyButton.classList.remove('ok');
  copyButton.textContent = 'Copier les paroles';

  // Le repli lyrics.ovh renvoie déjà les paroles directement lors de la recherche.
  if (song.source === 'lyricsovh' && song.lyrics) {
    showTranslatableLyrics(song.lyrics);
    return;
  }

  renderLyrics('Chargement des paroles…');

  const params = new URLSearchParams();
  if (song.url) params.set('url', song.url);
  if (song.id) params.set('id', song.id);
  params.set('artist', song.artist);
  params.set('title', song.title);
  params.set('sources', getEnabledSources().join(','));

  try {
    const res = await fetch(`/api/lyrics?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      renderLyrics(data.error || 'Erreur lors du chargement des paroles.');
      return;
    }

    if (data.lyrics) {
      showTranslatableLyrics(data.lyrics);
      return;
    }

    if (data.embedHtml) {
      renderLyrics('');
      renderGeniusEmbed(data.embedHtml);
      showGeniusLink(data.geniusUrl);
      return;
    }

    renderLyrics("Les paroles de cette chanson ne sont pas disponibles pour le moment.");
    showGeniusLink(data.geniusUrl);
  } catch (err) {
    renderLyrics('Erreur réseau, réessaie.');
  }
}

backButton.addEventListener('click', showResults);

/* ---------- copier / partager ---------- */

function flash(button, label) {
  const original = button.dataset.label || button.textContent;
  button.dataset.label = original;
  button.textContent = label;
  button.classList.add('ok');
  setTimeout(() => { button.textContent = original; button.classList.remove('ok'); }, 1800);
}

copyButton.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(currentLyrics); flash(copyButton, '✓ Copié'); }
  catch (e) { flash(copyButton, 'Copie impossible'); }
});

shareButton.addEventListener('click', async () => {
  const shareData = { title: lyricsTitle.textContent, text: `${lyricsTitle.textContent} — paroles`, url: location.href };
  if (navigator.share) { try { await navigator.share(shareData); return; } catch (e) {} }
  try { await navigator.clipboard.writeText(location.href); flash(shareButton, '✓ Lien copié'); }
  catch (e) { flash(shareButton, 'Partage indisponible'); }
});

/* ---------- traduction ---------- */

function resetTranslateBar() {
  translateSelect.value = '';
  translateResetBtn.classList.add('hidden');
}

translateSelect.addEventListener('change', async () => {
  const target = translateSelect.value;
  if (!target) {
    renderLyrics(originalLyricsText);
    translateResetBtn.classList.add('hidden');
    return;
  }

  const previousText = currentLyrics;
  renderLyrics('Traduction en cours…');

  try {
    const params = new URLSearchParams({ text: originalLyricsText, target });
    const res = await fetch(`/api/translate?${params.toString()}`);
    const data = await res.json();

    if (!res.ok || !data.translated) {
      renderLyrics(previousText);
      setStatus(data.error || 'Traduction indisponible pour le moment.', true);
      translateSelect.value = '';
      return;
    }

    renderLyrics(data.translated);
    translateResetBtn.classList.remove('hidden');
  } catch (err) {
    renderLyrics(previousText);
    setStatus('Erreur réseau, réessaie.', true);
    translateSelect.value = '';
  }
});

translateResetBtn.addEventListener('click', () => {
  renderLyrics(originalLyricsText);
  resetTranslateBar();
});

/* ---------- menu déroulant / bibliothèque ---------- */

const LIBRARY_KEY = 'pstparoles_library';

function getLibrary() {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]'); }
  catch (err) { return []; }
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
  if (saved) removeFromLibrary(currentSong.artist, currentSong.title);
  else addToLibrary(currentSong, originalLyricsText);
  updateSaveButtonState();
});

function libraryThumbMarkup(item) {
  if (item.thumbnail) return `<img class="library-item-thumb" src="${item.thumbnail}" alt="" loading="lazy" />`;
  const tint = hueOf(item.title + item.artist);
  return `<div class="library-item-thumb" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(140deg,${tint},#0a0a0c);font-family:var(--serif);font-size:14px;color:rgba(0,0,0,.6)">${initials(item.artist)}</div>`;
}

function renderLibrary() {
  const library = getLibrary();
  libraryCount.textContent = String(library.length);
  libraryEmpty.classList.toggle('hidden', library.length > 0);
  libraryList.innerHTML = '';

  for (const item of library) {
    const li = document.createElement('li');
    li.innerHTML = `
      ${libraryThumbMarkup(item)}
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
  currentSong = { artist: item.artist, title: item.title, thumbnail: item.thumbnail };

  lyricsTitle.textContent = item.title;
  lyricsArtist.innerHTML = `${item.artist} · <em>Bibliothèque</em>`;
  setCover(lyricsCover, item);
  setHalo(hueOf(item.title + item.artist));
  hideLyricsExtras();
  showLyricsView();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  copyButton.classList.remove('ok');
  copyButton.textContent = 'Copier les paroles';

  showTranslatableLyrics(item.lyrics);
  closeLibraryPanel();
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
  if (libraryPanel.classList.contains('open')) closeLibraryPanel();
  else { renderLibrary(); openLibraryPanel(); }
});

document.addEventListener('click', (e) => {
  if (!libraryPanel.classList.contains('open')) return;
  if (libraryPanel.contains(e.target) || menuToggle.contains(e.target)) return;
  closeLibraryPanel();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeLibraryPanel(); closeSettingsPanel(); }
});

/* ---------- paramètres : choix des sources de paroles ---------- */

const SETTINGS_SOURCES_KEY = 'pstparoles_sources';
const AVAILABLE_SOURCES = [
  { key: 'lrclib', label: 'LRCLIB', badge: 'Le plus complet' },
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
        <span class="settings-source-name">${source.label}</span>
        ${source.badge ? `<span class="settings-source-badge">${source.badge}</span>` : ''}
      </label>
    `;
    settingsSourcesList.appendChild(li);
  }
}

settingsSourcesList.addEventListener('change', (e) => {
  const checkbox = e.target.closest('input[type="checkbox"]');
  if (!checkbox) return;

  const enabled = new Set(getEnabledSources());
  if (checkbox.checked) enabled.add(checkbox.dataset.source);
  else enabled.delete(checkbox.dataset.source);

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
  if (settingsPanel.classList.contains('open')) closeSettingsPanel();
  else { renderSettings(); openSettingsPanel(); }
});

document.addEventListener('click', (e) => {
  if (!settingsPanel.classList.contains('open')) return;
  if (settingsPanel.contains(e.target) || settingsToggle.contains(e.target)) return;
  closeSettingsPanel();
});

/* ---------- connexion Spotify (PKCE, sans backend secret) ---------- */

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SCOPE = 'user-read-currently-playing';
const LS_ACCESS_TOKEN = 'spotify_access_token';
const LS_REFRESH_TOKEN = 'spotify_refresh_token';
const LS_EXPIRES_AT = 'spotify_expires_at';

let spotifyClientIdPromise = null;

function getSpotifyClientId() {
  if (!spotifyClientIdPromise) {
    spotifyClientIdPromise = fetch('/api/spotify-config').then((res) => res.json()).then((data) => data.clientId);
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
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
  if (data.refresh_token) localStorage.setItem(LS_REFRESH_TOKEN, data.refresh_token);
}

async function refreshSpotifyToken() {
  const refreshToken = localStorage.getItem(LS_REFRESH_TOKEN);
  const clientId = await getSpotifyClientId();
  if (!refreshToken || !clientId) return null;

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken }),
  });

  if (!res.ok) { disconnectSpotify(); return null; }

  const data = await res.json();
  storeSpotifyTokens(data);
  return data.access_token;
}

async function getValidSpotifyToken() {
  if (!isSpotifyConnected()) return null;
  const expiresAt = Number(localStorage.getItem(LS_EXPIRES_AT) || 0);
  if (Date.now() < expiresAt - 5000) return localStorage.getItem(LS_ACCESS_TOKEN);
  return refreshSpotifyToken();
}

async function fetchPlaybackState() {
  const token = await getValidSpotifyToken();
  if (!token) return null;

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204) return null;
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
      setStatus("Aucune lecture en cours sur Spotify (ou session expirée).", true);
      return;
    }
    input.value = `${track.artist} ${track.title}`;
    runSearch(input.value);
  } finally {
    spotifyNowPlayingBtn.disabled = false;
  }
});

/* ---------- barre de progression "en écoute" ---------- */

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
  const pct = spotifyLocalDurationMs ? Math.min(100, (spotifyLocalProgressMs / spotifyLocalDurationMs) * 100) : 0;
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

/* ---------- init ---------- */

setSize(getSize());
renderRecents();
renderLibrary();
input.focus();

(async () => {
  await handleSpotifyRedirect();
  updateSpotifyUI();
})();
