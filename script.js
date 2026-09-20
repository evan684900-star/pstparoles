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
const coverLightbox = document.getElementById('cover-lightbox');
const lightboxCover = document.getElementById('lightbox-cover');
const lightboxClose = document.getElementById('lightbox-close');
const vinylSlot = document.getElementById('vinyl-slot');
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
const spotifyPrev = document.getElementById('spotify-prev');
const spotifyPlayPause = document.getElementById('spotify-playpause');
const spotifyNext = document.getElementById('spotify-next');
const playPauseIconPlay = spotifyPlayPause.querySelector('.ico-play');
const playPauseIconPause = spotifyPlayPause.querySelector('.ico-pause');

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
const settingsSpotifyAccount = document.getElementById('settings-spotify-account');
const spotifyDisconnectBtn = document.getElementById('spotify-disconnect');

const geniusEmbedWrapper = document.getElementById('genius-embed-wrapper');
const geniusEmbedContainer = document.getElementById('genius-embed');

const syncBar = document.getElementById('sync-bar');
const syncStatus = document.getElementById('sync-status');
const syncOffsetLabel = document.getElementById('sync-offset-label');
const syncOffsetDown = document.getElementById('sync-offset-down');
const syncOffsetUp = document.getElementById('sync-offset-up');
const followButton = document.getElementById('follow-button');

const HALO_DEFAULT = '#ffb545';
const SOURCE_LABELS = {
  lyricsovh: 'lyrics.ovh',
  lrclib: 'LRCLIB',
  textyl: 'Textyl',
  lyrist: 'Lyrist',
  chartlyrics: 'ChartLyrics',
  genius: 'Genius',
  youtube: 'YouTube',
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

// Pochette en grand : réutilise setCover() pour un rendu identique
// (image ou initiales) en plus grand.
function openCoverLightbox() {
  if (!currentSong) return;
  setCover(lightboxCover, currentSong);
  coverLightbox.classList.add('open');
}

function closeCoverLightbox() {
  coverLightbox.classList.remove('open');
}

lyricsCover.addEventListener('click', openCoverLightbox);
lyricsCover.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCoverLightbox(); }
});
lightboxClose.addEventListener('click', closeCoverLightbox);
coverLightbox.addEventListener('click', (e) => {
  if (e.target === coverLightbox) closeCoverLightbox();
});

// Relance la sortie du vinyle à chaque nouvelle chanson.
function replayVinyl() {
  vinylSlot.style.animation = 'none';
  void vinylSlot.offsetWidth;
  vinylSlot.style.animation = '';
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

function goHome() {
  input.value = '';
  lastResults = [];
  resultsEl.innerHTML = '';
  setStatus('');
  showResults();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const brandHome = document.getElementById('brand-home');
brandHome.addEventListener('click', goHome);
brandHome.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); }
});

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

const YOUTUBE_URL_RE = /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?|shorts\/)|youtu\.be\/)/i;

// Devine artiste/titre à partir du titre brut d'une vidéo YouTube
// ("Artiste - Titre (Official Video)" est le format le plus courant).
// Le nettoyage plus fin ("(Official Video)", "feat. X"...) est déjà géré
// côté serveur par cleanQueryText() lors du second essai dans /api/lyrics.
// Retire les suffixes vidéo courants ("(Official Video)", "[Lyrics]"...)
// pour un affichage propre. cleanQueryText() côté serveur s'occupe déjà du
// nettoyage utile à la recherche de paroles ; ceci est juste pour l'affichage.
function stripVideoSuffix(text) {
  return (text || '')
    .replace(/\s*[([]\s*(official\s*)?(music\s*)?(video|audio|lyrics?|hd|4k|visualizer|full\s*song)\s*[)\]]/gi, '')
    .trim();
}

function parseYoutubeTitle(title, author) {
  const raw = (title || '').trim();
  const parts = raw.split(/\s[-–—]\s/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: stripVideoSuffix(parts.slice(1).join(' - ').trim()) };
  }
  return { artist: (author || '').replace(/\s*-\s*Topic$/i, '').trim(), title: stripVideoSuffix(raw) };
}

async function runYoutubeSearch(url) {
  pushRecent(url);
  resultsEl.innerHTML = '';
  lastResults = [];
  emptyEl.hidden = true;
  lyricsView.hidden = true;
  resultsEl.hidden = false;
  skeletons.hidden = false;
  setStatus('Récupération du titre YouTube…');

  try {
    const res = await fetch(`/api/youtube-title?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    skeletons.hidden = true;

    if (!res.ok) { setStatus(data.error || 'Vidéo YouTube introuvable.', true); return; }

    const { artist, title } = parseYoutubeTitle(data.title, data.author);
    if (!title) { setStatus('Impossible de lire le titre de cette vidéo.', true); return; }

    setStatus('');
    loadLyrics({ source: 'youtube', artist: artist || 'Artiste inconnu', title, thumbnail: data.thumbnail || null, url: null, id: null });
  } catch (err) {
    skeletons.hidden = true;
    setStatus('Erreur réseau, réessaie.', true);
  }
}

async function runSearch(query) {
  query = (query || '').trim();
  if (!query) return;

  if (YOUTUBE_URL_RE.test(query)) { runYoutubeSearch(query); return; }

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
  // Le rendu simple remplace le rendu synchronisé : on abandonne les
  // références aux lignes horodatées (elles seraient détachées du DOM).
  clearSyncedLyrics();
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

// Lignes horodatées de la chanson affichée : conservées à part du rendu
// pour pouvoir revenir au mode synchronisé après une traduction.
let currentSyncedLines = [];

// Affiche la réponse de /api/lyrics : version synchronisée si la source en
// fournit une, texte simple sinon.
function applyLyricsPayload(data) {
  originalLyricsText = data.lyrics;
  currentSyncedLines = data.syncedLyrics ? parseLrc(data.syncedLyrics) : [];

  if (currentSyncedLines.length) {
    renderSyncedLyrics(currentSyncedLines);
  } else {
    renderLyrics(data.lyrics);
    updateSyncBar(); // affiche tout de suite le repli "pas de synchro" si pertinent
  }

  resetTranslateBar();
  translateControl.classList.remove('hidden');
  saveButton.classList.remove('hidden');
  updateSaveButtonState();
}

// Revient au texte d'origine, en réactivant le surlignage si disponible.
function restoreOriginalLyrics() {
  if (currentSyncedLines.length) renderSyncedLyrics(currentSyncedLines);
  else renderLyrics(originalLyricsText);
}

function hideLyricsExtras() {
  translateControl.classList.add('hidden');
  saveButton.classList.add('hidden');
  currentSyncedLines = [];
  clearSyncedLyrics();
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
  replayVinyl();
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
      applyLyricsPayload(data);
      return;
    }

    if (data.embedHtml) {
      renderLyrics('');
      renderGeniusEmbed(data.embedHtml);
      showGeniusLink(data.geniusUrl);
      updateSyncBar(); // aucune version horodatée ici non plus
      return;
    }

    renderLyrics("Les paroles de cette chanson ne sont pas disponibles pour le moment.");
    showGeniusLink(data.geniusUrl);
    updateSyncBar();
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
    restoreOriginalLyrics();
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
  restoreOriginalLyrics();
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
  replayVinyl();
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
  if (e.key === 'Escape') { closeLibraryPanel(); closeSettingsPanel(); closeCoverLightbox(); }
});

/* ---------- easter egg : taper "karaoke" au clavier ---------- */

const karaokeFx = document.getElementById('karaoke-fx');
let karaokeKeyBuffer = '';
let karaokeFxTimer = null;
let karaokeFxInterval = null;

const KARAOKE_COLORS = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#30b8c4', '#5ac8fa', '#af7ac5', '#ff2d95'];

function randomKaraokeColor() {
  return KARAOKE_COLORS[Math.floor(Math.random() * KARAOKE_COLORS.length)];
}

function paintKaraokeCells() {
  const cells = karaokeFx.children;
  for (let i = 0; i < cells.length; i++) {
    const color = randomKaraokeColor();
    cells[i].style.backgroundImage = `radial-gradient(circle at 35% 30%, rgba(255,255,255,.85), ${color} 65%)`;
  }
}

function triggerKaraokeFx() {
  if (karaokeFxInterval) return; // déjà en cours

  const cellSize = 56;
  const cols = Math.max(1, Math.ceil(window.innerWidth / cellSize));
  const rows = Math.max(1, Math.ceil(window.innerHeight / cellSize));
  const count = cols * rows;

  karaokeFx.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'kf-cell';
    frag.appendChild(cell);
  }
  karaokeFx.appendChild(frag);

  paintKaraokeCells();
  karaokeFx.classList.add('active');
  karaokeFxInterval = setInterval(paintKaraokeCells, 140);

  karaokeFxTimer = setTimeout(() => {
    karaokeFx.classList.remove('active');
    clearInterval(karaokeFxInterval);
    karaokeFxInterval = null;
    setTimeout(() => { karaokeFx.innerHTML = ''; }, 350);
  }, 10000);
}

document.addEventListener('keydown', (e) => {
  if (e.key.length !== 1) return;
  karaokeKeyBuffer = (karaokeKeyBuffer + e.key.toLowerCase()).slice(-'karaoke'.length);
  if (karaokeKeyBuffer === 'karaoke') {
    karaokeKeyBuffer = '';
    if (karaokeFxTimer) clearTimeout(karaokeFxTimer);
    triggerKaraokeFx();
  }
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
const SPOTIFY_SCOPE = 'user-read-currently-playing user-modify-playback-state';
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

  // On mesure l'aller-retour réseau : la position renvoyée correspond au
  // moment où Spotify a traité la requête, donc quelque part entre l'envoi
  // et la réception. On compense avec la moitié du temps de trajet.
  const sentAt = performance.now();
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const receivedAt = performance.now();

  if (res.status === 204) return null;
  if (!res.ok) return null;

  const data = await res.json();
  if (!data || !data.item) return null;

  const latencyCompensationMs = (receivedAt - sentAt) / 2;

  return {
    title: data.item.name,
    artist: data.item.artists.map((a) => a.name).join(', '),
    progressMs: (data.progress_ms || 0) + latencyCompensationMs,
    durationMs: data.item.duration_ms || 0,
    isPlaying: Boolean(data.is_playing),
    anchoredAtPerfMs: receivedAt,
  };
}

/* ---------- contrôle de la lecture (play/pause, suivant, précédent) ---------- */

async function spotifyPlayerCommand(method, path) {
  const token = await getValidSpotifyToken();
  if (!token) return { ok: false, status: 401 };
  const res = await fetch(`https://api.spotify.com/v1/me/player/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: res.ok, status: res.status };
}

function setPlayPauseIcon(isPlaying) {
  playPauseIconPlay.classList.toggle('hidden', isPlaying);
  playPauseIconPause.classList.toggle('hidden', !isPlaying);
}

function setSpotifyControlsBusy(busy) {
  spotifyPrev.disabled = busy;
  spotifyPlayPause.disabled = busy;
  spotifyNext.disabled = busy;
}

function reportSpotifyCommandError(status, fallback) {
  if (status === 403) setStatus('Contrôle de la lecture réservé aux comptes Spotify Premium.', true);
  else if (status === 404) setStatus("Aucun appareil Spotify actif — lance la lecture depuis l'appli d'abord.", true);
  else setStatus(fallback, true);
}

spotifyPlayPause.addEventListener('click', async () => {
  if (!playbackAnchor) return;
  const wasPlaying = playbackAnchor.isPlaying;
  const willPlay = !wasPlaying;

  setSpotifyControlsBusy(true);
  setPlayPauseIcon(willPlay); // retour visuel immédiat, corrigé si la commande échoue

  const { ok, status } = await spotifyPlayerCommand('PUT', willPlay ? 'play' : 'pause');
  if (!ok) {
    setPlayPauseIcon(wasPlaying);
    reportSpotifyCommandError(status, 'Impossible de contrôler la lecture Spotify.');
  } else {
    setTimeout(refreshPlaybackAnchor, 350);
  }
  setSpotifyControlsBusy(false);
});

spotifyNext.addEventListener('click', async () => {
  setSpotifyControlsBusy(true);
  const { ok, status } = await spotifyPlayerCommand('POST', 'next');
  if (!ok) reportSpotifyCommandError(status, 'Impossible de passer au titre suivant.');
  else setTimeout(refreshPlaybackAnchor, 450);
  setSpotifyControlsBusy(false);
});

spotifyPrev.addEventListener('click', async () => {
  setSpotifyControlsBusy(true);
  const { ok, status } = await spotifyPlayerCommand('POST', 'previous');
  if (!ok) reportSpotifyCommandError(status, 'Impossible de revenir au titre précédent.');
  else setTimeout(refreshPlaybackAnchor, 450);
  setSpotifyControlsBusy(false);
});

function updateSpotifyBanner() {
  const dismissed = sessionStorage.getItem('spotify_banner_dismissed') === '1';
  spotifyBanner.classList.toggle('hidden', isSpotifyConnected() || dismissed);
}

function updateSpotifyUI() {
  spotifyNowPlayingBtn.classList.toggle('hidden', !isSpotifyConnected());
  settingsSpotifyAccount.classList.toggle('hidden', !isSpotifyConnected());
  updateSpotifyBanner();
  updateFollowButton();
  if (!isSpotifyConnected()) stopSpotifyProgressTracking();
}

spotifyDisconnectBtn.addEventListener('click', () => {
  disconnectSpotify();
  closeSettingsPanel();
});

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

/* ---------- moteur de position de lecture (haute précision) ---------- */

// Le sondage réseau ne sert qu'à recaler : entre deux sondages, on
// interpole localement à partir de l'horloge du navigateur, ce qui donne
// une position à la milliseconde plutôt qu'au sondage.
const SPOTIFY_POLL_MS = 3000;

let playbackAnchor = null; // { progressMs, atPerfMs, durationMs, isPlaying, title, artist }
let spotifyPollTimer = null;
let displayRafId = null;
let lastRenderedSecond = -1;

function formatMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Position estimée maintenant = position reçue + temps écoulé depuis.
function estimatedProgressMs() {
  if (!playbackAnchor) return null;
  if (!playbackAnchor.isPlaying) return playbackAnchor.progressMs;
  const elapsed = performance.now() - playbackAnchor.atPerfMs;
  return Math.min(playbackAnchor.progressMs + elapsed, playbackAnchor.durationMs || Infinity);
}

async function refreshPlaybackAnchor() {
  const state = await fetchPlaybackState();

  if (!state) {
    playbackAnchor = null;
    spotifyProgress.classList.add('hidden');
    updateSyncBar();
    return;
  }

  const previous = playbackAnchor;
  playbackAnchor = {
    progressMs: state.progressMs,
    atPerfMs: state.anchoredAtPerfMs,
    durationMs: state.durationMs,
    isPlaying: state.isPlaying,
    title: state.title,
    artist: state.artist,
  };

  spotifyProgressTrack.textContent = `${state.title} — ${state.artist}`;
  spotifyProgressDuration.textContent = formatMs(state.durationMs);
  spotifyProgress.classList.remove('hidden');
  setPlayPauseIcon(state.isPlaying);

  const trackChanged = !previous || previous.title !== state.title || previous.artist !== state.artist;
  if (trackChanged && autoFollowEnabled) {
    followPlayingTrack(state);
  }

  updateSyncBar();
}

// Boucle d'affichage : tourne à la fréquence de rafraîchissement de
// l'écran (~60 fois/seconde) pour la barre de progression et le
// surlignage des paroles.
function displayTick() {
  const pos = estimatedProgressMs();

  if (pos !== null) {
    const duration = playbackAnchor.durationMs || 0;
    const pct = duration ? Math.min(100, (pos / duration) * 100) : 0;
    spotifyProgressFill.style.width = `${pct}%`;

    const second = Math.floor(pos / 1000);
    if (second !== lastRenderedSecond) {
      lastRenderedSecond = second;
      spotifyProgressElapsed.textContent = formatMs(pos);
    }

    updateKaraokeHighlight(pos);
  }

  displayRafId = requestAnimationFrame(displayTick);
}

function startSpotifyProgressTracking() {
  stopSpotifyProgressTracking();
  if (!isSpotifyConnected()) return;

  refreshPlaybackAnchor();
  spotifyPollTimer = setInterval(refreshPlaybackAnchor, SPOTIFY_POLL_MS);
  displayRafId = requestAnimationFrame(displayTick);
}

function stopSpotifyProgressTracking() {
  if (spotifyPollTimer) clearInterval(spotifyPollTimer);
  if (displayRafId) cancelAnimationFrame(displayRafId);
  spotifyPollTimer = null;
  displayRafId = null;
  playbackAnchor = null;
  lastRenderedSecond = -1;
  spotifyProgress.classList.add('hidden');
  syncBar.classList.add('hidden');
}

// La barre de progression se fige quand l'onglet passe en arrière-plan
// (rAF suspendu) : on recale dès le retour.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && spotifyPollTimer) refreshPlaybackAnchor();
});

/* ---------- paroles synchronisées (karaoké) ---------- */

const SYNC_OFFSET_KEY = 'pst-sync-offset';
const AUTO_FOLLOW_KEY = 'pst-auto-follow';

let syncedLines = [];      // [{ timeMs, text }]
let syncedLineEls = [];    // <p> alignés sur syncedLines
let activeLineIndex = -1;
let lastManualScrollAt = 0;
let autoFollowEnabled = localStorage.getItem(AUTO_FOLLOW_KEY) === '1';

function getSyncOffsetMs() {
  const raw = parseInt(localStorage.getItem(SYNC_OFFSET_KEY) || '0', 10);
  return Number.isFinite(raw) ? raw : 0;
}

function setSyncOffsetMs(ms) {
  const clamped = Math.max(-5000, Math.min(5000, ms));
  localStorage.setItem(SYNC_OFFSET_KEY, String(clamped));
  renderSyncOffsetLabel();
}

function renderSyncOffsetLabel() {
  const seconds = getSyncOffsetMs() / 1000;
  const sign = seconds > 0 ? '+' : seconds < 0 ? '−' : '';
  syncOffsetLabel.textContent = `${sign}${Math.abs(seconds).toFixed(1).replace('.', ',')} s`;
}

// Format LRC : [mm:ss.cc] texte — plusieurs horodatages possibles par ligne.
function parseLrc(lrc) {
  const lines = [];

  for (const raw of (lrc || '').split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;

    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const stamp of stamps) {
      const minutes = parseInt(stamp[1], 10);
      const seconds = parseInt(stamp[2], 10);
      const fraction = stamp[3] ? parseInt(stamp[3].padEnd(3, '0'), 10) : 0;
      lines.push({ timeMs: minutes * 60000 + seconds * 1000 + fraction, text });
    }
  }

  lines.sort((a, b) => a.timeMs - b.timeMs);
  return lines;
}

// Normalise pour comparer un titre Spotify ("X - Remastered 2011", "Y (feat. Z)")
// avec celui d'une autre source.
function normalizeTrackName(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\s-\s.*$/, ' ')
    .replace(/\b(feat|ft|with|remaster(ed)?|version|live)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tracksMatch(a, b) {
  const x = normalizeTrackName(a);
  const y = normalizeTrackName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function isPlayingCurrentSong() {
  if (!playbackAnchor || !currentSong) return false;
  return (
    tracksMatch(playbackAnchor.title, currentSong.title) &&
    tracksMatch(playbackAnchor.artist, currentSong.artist)
  );
}

function karaokeAvailable() {
  return syncedLines.length > 0 && isPlayingCurrentSong();
}

function updateSyncBar() {
  // La chanson en cours sur Spotify est bien celle affichée, mais aucune
  // source n'a de version horodatée pour elle : on le dit plutôt que de
  // laisser deviner pourquoi rien ne se surligne.
  if (!syncedLines.length && isPlayingCurrentSong()) {
    syncBar.classList.remove('hidden', 'paused');
    syncBar.classList.add('unavailable');
    lyricsContent.classList.remove('synced');
    clearKaraokeClasses();
    syncStatus.textContent = 'Pas de paroles synchronisées pour cette chanson';
    return;
  }

  syncBar.classList.remove('unavailable');

  if (!karaokeAvailable()) {
    syncBar.classList.add('hidden');
    lyricsContent.classList.remove('synced');
    clearKaraokeClasses();
    return;
  }

  syncBar.classList.remove('hidden');
  lyricsContent.classList.add('synced');
  const paused = !playbackAnchor.isPlaying;
  syncBar.classList.toggle('paused', paused);
  syncStatus.textContent = paused ? 'Lecture en pause' : 'Synchronisé avec Spotify';
}

function clearKaraokeClasses() {
  for (const el of syncedLineEls) el.classList.remove('active', 'done', 'next');
  activeLineIndex = -1;
}

// Recherche dichotomique : robuste aux sauts (avance rapide, retour arrière).
function findLineIndexAt(posMs) {
  let low = 0;
  let high = syncedLines.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (syncedLines[mid].timeMs <= posMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found;
}

function updateKaraokeHighlight(posMs) {
  if (!karaokeAvailable()) return;

  const index = findLineIndexAt(posMs - getSyncOffsetMs());
  if (index === activeLineIndex) return;

  for (const el of syncedLineEls) el.classList.remove('active', 'done', 'next');
  for (let i = 0; i < index; i++) syncedLineEls[i].classList.add('done');
  if (index >= 0 && syncedLineEls[index]) syncedLineEls[index].classList.add('active');
  if (syncedLineEls[index + 1]) syncedLineEls[index + 1].classList.add('next');

  activeLineIndex = index;

  // On laisse la main à l'utilisateur s'il vient de faire défiler lui-même.
  const userScrolledRecently = Date.now() - lastManualScrollAt < 6000;
  if (index >= 0 && syncedLineEls[index] && !userScrolledRecently) {
    syncedLineEls[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

window.addEventListener('wheel', () => { lastManualScrollAt = Date.now(); }, { passive: true });
window.addEventListener('touchmove', () => { lastManualScrollAt = Date.now(); }, { passive: true });

function renderSyncedLyrics(lines) {
  syncedLines = lines;
  syncedLineEls = [];
  activeLineIndex = -1;
  lyricsContent.innerHTML = '';

  lines.forEach((line) => {
    const p = document.createElement('p');
    const text = line.text.trim();
    if (!text) {
      p.className = 'blank';
      p.innerHTML = '&nbsp;';
    } else if (text.startsWith('[')) {
      p.className = 'tag';
      p.textContent = text;
    } else {
      p.textContent = text;
    }
    lyricsContent.appendChild(p);
    syncedLineEls.push(p);
  });

  currentLyrics = lines.map((l) => l.text).join('\n');
  updateSyncBar();
}

function clearSyncedLyrics() {
  syncedLines = [];
  syncedLineEls = [];
  activeLineIndex = -1;
  lyricsContent.classList.remove('synced');
  syncBar.classList.add('hidden');
  syncBar.classList.remove('unavailable', 'paused');
}

/* ---------- suivi automatique de la lecture ---------- */

async function followPlayingTrack(state) {
  // Pas besoin de passer par la recherche : /api/lyrics travaille déjà à
  // partir d'un couple artiste/titre.
  if (currentSong && tracksMatch(state.title, currentSong.title) && tracksMatch(state.artist, currentSong.artist)) {
    return;
  }

  const primaryArtist = state.artist.split(',')[0].trim();
  currentSong = { artist: primaryArtist, title: state.title, thumbnail: null, id: null };

  lyricsTitle.textContent = state.title;
  lyricsArtist.innerHTML = `${state.artist} · <em>Spotify</em>`;
  setCover(lyricsCover, { title: state.title, artist: primaryArtist, thumbnail: null });
  replayVinyl();
  setHalo(hueOf(state.title + primaryArtist));
  hideLyricsExtras();
  clearSyncedLyrics();
  renderLyrics('Chargement des paroles…');

  const params = new URLSearchParams({
    artist: primaryArtist,
    title: state.title,
    sources: getEnabledSources().join(','),
  });

  try {
    const res = await fetch(`/api/lyrics?${params.toString()}`);
    const data = await res.json();

    if (data.lyrics) {
      applyLyricsPayload(data);
    } else {
      renderLyrics("Paroles introuvables pour cette chanson.");
    }
  } catch (err) {
    renderLyrics('Erreur réseau, réessaie.');
  }
}

function updateFollowButton() {
  followButton.classList.toggle('hidden', !isSpotifyConnected());
  followButton.classList.toggle('following', autoFollowEnabled);
  followButton.textContent = autoFollowEnabled ? 'Suit Spotify ✓' : 'Suivre Spotify';
}

followButton.addEventListener('click', () => {
  autoFollowEnabled = !autoFollowEnabled;
  localStorage.setItem(AUTO_FOLLOW_KEY, autoFollowEnabled ? '1' : '0');
  updateFollowButton();
  if (autoFollowEnabled && playbackAnchor) followPlayingTrack(playbackAnchor);
});

syncOffsetDown.addEventListener('click', () => {
  setSyncOffsetMs(getSyncOffsetMs() - 100);
  activeLineIndex = -1;
});

syncOffsetUp.addEventListener('click', () => {
  setSyncOffsetMs(getSyncOffsetMs() + 100);
  activeLineIndex = -1;
});

/* ---------- init ---------- */

setSize(getSize());
renderRecents();
renderLibrary();
renderSyncOffsetLabel();
updateFollowButton();
input.focus();

(async () => {
  await handleSpotifyRedirect();
  updateSpotifyUI();
})();
