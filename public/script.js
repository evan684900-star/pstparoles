const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const lyricsView = document.getElementById('lyrics-view');
const lyricsTitle = document.getElementById('lyrics-title');
const lyricsContent = document.getElementById('lyrics-content');
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
  } catch (err) {
    setStatus('Erreur réseau, réessaie.');
  }
});

function renderResults(results) {
  resultsEl.innerHTML = '';
  for (const song of results) {
    const li = document.createElement('li');
    const sourceLabel = song.source === 'lyricsovh' ? 'lyrics.ovh' : 'Genius';
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

async function loadLyrics(song) {
  setStatus('');
  lyricsTitle.textContent = `${song.title} — ${song.artist}`;
  showLyricsView();

  // Le repli lyrics.ovh renvoie déjà les paroles directement lors de la recherche.
  if (song.source === 'lyricsovh' && song.lyrics) {
    lyricsContent.textContent = song.lyrics;
    return;
  }

  lyricsContent.textContent = 'Chargement des paroles...';

  const params = new URLSearchParams();
  if (song.url) params.set('url', song.url);
  params.set('artist', song.artist);
  params.set('title', song.title);

  try {
    const res = await fetch(`/api/lyrics?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      lyricsContent.textContent = data.error || 'Erreur lors du chargement des paroles.';
      return;
    }

    lyricsContent.textContent = data.lyrics;
  } catch (err) {
    lyricsContent.textContent = 'Erreur réseau, réessaie.';
  }
}

backButton.addEventListener('click', showResults);
