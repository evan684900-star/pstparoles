const axios = require('axios');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Requête vers une base de paroles. Une erreur passagère (limite de débit,
// panne, coupure) est retentée une fois ; si elle persiste, ctx.failed est
// levé : le "rien trouvé" qui en découle n'est alors pas fiable (le client
// peut réessayer, et la réponse n'est pas mise en cache). Un 404 n'est pas
// une erreur : la source n'a simplement pas la chanson.
async function httpGet(url, config, ctx, label) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await axios.get(url, config);
    } catch (err) {
      const status = err.response && err.response.status;
      const timedOut = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
      const transient = !status || status === 429 || status >= 500;
      if (transient && !timedOut && attempt === 0) {
        // Limite de débit : on attend ce que le serveur demande (Retry-After),
        // sans dépasser 2 s ; réessayer trop vite ne fait qu'aggraver.
        const retryAfter = Number(err.response && err.response.headers && err.response.headers['retry-after']);
        await sleep(status === 429 ? Math.min(2000, retryAfter > 0 ? retryAfter * 1000 : 1000) : 350);
        continue;
      }
      if (transient) {
        if (ctx) ctx.failed = true;
        console.warn(`${label} indisponible : ${status || err.code || err.message}`);
      }
      throw err;
    }
  }
}

// LRCLIB fournit aussi une version horodatée (syncedLyrics, format LRC) :
// c'est elle qui permet le surlignage ligne par ligne synchronisé avec
// la lecture Spotify.
function normalizeForMatch(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Genius écrit ses titres avec une typographie soignée (apostrophe ’,
// espaces insécables, caractères invisibles U+200B…) alors que les bases
// de paroles, alimentées depuis Spotify, utilisent l'apostrophe simple :
// "J’suis" ne trouvait pas "J'suis". On ramène tout au texte brut.
function tidyText(value) {
  return (value || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u02BC\u00B4`]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010\u2011]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Premier artiste d'un crédit groupé ("Damso & Hamza", "A, B", "A x B").
function primaryArtist(artist) {
  return (artist || '').split(/\s*(?:,|&|\+|\/|\bx\b|\bfeat\.?|\bft\.?|\bet\b|\band\b)\s*/i)[0].trim();
}

// Correspondance souple entre une ligne LRCLIB et la chanson demandée : la
// recherche floue de LRCLIB renvoie aussi des morceaux qui n'ont rien à voir,
// et afficher les paroles d'une autre chanson est pire que n'en afficher aucune.
function looseMatch(row, artist, title) {
  const t1 = normalizeForMatch(cleanQueryText(row.trackName));
  const t2 = normalizeForMatch(cleanQueryText(title));
  if (!t1 || !t2) return false;
  const titleOk = t1 === t2 || (Math.min(t1.length, t2.length) >= 4 && (t1.includes(t2) || t2.includes(t1)));
  if (!titleOk) return false;

  // "Nom (FRA)", "Nom [US]" : Genius précise parfois le pays entre parenthèses.
  const rowArtist = ` ${normalizeForMatch(cleanQueryText(row.artistName) || row.artistName)} `;
  const wanted = normalizeForMatch(cleanQueryText(primaryArtist(artist)) || artist);
  const full = normalizeForMatch(artist);
  return !!wanted && (rowArtist.includes(` ${wanted} `) || ` ${full} `.includes(rowArtist));
}

// duration (secondes, facultative) : celle du morceau qui joue sur Spotify.
// Elle départage les versions (album, radio edit, live...) : les horodatages
// d'une autre version seraient décalés.
// Versions retouchées d'un morceau : leurs horodatages ne collent pas à
// l'original. Écartées sauf si le titre demandé les mentionne lui-même.
const ALTERED_VERSION_RE = /\b(sped ?up|speed ?up|slowed|reverb|nightcore|remix|live|acoustic|acoustique|instrumental|karaoke|cover|8d)\b/i;

function isAlteredVersion(rowTitle, wantedTitle) {
  const found = (rowTitle || '').match(ALTERED_VERSION_RE);
  if (!found) return false;
  const word = found[1].toLowerCase().replace(/\s+/g, ' ?');
  return !new RegExp(`\\b${word}\\b`, 'i').test(wantedTitle || '');
}

function pickLrclibRow(rows, artist, title, duration) {
  const matching = rows.filter((r) => looseMatch(r, artist, title) && !isAlteredVersion(r.trackName, title));
  const gap = (r) => (duration && r.duration ? Math.abs(r.duration - duration) : 0);
  // Titre identique d'abord ("Chanson" avant "Chanson (Interlude)"), puis la
  // durée la plus proche.
  const wanted = normalizeForMatch(title);
  const inexact = (r) => (normalizeForMatch(r.trackName) === wanted ? 0 : 1);
  const synced = matching
    .filter((r) => r.plainLyrics && r.syncedLyrics)
    .sort((a, b) => inexact(a) - inexact(b) || gap(a) - gap(b));
  // On privilégie une correspondance qui a la version horodatée.
  const match = synced[0] || matching.find((r) => r.plainLyrics);
  if (match) {
    return { lyrics: match.plainLyrics.trim(), synced: (match.syncedLyrics || '').trim() || null };
  }
  if (rows.some((r) => r.instrumental && isSameTrack(r, artist, title))) return { instrumental: true };
  return null;
}

// LRCLIB marque les morceaux sans chant (instrumental: true). Sa recherche
// floue peut toutefois renvoyer la version instrumentale d'une chanson
// chantée ("Titre (Instrumental)") : on n'y croit que si titre et artiste
// correspondent exactement à ce qui est demandé.
function isSameTrack(row, artist, title) {
  return normalizeForMatch(row.trackName) === normalizeForMatch(title)
    && normalizeForMatch(row.artistName) === normalizeForMatch(artist);
}

// LRCLIB demande que chaque application s'identifie, et limite durement le
// débit des serveurs partagés (Vercel) : on se présente, et on garde en
// mémoire les réponses récentes pour ne pas redemander la même chose.
const LRCLIB_HEADERS = { 'User-Agent': 'pstparoles/1.0 (https://pstparoles.vercel.app)' };
const LRCLIB_MEMO_MS = 10 * 60 * 1000;
const lrclibMemo = new Map();

async function lrclibGet(path, params, ctx) {
  const key = `${path}?${new URLSearchParams(params)}`;
  const memo = lrclibMemo.get(key);
  if (memo && Date.now() - memo.at < LRCLIB_MEMO_MS) {
    if (memo.notFound) {
      const err = new Error('404');
      err.response = { status: 404 };
      throw err;
    }
    return memo.data;
  }
  const remember = (entry) => {
    lrclibMemo.set(key, { at: Date.now(), ...entry });
    if (lrclibMemo.size > 300) lrclibMemo.delete(lrclibMemo.keys().next().value);
  };
  try {
    const res = await httpGet(`https://lrclib.net${path}`, { params, headers: LRCLIB_HEADERS, timeout: 8000 }, ctx, 'LRCLIB');
    remember({ data: res.data });
    return res.data;
  } catch (err) {
    // Seul un "introuvable" est retenu : une panne doit pouvoir être retentée.
    if (err.response && err.response.status === 404) remember({ notFound: true });
    throw err;
  }
}

// Une à trois requêtes au plus (une seule le plus souvent) : la recherche
// par titre et artiste renvoie d'un coup toutes les fiches du morceau, avec
// et sans synchro. Avant, on pouvait en envoyer neuf, ce qui déclenchait la
// limite de débit de LRCLIB… et faisait perdre la synchro.
async function fetchLrclib(artist, title, ctx, duration) {
  const a = tidyText(artist);
  const t = tidyText(title);
  const mainArtist = primaryArtist(cleanQueryText(a) || a) || a;
  const cleanTitle = cleanQueryText(t) || t;

  let best = null;
  try {
    const rows = await lrclibGet('/api/search', { track_name: cleanTitle, artist_name: mainArtist }, ctx);
    best = pickLrclibRow(rows || [], a, t, duration);
  } catch (err) {
    // on tente la recherche plein texte
  }
  if (best && (best.synced || best.instrumental)) return best;

  // Recherche plein texte : plus tolérante à la ponctuation et à l'ordre des
  // mots, elle trouve souvent la fiche synchronisée que la première a ratée.
  try {
    const rows = await lrclibGet('/api/search', { q: `${mainArtist} ${cleanTitle}` }, ctx);
    const found = pickLrclibRow(rows || [], a, t, duration);
    if (found && (found.synced || found.instrumental)) return found;
    best = best || found;
  } catch (err) {
    // rien de plus
  }
  if (best) return best;

  // Correspondance exacte en dernier recours (fiches récentes que la
  // recherche ne connaît pas encore) : titre d'origine, puis titre nettoyé
  // s'il diffère et qu'on n'a pas encore de version synchronisée.
  const titles = cleanTitle !== t ? [t, cleanTitle] : [t];
  let plain = null;
  for (const trackName of titles) {
    try {
      const params = { artist_name: a, track_name: trackName };
      if (duration) params.duration = duration;
      const data = await lrclibGet('/api/get', params, ctx);
      const lyrics = (data.plainLyrics || '').trim();
      const synced = (data.syncedLyrics || '').trim();
      if (lyrics && synced) return { lyrics, synced };
      if (lyrics && !plain) plain = { lyrics, synced: null };
      else if (!lyrics && data.instrumental && isSameTrack(data, a, trackName)) return { instrumental: true };
    } catch (err) {
      // introuvable sous ce titre
    }
  }
  return plain;
}

async function fetchLyricsOvh(artist, title, ctx) {
  try {
    const res = await httpGet(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      { timeout: 6000 }, ctx, 'lyrics.ovh'
    );
    const lyrics = (res.data.lyrics || '').trim();
    return lyrics || null;
  } catch (err) {
    return null;
  }
}

async function fetchTextyl(artist, title, ctx) {
  try {
    const res = await httpGet('https://api.textyl.co/api/lyrics', {
      params: { q: `${artist} ${title}` },
      timeout: 6000,
    }, ctx, 'Textyl');
    const lines = res.data || [];
    const lyrics = lines
      .map((line) => line.lyrics)
      .filter(Boolean)
      .join('\n')
      .trim();
    return lyrics || null;
  } catch (err) {
    return null;
  }
}

async function fetchLyrist(artist, title, ctx) {
  try {
    const res = await httpGet(
      `https://lyrist.vercel.app/api/${encodeURIComponent(title)}/${encodeURIComponent(artist)}`,
      { timeout: 6000 }, ctx, 'Lyrist'
    );
    const lyrics = (res.data.lyrics || '').trim();
    return lyrics || null;
  } catch (err) {
    return null;
  }
}

function decodeXmlEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function fetchChartLyrics(artist, title, ctx) {
  try {
    const res = await httpGet('http://api.chartlyrics.com/apiv1.asmx/SearchLyricDirect', {
      params: { artist, song: title },
      timeout: 6000,
      responseType: 'text',
    }, ctx, 'ChartLyrics');
    const match = /<Lyric>([\s\S]*?)<\/Lyric>/i.exec(res.data);
    const lyrics = match ? decodeXmlEntities(match[1]).trim() : '';
    return lyrics || null;
  } catch (err) {
    return null;
  }
}

// Registre des sources, dans l'ordre de priorité par défaut.
const SOURCES = [
  { key: 'lrclib', fetch: fetchLrclib },
  { key: 'lyricsovh', fetch: fetchLyricsOvh },
  { key: 'textyl', fetch: fetchTextyl },
  { key: 'lyrist', fetch: fetchLyrist },
  { key: 'chartlyrics', fetch: fetchChartLyrics },
];
const ALL_SOURCE_KEYS = SOURCES.map((s) => s.key);

// Essaie les sources activées, dans l'ordre, jusqu'à en trouver une qui a les paroles.
// Une source renvoie soit une chaîne, soit { lyrics, synced } quand elle
// dispose aussi d'une version horodatée (seul LRCLIB pour l'instant).
async function fetchLyrics(artist, title, enabledKeys) {
  const enabled = enabledKeys && enabledKeys.length ? new Set(enabledKeys) : null;

  for (const { key, fetch } of SOURCES) {
    if (enabled && !enabled.has(key)) continue;
    const result = await fetch(artist, title);
    if (!result) continue;

    return shapeResult(result, key);
  }

  return null;
}

// Variantes d'écriture à essayer pour une chanson, de la plus fidèle à la
// plus nettoyée : texte d'origine, sans "(feat. X)"/"- Remastered", puis
// avec le seul premier artiste d'un crédit groupé.
function lyricsVariants(artist, title) {
  const a = tidyText(artist);
  const t = tidyText(title);
  const cleanA = cleanQueryText(a) || a;
  const cleanT = cleanQueryText(t) || t;
  const list = [
    { artist: a, title: t },
    { artist: cleanA, title: cleanT },
    { artist: primaryArtist(cleanA) || cleanA, title: cleanT },
  ];
  const seen = new Set();
  return list.filter((v) => {
    const key = `${v.artist}|${v.title}`;
    if (!v.artist || !v.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shapeResult(result, key) {
  if (typeof result === 'string') return { lyrics: result, synced: null, source: key };
  if (result.instrumental) return { instrumental: true, source: key };
  return { lyrics: result.lyrics, synced: result.synced || null, source: key };
}

// Comme fetchLyrics, mais en essayant toutes les variantes d'écriture.
// LRCLIB passe d'abord (seul à avoir la version synchronisée) sur toutes les
// variantes ; les autres sources ne sont interrogées qu'ensuite, en
// parallèle, et la première par ordre de priorité l'emporte.
// ctx.failed indique, si rien n'est trouvé, qu'une source était en panne.
// duration : durée en secondes du morceau qui joue (Spotify), si connue.
async function fetchLyricsAny(artist, title, enabledKeys, ctx = {}, duration = null) {
  const enabled = enabledKeys && enabledKeys.length ? new Set(enabledKeys) : null;
  const sources = SOURCES.filter(({ key }) => !enabled || enabled.has(key));
  const variants = lyricsVariants(artist, title);
  if (!variants.length) return null;

  const [first, ...others] = sources;
  if (first && first.key === 'lrclib') {
    // fetchLrclib nettoie lui-même titre et artiste (une seule série de
    // requêtes : LRCLIB limite durement le débit).
    const hit = await first.fetch(artist, title, ctx, duration);
    if (hit) return shapeResult(hit, first.key);
  } else if (first) {
    others.unshift(first);
  }

  const pending = others.map(({ key, fetch }) =>
    Promise.all(variants.map((v) => fetch(v.artist, v.title, ctx))).then((found) => {
      const hit = found.find(Boolean);
      return hit ? shapeResult(hit, key) : null;
    })
  );
  for (const p of pending) {
    const result = await p;
    if (result) return result;
  }
  return null;
}

// Ni LRCLIB ni lyrics.ovh n'ont de recherche floue robuste : on tente
// quelques découpages plausibles de "artiste titre".
async function guessLyrics(query, enabledKeys) {
  const candidates = [];

  if (query.includes(' - ')) {
    const [artist, ...rest] = query.split(' - ');
    candidates.push({ artist: artist.trim(), title: rest.join(' - ').trim() });
  }

  const words = query.trim().split(/\s+/);
  if (words.length >= 2) {
    candidates.push({ artist: words[0], title: words.slice(1).join(' ') });
    candidates.push({ artist: words.slice(0, -1).join(' '), title: words[words.length - 1] });
  }

  for (const { artist, title } of candidates) {
    if (!artist || !title) continue;
    const result = await fetchLyrics(artist, title, enabledKeys);
    if (result) {
      return { artist, title, ...result };
    }
  }
  return null;
}

// Genius formate ses titres/artistes avec du "bruit" que les bases de
// paroles n'ont pas : "(Remastered 2011)", "- Live", "(feat. X)"... Alors
// qu'un titre venu de Spotify (via "Suivre Spotify") est déjà propre et
// trouve bien plus souvent une correspondance. On nettoie donc le texte
// avant une éventuelle deuxième tentative.
function cleanQueryText(text) {
  return (text || '')
    .replace(/\s*[([][^()[\]]*[)\]]/g, ' ') // (Remastered 2011), [Live], (feat. X)
    .replace(/\s[-–—]\s.*$/, ' ') // "- Remastered 2011", "- Live", "- Radio Edit"
    .replace(/\b(feat\.?|ft\.?|featuring|with)\b.*$/i, ' ') // "feat. X" sans parenthèses
    .replace(/\s+/g, ' ')
    .trim();
}

// Recherche plein texte de LRCLIB (titre, artiste ou album). Contrairement à
// Genius, LRCLIB référence aussi les morceaux instrumentaux.
// Renvoie null si LRCLIB est en panne (à distinguer d'une liste vide).
async function searchLrclib(query) {
  try {
    const res = await httpGet('https://lrclib.net/api/search', { params: { q: query }, timeout: 8000 }, null, 'LRCLIB');
    return (res.data || [])
      .filter((r) => r.trackName && r.artistName)
      .map((r) => ({
        source: 'lrclib',
        title: r.trackName,
        artist: r.artistName,
        thumbnail: null,
        instrumental: r.instrumental === true,
      }));
  } catch (err) {
    return null;
  }
}

module.exports = { clearLrclibMemo: () => lrclibMemo.clear(), looseMatchSong: (a, b) => looseMatch({ trackName: a.title, artistName: a.artist }, b.artist, b.title), httpGet, fetchLyrics, fetchLyricsAny, tidyText, primaryArtist, looseMatch, guessLyrics, searchLrclib, normalizeForMatch, ALL_SOURCE_KEYS, cleanQueryText };
