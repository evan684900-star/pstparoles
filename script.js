const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const lyricsView = document.getElementById('lyrics-view');
const lyricsTitle = document.getElementById('lyrics-title');
const lyricsContent = document.getElementById('lyrics-content');
const lyricsLink = document.getElementById('lyrics-link');
const backButton = document.getElementById('back-button');

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
