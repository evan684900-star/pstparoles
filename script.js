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
const cardButton = document.getElementById('card-button');
const concertButton = document.getElementById('concert-button');
const concertBar = document.getElementById('concert-bar');
const concertTitle = document.getElementById('concert-title');
const concertArtist = document.getElementById('concert-artist');
const concertExit = document.getElementById('concert-exit');
const pickBar = document.getElementById('pick-bar');
const pickHint = document.getElementById('pick-hint');
const pickCancel = document.getElementById('pick-cancel');
const pickGo = document.getElementById('pick-go');
const cardModal = document.getElementById('card-modal');
const cardPreview = document.getElementById('card-preview');
const cardClose = document.getElementById('card-close');
const cardDownload = document.getElementById('card-download');
const cardShare = document.getElementById('card-share');
const copyButton = document.getElementById('copy-button');
const shareButton = document.getElementById('share-button');
const halo = document.getElementById('halo');
const sizeLabel = document.getElementById('size-label');
const lyricsLink = document.getElementById('lyrics-link');

const spotifyNowPlayingBtn = document.getElementById('spotify-now-playing');
const spotifyConnectHomeBtn = document.getElementById('spotify-connect-home');
const settingsSpotifyConnect = document.getElementById('settings-spotify-connect');
const spotifyConnectSettingsBtn = document.getElementById('spotify-connect-settings');
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
const spotifyAccountLabel = document.getElementById('spotify-account-label');

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
  if (container === lyricsCover) updateVinylColor(song);
}

/* ---------- couleur du vinyle = couleur dominante de la pochette ---------- */

const vinylColorCache = new Map();
let vinylColorToken = 0;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// La couleur qui couvre le plus de surface. Les pixels quasi noirs sont
// écartés : une étiquette noire disparaîtrait sur le disque noir. Les pixels
// sont regroupés par teintes proches (16 niveaux par canal), puis on moyenne
// le groupe gagnant pour retrouver une couleur réelle de la pochette.
function dominantColorOf(img) {
  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);

  let data;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch (err) {
    return null;
  }

  const buckets = new Map();
  const tally = (skipDark) => {
    buckets.clear();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (skipDark && 0.299 * r + 0.587 * g + 0.114 * b < 40) continue;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      bucket.n++; bucket.r += r; bucket.g += g; bucket.b += b;
      buckets.set(key, bucket);
    }
  };

  tally(true);
  if (!buckets.size) tally(false); // pochette entièrement sombre

  let best = null;
  for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket;
  if (!best) return null;

  let r = best.r / best.n, g = best.g / best.n, b = best.b / best.n;
  // Une couleur très sombre se verrait à peine sur le vinyle : on l'éclaircit un peu.
  if (0.299 * r + 0.587 * g + 0.114 * b < 60) {
    r += (255 - r) * 0.22; g += (255 - g) * 0.22; b += (255 - b) * 0.22;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

async function updateVinylColor(song) {
  const token = ++vinylColorToken;
  // En attendant (ou sans pochette) : la teinte propre à la chanson.
  vinylSlot.style.setProperty('--vinyl', hueOf(song.title + song.artist));
  if (!song.thumbnail) return;

  let color = vinylColorCache.get(song.thumbnail);
  if (!color) {
    // Via notre domaine : le navigateur n'autorise la lecture des pixels
    // d'une image que si elle vient de la même origine (ou envoie du CORS).
    const img = await loadImage(`/api/cover?url=${encodeURIComponent(song.thumbnail)}`);
    color = img ? dominantColorOf(img) : null;
    if (color) vinylColorCache.set(song.thumbnail, color);
  }
  if (color && token === vinylColorToken) vinylSlot.style.setProperty('--vinyl', color);
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
  exitConcertMode();
  exitPickMode();
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
  releaseWakeLock();
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
  requestWakeLock();
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
  cardButton.classList.remove('hidden');
  concertButton.classList.remove('hidden');
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
  cardButton.classList.remove('hidden');
  concertButton.classList.remove('hidden');
  updateSaveButtonState();
}

// Revient au texte d'origine, en réactivant le surlignage si disponible.
function restoreOriginalLyrics() {
  if (currentSyncedLines.length) renderSyncedLyrics(currentSyncedLines);
  else renderLyrics(originalLyricsText);
}

// Morceau sans chant : les sources le signalent explicitement.
let currentInstrumental = false;

// Onde sinusoïdale faite de demi-arches (Q puis T répétés) : chaque "T"
// prolonge la courbe en miroir, ce qui donne une vague parfaitement lisse.
function wavePath(amplitude, period, length, mid) {
  let d = `M0 ${mid} Q${period / 4} ${mid - amplitude} ${period / 2} ${mid}`;
  for (let x = period; x <= length; x += period / 2) d += ` T${x} ${mid}`;
  return d;
}

// Filament musical : trois fils dorés qui ondulent en décalé, avec une
// lueur et quelques étincelles. Les vagues sont deux fois plus longues que
// le cadre et glissent d'une période exacte : la boucle ne saute jamais.
function musicFilamentSvg() {
  const strands = [
    { a: 9, p: 80, w: 2.2, o: 1, dur: 3.2 },
    { a: 6, p: 60, w: 1.4, o: 0.6, dur: 2.4 },
    { a: 12, p: 120, w: 1, o: 0.4, dur: 4.6 },
  ];
  const sparkles = [[38, 18], [92, 44], [150, 14], [196, 40], [66, 40], [172, 26]];
  return `
    <svg class="filament" viewBox="0 0 240 60" aria-hidden="true">
      <defs>
        <linearGradient id="filament-fade" x1="0" x2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0" />
          <stop offset=".2" stop-color="#fff" stop-opacity="1" />
          <stop offset=".8" stop-color="#fff" stop-opacity="1" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <mask id="filament-mask"><rect width="240" height="60" fill="url(#filament-fade)" /></mask>
        <filter id="filament-glow" x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g mask="url(#filament-mask)" filter="url(#filament-glow)">
        ${strands.map((st, i) => `
          <path class="filament-strand" d="${wavePath(st.a, st.p, 240 + st.p * 2, 30)}"
            stroke-width="${st.w}" opacity="${st.o}"
            style="--period:${st.p}px;animation-duration:${st.dur}s;animation-delay:-${i * 0.7}s" />`).join('')}
      </g>
      ${sparkles.map(([x, y], i) => `
        <circle class="filament-spark" cx="${x}" cy="${y}" r="${i % 2 ? 1.1 : 1.6}"
          style="animation-delay:${(i * 0.53).toFixed(2)}s" />`).join('')}
    </svg>`;
}

function showInstrumental() {
  renderLyrics('');
  currentInstrumental = true;
  lyricsContent.innerHTML = `
    <div class="instrumental">
      ${musicFilamentSvg()}
      <p class="instrumental-title">Morceau instrumental</p>
      <p class="instrumental-sub">Pas de paroles ici, laisse juste la musique se jouer…</p>
    </div>`;
  updateSyncBar();
}

function hideLyricsExtras() {
  currentInstrumental = false;
  translateControl.classList.add('hidden');
  saveButton.classList.add('hidden');
  cardButton.classList.add('hidden');
  concertButton.classList.add('hidden');
  exitPickMode();
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

    if (data.instrumental) {
      showInstrumental();
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

/* ---------- cache des traductions ---------- */

// Traduire prend plusieurs secondes : on garde le résultat pour que
// retraduire la même chanson dans la même langue soit instantané.
const TRANSLATION_CACHE_KEY = 'pst-translations';
const TRANSLATION_CACHE_MAX = 40;

function translationCacheKey(song, target) {
  return `${song.artist}|${song.title}|${target}`.toLowerCase();
}

function readTranslationCache() {
  try {
    return JSON.parse(localStorage.getItem(TRANSLATION_CACHE_KEY) || '{}');
  } catch (err) {
    return {};
  }
}

function getCachedTranslation(song, target) {
  if (!song) return null;
  return readTranslationCache()[translationCacheKey(song, target)] || null;
}

function cacheTranslation(song, target, value) {
  if (!song) return;
  try {
    const cache = readTranslationCache();
    cache[translationCacheKey(song, target)] = value;
    // localStorage est petit et des paroles traduites sont volumineuses :
    // on ne garde que les dernières entrées.
    const keys = Object.keys(cache);
    for (const key of keys.slice(0, Math.max(0, keys.length - TRANSLATION_CACHE_MAX))) {
      delete cache[key];
    }
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    // quota dépassé : le cache n'est qu'un confort, on continue sans
  }
}

// Une traduction synchronisée est un tableau (une entrée par ligne
// horodatée) ; une traduction simple est une chaîne.
function applyTranslation(value, synced) {
  if (synced && Array.isArray(value)) {
    renderSyncedLyrics(currentSyncedLines, value);
    return true;
  }
  if (!synced && typeof value === 'string') {
    renderLyrics(value);
    return true;
  }
  return false;
}

translateSelect.addEventListener('change', async () => {
  const target = translateSelect.value;
  if (!target) {
    restoreOriginalLyrics();
    translateResetBtn.classList.add('hidden');
    return;
  }

  const synced = currentSyncedLines.length > 0;

  if (applyTranslation(getCachedTranslation(currentSong, target), synced)) {
    translateResetBtn.classList.remove('hidden');
    setStatus('');
    return;
  }

  // On laisse les paroles affichées pendant la traduction : les effacer
  // détruirait les lignes synchronisées (et leur surlignage en cours).
  setStatus('Traduction en cours…');
  translateSelect.disabled = true;

  try {
    // En mode synchronisé, la source doit être les lignes horodatées :
    // le texte brut de la chanson n'a pas forcément le même découpage.
    const sourceText = synced
      ? currentSyncedLines.map((l) => l.text).join('\n')
      : originalLyricsText;

    const params = new URLSearchParams({ text: sourceText, target });
    if (synced) params.set('lines', '1');

    const res = await fetch(`/api/translate?${params.toString()}`);
    const data = await res.json();

    const value = synced ? data.lines : data.translated;
    if (!res.ok || !applyTranslation(value, synced)) {
      setStatus(data.error || 'Traduction indisponible pour le moment.', true);
      translateSelect.value = '';
      return;
    }

    cacheTranslation(currentSong, target, value);
    setStatus('');
    translateResetBtn.classList.remove('hidden');
  } catch (err) {
    setStatus('Erreur réseau, réessaie.', true);
    translateSelect.value = '';
  } finally {
    translateSelect.disabled = false;
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
  if (e.key !== 'Escape') return;
  closeLibraryPanel();
  closeSettingsPanel();

  // On ferme la couche la plus haute en premier, une seule par appui.
  if (cardModal.classList.contains('open')) { closeCardModal(); return; }
  if (!coverLightbox.classList.contains('open') && lyricsContent.classList.contains('picking')) { exitPickMode(); return; }
  closeCoverLightbox();
  exitConcertMode();
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
  localStorage.setItem('spotify_verifier', verifier);
  localStorage.setItem('spotify_state', state);

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
  localStorage.removeItem('spotify_display_name');
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
  if (!code) {
    // L'utilisateur a refusé l'accès, ou Spotify a renvoyé une erreur.
    if (params.get('error') && params.has('state')) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setStatus('Connexion à Spotify annulée.', true);
    }
    return;
  }

  window.history.replaceState({}, document.title, window.location.pathname);

  const expectedState = localStorage.getItem('spotify_state');
  const verifier = localStorage.getItem('spotify_verifier');
  if (!verifier || state !== expectedState) {
    // Typiquement : la connexion a démarré dans l'appli installée mais est
    // revenue dans Safari (ou l'inverse), qui n'ont pas le même stockage.
    setStatus("La connexion à Spotify n'a pas pu se terminer ici. Réessaie depuis cet écran, sans changer d'appli entre-temps.", true);
    return;
  }

  const clientId = await getSpotifyClientId();
  if (!clientId) {
    setStatus("Spotify n'est pas configuré sur ce site pour le moment.", true);
    return;
  }

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
    setStatus("La connexion à Spotify a échoué, réessaie.", true);
  } finally {
    localStorage.removeItem('spotify_verifier');
    localStorage.removeItem('spotify_state');
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

// Pourquoi le dernier appel n'a rien renvoyé : permet d'afficher une vraie
// explication plutôt qu'un "aucune lecture" qui ne dit rien de la cause.
let lastPlaybackIssue = null;

function playbackIssueMessage() {
  const issue = lastPlaybackIssue || {};
  switch (issue.kind) {
    case 'nothing':
      return "Spotify ne signale aucune lecture en cours"
        + (spotifyAccountName() ? ` sur le compte « ${spotifyAccountName()} »` : '')
        + ". Vérifie que l'appli Spotify joue bien sur ce compte (et pas un autre), hors session privée, puis réessaie.";
    case 'unsupported':
      return "Ce que tu écoutes (podcast ou publicité) n'a pas de paroles.";
    case 'expired':
      return 'Ta session Spotify a expiré : reconnecte-toi (réglages, Compte Spotify).';
    case 'forbidden':
      return "Spotify refuse l'accès" + (issue.detail ? ` (« ${issue.detail} »)` : '') + ". Vérifie que l'e-mail de ton compte est dans User Management du tableau de bord développeur Spotify, puis déconnecte-toi et reconnecte-toi pour redonner les permissions.";
    case 'rate':
      return 'Spotify limite les requêtes pour le moment, réessaie dans quelques secondes.';
    case 'network':
      return 'Erreur réseau, réessaie.';
    default:
      return issue.status ? `Spotify a répondu une erreur (${issue.status}).` : "Impossible de lire l'état de Spotify.";
  }
}

async function fetchPlaybackState() {
  lastPlaybackIssue = null;
  let token;
  try {
    token = await getValidSpotifyToken();
  } catch (err) {
    lastPlaybackIssue = { kind: 'network' };
    return null;
  }
  if (!token) {
    lastPlaybackIssue = { kind: 'expired' };
    return null;
  }

  // On mesure l'aller-retour réseau : la position renvoyée correspond au
  // moment où Spotify a traité la requête, donc quelque part entre l'envoi
  // et la réception. On compense avec la moitié du temps de trajet.
  const request = (tok) => fetch('https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode', {
    headers: { Authorization: `Bearer ${tok}` },
  });
  let sentAt = performance.now();
  let res;
  try {
    res = await request(token);
    if (res.status === 401) {
      // Jeton refusé alors qu'il paraissait valide (révoqué, horloge...) : un renouvellement, puis on réessaie.
      const fresh = await refreshSpotifyToken();
      if (fresh) {
        sentAt = performance.now();
        res = await request(fresh);
      }
    }
  } catch (err) {
    lastPlaybackIssue = { kind: 'network' };
    return null;
  }
  const receivedAt = performance.now();

  if (res.status === 204) {
    lastPlaybackIssue = { kind: 'nothing' };
    return null;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = ((await res.json()).error || {}).message || ''; } catch (err) { /* corps vide */ }
    console.error('Spotify currently-playing:', res.status, detail);
    lastPlaybackIssue = {
      kind: res.status === 401 ? 'expired' : res.status === 403 ? 'forbidden' : res.status === 429 ? 'rate' : 'other',
      status: res.status,
      detail,
    };
    return null;
  }

  const data = await res.json();
  if (!data || !data.item) {
    lastPlaybackIssue = { kind: 'nothing' };
    return null;
  }
  // Podcasts et publicités n'ont pas d'artistes ni de paroles.
  if (!Array.isArray(data.item.artists)) {
    lastPlaybackIssue = { kind: 'unsupported' };
    return null;
  }

  const latencyCompensationMs = (receivedAt - sentAt) / 2;

  return {
    title: data.item.name,
    artist: data.item.artists.map((a) => a.name).join(', '),
    progressMs: (data.progress_ms || 0) + latencyCompensationMs,
    durationMs: data.item.duration_ms || 0,
    coverUrl: (data.item.album && data.item.album.images && data.item.album.images[0] && data.item.album.images[0].url) || null,
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

// Nom du compte Spotify connecté : permet de repérer qu'on est connecté à un
// autre compte que celui qui joue la musique (ex. après un changement d'e-mail).
function spotifyAccountName() {
  return localStorage.getItem('spotify_display_name') || '';
}

function renderSpotifyAccountLabel() {
  const name = spotifyAccountName();
  spotifyAccountLabel.textContent = name ? `Connecté en tant que « ${name} »` : '';
  spotifyAccountLabel.classList.toggle('hidden', !name);
}

async function loadSpotifyProfile() {
  if (!isSpotifyConnected() || spotifyAccountName()) return;
  try {
    const token = await getValidSpotifyToken();
    if (!token) return;
    const res = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const me = await res.json();
    const name = me.display_name || me.id;
    if (name) localStorage.setItem('spotify_display_name', name);
    renderSpotifyAccountLabel();
  } catch (err) {
    // simple confort d'affichage : on réessaiera au prochain démarrage
  }
}

function updateSpotifyUI() {
  // Un point d'entrée Spotify reste toujours visible : "En écoute" quand on
  // est connecté, "Connecter Spotify" sinon (sur iPhone, l'appli installée et
  // Safari ont chacun leur propre connexion).
  spotifyNowPlayingBtn.classList.toggle('hidden', !isSpotifyConnected());
  spotifyConnectHomeBtn.classList.toggle('hidden', isSpotifyConnected());
  settingsSpotifyAccount.classList.toggle('hidden', !isSpotifyConnected());
  settingsSpotifyConnect.classList.toggle('hidden', isSpotifyConnected());
  renderSpotifyAccountLabel();
  loadSpotifyProfile();
  updateSpotifyBanner();
  updateFollowButton();
  if (!isSpotifyConnected()) stopSpotifyProgressTracking();
}

spotifyDisconnectBtn.addEventListener('click', () => {
  disconnectSpotify();
  closeSettingsPanel();
});

spotifyConnectBtn.addEventListener('click', connectSpotify);
spotifyConnectHomeBtn.addEventListener('click', connectSpotify);
spotifyConnectSettingsBtn.addEventListener('click', () => { closeSettingsPanel(); connectSpotify(); });

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
      setStatus(playbackIssueMessage(), true);
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
    syncStatus.textContent = currentInstrumental
      ? 'Morceau instrumental : pas de paroles à suivre'
      : 'Pas de paroles synchronisées pour cette chanson';
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

// `translations` est facultatif : quand il est fourni (une entrée par
// ligne), la traduction s'affiche sous l'originale, en gardant les mêmes
// horodatages donc le même surlignage.
function renderSyncedLyrics(lines, translations) {
  syncedLines = lines;
  syncedLineEls = [];
  activeLineIndex = -1;
  lyricsContent.innerHTML = '';
  lyricsContent.classList.toggle('bilingual', Boolean(translations));

  lines.forEach((line, i) => {
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
      // Le texte d'origine reste accessible séparément : la carte de
      // citation ne doit pas ramasser la traduction avec.
      p.dataset.original = text;

      const translated = translations && translations[i] ? translations[i].trim() : '';
      if (translated && translated !== text) {
        const tr = document.createElement('span');
        tr.className = 'lyr-tr';
        tr.textContent = translated;
        p.appendChild(tr);
      }
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
  lyricsContent.classList.remove('synced', 'bilingual');
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
  currentSong = { artist: primaryArtist, title: state.title, thumbnail: state.coverUrl || null, id: null };

  lyricsTitle.textContent = state.title;
  lyricsArtist.innerHTML = `${state.artist} · <em>Spotify</em>`;
  setCover(lyricsCover, { title: state.title, artist: primaryArtist, thumbnail: state.coverUrl || null });
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
    } else if (data.instrumental) {
      showInstrumental();
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

/* ---------- écran toujours allumé ---------- */

let wakeLock = null;

// Tant que la vue paroles est ouverte, l'écran ne se met pas en veille (on
// lit ou on chante sans toucher le téléphone). Le navigateur peut refuser
// (batterie faible, API absente) : ce n'est jamais bloquant.
async function requestWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock || document.hidden) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (err) {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  if (!wakeLock) return;
  wakeLock.release().catch(() => {});
  wakeLock = null;
}

/* ---------- mode concert (plein écran) ---------- */

function inConcertMode() {
  return document.body.classList.contains('concert');
}

function enterConcertMode() {
  if (!currentSong || inConcertMode()) return;
  exitPickMode();

  document.body.classList.add('concert');
  concertTitle.textContent = currentSong.title;
  concertArtist.textContent = currentSong.artist;

  // Le plein écran natif n'existe pas sur iOS Safari : le mode CSS tient
  // debout tout seul, donc un refus n'empêche rien.
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }

  // La mise en page vient de changer : on recentre la ligne en cours sans
  // attendre le prochain changement de ligne.
  lastManualScrollAt = 0;
  setTimeout(recenterActiveLine, 120);
}

function exitConcertMode() {
  if (!inConcertMode()) return;
  document.body.classList.remove('concert');

  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }

  lastManualScrollAt = 0;
  setTimeout(recenterActiveLine, 120);
}

function recenterActiveLine() {
  const el = syncedLineEls[activeLineIndex];
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

concertButton.addEventListener('click', enterConcertMode);
concertExit.addEventListener('click', exitConcertMode);

// Sortie du plein écran natif (touche Échap du navigateur, geste système) :
// on quitte aussi le mode concert pour rester cohérent.
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && inConcertMode()) exitConcertMode();
});

// Le verrou saute dès que l'onglet passe en arrière-plan : on le reprend au retour.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !lyricsView.hidden) requestWakeLock();
});

/* ---------- carte de citation ---------- */

const MAX_PICKED_LINES = 4;
const CARD_W = 1080;
const CARD_H = 1350;

let cardBlob = null;
let cardObjectUrl = null;

function pickedEls() {
  return Array.from(lyricsContent.querySelectorAll('p.picked'));
}

function updatePickBar() {
  const n = pickedEls().length;
  pickGo.disabled = n === 0;
  pickGo.textContent = n ? `Créer la carte (${n})` : 'Créer la carte';
  pickHint.textContent = n >= MAX_PICKED_LINES
    ? `Maximum ${MAX_PICKED_LINES} lignes`
    : `Choisis jusqu'à ${MAX_PICKED_LINES} lignes`;
}

function enterPickMode() {
  if (!currentLyrics.trim()) return;
  exitConcertMode();
  lyricsContent.classList.add('picking');
  pickBar.classList.add('open');
  updatePickBar();
}

function exitPickMode() {
  lyricsContent.classList.remove('picking');
  pickBar.classList.remove('open');
  for (const el of pickedEls()) el.classList.remove('picked');
}

cardButton.addEventListener('click', () => {
  if (lyricsContent.classList.contains('picking')) exitPickMode();
  else enterPickMode();
});

pickCancel.addEventListener('click', exitPickMode);

lyricsContent.addEventListener('click', (e) => {
  if (!lyricsContent.classList.contains('picking')) return;
  const p = e.target.closest('p');
  if (!p || p.classList.contains('blank') || !lyricsContent.contains(p)) return;

  if (p.classList.contains('picked')) {
    p.classList.remove('picked');
  } else {
    if (pickedEls().length >= MAX_PICKED_LINES) {
      updatePickBar();
      return;
    }
    p.classList.add('picked');
  }
  updatePickBar();
});

// Charge la pochette sans "tainter" le canvas : si l'hébergeur ne renvoie
// pas d'en-tête CORS, on retombe simplement sur la tuile à initiales.
function loadImageForCanvas(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLine(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (current && ctx.measureText(test).width > maxWidth) {
      out.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) out.push(current);
  return out.length ? out : [''];
}

async function buildQuoteCard(lines, song) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  const tint = hueOf(song.title + song.artist);

  // Les polices doivent être prêtes avant de mesurer/dessiner du texte.
  try {
    await Promise.all([
      document.fonts.load('400 64px "Instrument Serif"'),
      document.fonts.load('600 30px "Space Grotesk"'),
      document.fonts.load('400 24px "JetBrains Mono"'),
    ]);
  } catch (err) {
    // polices indisponibles : on dessine avec les polices de secours
  }

  // Fond + halo, comme sur le site.
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const halo = ctx.createRadialGradient(CARD_W / 2, 90, 0, CARD_W / 2, 90, 760);
  halo.addColorStop(0, tint);
  halo.addColorStop(1, 'rgba(10,10,12,0)');
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, CARD_W, 900);
  ctx.globalAlpha = 1;

  // --- en-tête : pochette + titre / artiste ---
  const pad = 88;
  const coverSize = 150;
  const coverY = 96;

  const img = await loadImageForCanvas(song.thumbnail);
  ctx.save();
  roundRectPath(ctx, pad, coverY, coverSize, coverSize, 22);
  ctx.clip();
  if (img) {
    // équivalent de object-fit: cover
    const scale = Math.max(coverSize / img.width, coverSize / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, pad + (coverSize - dw) / 2, coverY + (coverSize - dh) / 2, dw, dh);
  } else {
    const grad = ctx.createLinearGradient(pad, coverY, pad + coverSize, coverY + coverSize);
    grad.addColorStop(0, tint);
    grad.addColorStop(1, '#0a0a0c');
    ctx.fillStyle = grad;
    ctx.fillRect(pad, coverY, coverSize, coverSize);
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.font = '400 62px "Instrument Serif", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(song.artist), pad + coverSize / 2, coverY + coverSize / 2);
  }
  ctx.restore();

  const textX = pad + coverSize + 34;
  const maxMetaW = CARD_W - textX - pad;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#f2f0ec';
  ctx.font = '400 48px "Instrument Serif", Georgia, serif';
  const titleLines = wrapLine(ctx, song.title, maxMetaW).slice(0, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, textX, coverY + 58 + i * 54));

  ctx.fillStyle = '#8e8d98';
  ctx.font = '500 28px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText(wrapLine(ctx, song.artist, maxMetaW)[0], textX, coverY + 62 + titleLines.length * 54);

  // --- bloc de citation, centré et dimensionné pour tenir ---
  const quoteTop = 360;
  const quoteBottom = CARD_H - 190;
  const maxQuoteW = CARD_W - pad * 2;
  const maxQuoteH = quoteBottom - quoteTop;

  let fontSize = 66;
  let wrapped = [];
  for (; fontSize >= 28; fontSize -= 2) {
    ctx.font = `400 ${fontSize}px "Instrument Serif", Georgia, serif`;
    wrapped = [];
    for (const line of lines) wrapped.push(...wrapLine(ctx, line, maxQuoteW));
    if (wrapped.length * fontSize * 1.42 <= maxQuoteH) break;
  }

  const lineHeight = fontSize * 1.42;
  const blockH = wrapped.length * lineHeight;
  let y = quoteTop + (maxQuoteH - blockH) / 2 + fontSize;

  // petit trait d'accent au-dessus de la citation
  ctx.fillStyle = tint;
  ctx.fillRect(pad, y - fontSize - 52, 72, 5);

  ctx.fillStyle = '#f2f0ec';
  ctx.font = `400 ${fontSize}px "Instrument Serif", Georgia, serif`;
  for (const l of wrapped) {
    ctx.fillText(l, pad, y);
    y += lineHeight;
  }

  // --- pied de carte ---
  ctx.fillStyle = 'rgba(255,255,255,.1)';
  ctx.fillRect(pad, CARD_H - 132, CARD_W - pad * 2, 1);

  ctx.fillStyle = '#63626c';
  ctx.font = '400 26px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText('pstparoles', pad, CARD_H - 78);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function cardFileName(song) {
  const base = `${song.artist}-${song.title}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `pstparoles-${base || 'citation'}.png`;
}

async function generateCard() {
  const lines = pickedEls().map((el) => (el.dataset.original || el.textContent).trim()).filter(Boolean);
  if (!lines.length || !currentSong) return;

  pickGo.disabled = true;
  pickGo.textContent = 'Création…';

  try {
    cardBlob = await buildQuoteCard(lines, currentSong);
    if (!cardBlob) throw new Error('canvas vide');

    if (cardObjectUrl) URL.revokeObjectURL(cardObjectUrl);
    cardObjectUrl = URL.createObjectURL(cardBlob);
    cardPreview.src = cardObjectUrl;

    // Le partage de fichier n'existe pas partout : on n'affiche le bouton
    // que si le navigateur sait réellement partager cette image.
    const file = new File([cardBlob], cardFileName(currentSong), { type: 'image/png' });
    const canShareFile = Boolean(navigator.canShare && navigator.canShare({ files: [file] }));
    cardShare.classList.toggle('hidden', !canShareFile);

    exitPickMode();
    cardModal.classList.add('open');
  } catch (err) {
    setStatus("Impossible de créer la carte pour cette chanson.", true);
  } finally {
    updatePickBar();
  }
}

pickGo.addEventListener('click', generateCard);

function closeCardModal() {
  cardModal.classList.remove('open');
}

cardClose.addEventListener('click', closeCardModal);
cardModal.addEventListener('click', (e) => {
  if (e.target === cardModal) closeCardModal();
});

cardDownload.addEventListener('click', () => {
  if (!cardObjectUrl) return;
  const a = document.createElement('a');
  a.href = cardObjectUrl;
  a.download = cardFileName(currentSong || { artist: '', title: '' });
  a.click();
});

cardShare.addEventListener('click', async () => {
  if (!cardBlob || !currentSong) return;
  const file = new File([cardBlob], cardFileName(currentSong), { type: 'image/png' });
  try {
    await navigator.share({ files: [file], title: `${currentSong.title} — ${currentSong.artist}` });
  } catch (err) {
    // partage annulé par l'utilisateur : rien à signaler
  }
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
  openSharedLink();
})();

// "Partager" vers le site installé (Android) : le lien ou le texte partagé
// arrive dans l'adresse (?q=... ou ?url=...), et on lance la recherche.
function openSharedLink() {
  const params = new URLSearchParams(window.location.search);
  const shared = params.get('url') || params.get('q');
  if (!shared) return;
  window.history.replaceState({}, document.title, window.location.pathname);
  const link = (shared.match(/https?:\/\/\S+/) || [])[0];
  const query = link && YOUTUBE_URL_RE.test(link) ? link : shared;
  input.value = query;
  runSearch(query);
}
