package com.pstparoles.app.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.pstparoles.app.card.QuoteCardRenderer
import com.pstparoles.app.core.LrcLine
import com.pstparoles.app.core.PlaybackState
import com.pstparoles.app.core.firstUrlIn
import com.pstparoles.app.core.isYoutubeUrl
import com.pstparoles.app.core.parseLrc
import com.pstparoles.app.core.parseYoutubeTitle
import com.pstparoles.app.core.tracksMatch
import com.pstparoles.app.core.translationCacheKey
import com.pstparoles.app.data.ALL_SOURCE_KEYS
import com.pstparoles.app.data.CachedTranslation
import com.pstparoles.app.data.LibraryItem
import com.pstparoles.app.data.LyricsResponse
import com.pstparoles.app.data.Prefs
import com.pstparoles.app.data.PstApi
import com.pstparoles.app.data.SearchResult
import com.pstparoles.app.data.Song
import com.pstparoles.app.spotify.SpotifyRepo
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File
import java.util.Locale

enum class Screen { Home, Lyrics }

/** Ce qu'affiche la zone des paroles. */
sealed interface LyricsContent {
    data object None : LyricsContent
    data class Loading(val message: String = "Chargement des paroles…") : LyricsContent
    data class Plain(val text: String) : LyricsContent
    /** [translations] : une traduction par ligne horodatée (affichage bilingue), ou null. */
    data class Synced(val lines: List<LrcLine>, val translations: List<String>? = null) : LyricsContent
    data class Embed(val html: String, val geniusUrl: String?) : LyricsContent
    data class Message(val text: String, val geniusUrl: String? = null) : LyricsContent
}

enum class SyncBarState { Hidden, Unavailable, Synced, Paused }

class MainViewModel(app: Application) : AndroidViewModel(app) {

    private val prefs = Prefs(app)
    private val api = PstApi()
    private val spotify = SpotifyRepo(prefs, api)

    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    /** Messages ponctuels à afficher en bas d'écran. */
    val messages: SharedFlow<String> = _messages

    private fun message(text: String) {
        _messages.tryEmit(text)
    }

    // ===================== accueil / recherche =====================

    var screen by mutableStateOf(Screen.Home)
        private set
    var query by mutableStateOf("")
        private set
    var searching by mutableStateOf(false)
        private set
    var results by mutableStateOf<List<SearchResult>>(emptyList())
        private set
    var homeStatus by mutableStateOf<Pair<String, Boolean>?>(null) // texte, est une erreur
        private set
    var recents by mutableStateOf(prefs.recents)
        private set
    /** Incrémenté à chaque déclenchement de l'easter egg "karaoke". */
    var karaokeFxKey by mutableIntStateOf(0)
        private set

    private var searchJob: Job? = null

    fun onQueryChange(value: String) {
        // Easter egg : taper "karaoke" anime le fond pendant 10 s.
        if (value.lowercase(Locale.ROOT).endsWith("karaoke") && !query.lowercase(Locale.ROOT).endsWith("karaoke")) {
            karaokeFxKey++
        }
        query = value
    }

    private fun pushRecent(q: String) {
        recents = (listOf(q) + recents.filterNot { it.equals(q, ignoreCase = true) }).take(4)
        prefs.recents = recents
    }

    fun search(raw: String = query) {
        val q = raw.trim()
        if (q.isEmpty()) return
        query = q
        if (isYoutubeUrl(q)) {
            searchYoutube(q)
            return
        }

        pushRecent(q)
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            results = emptyList()
            homeStatus = null
            searching = true
            val res = api.search(q, enabledSources)
            searching = false
            val body = res.body
            when {
                res.networkError -> homeStatus = "Erreur réseau, réessaie." to true
                !res.ok -> homeStatus = (body?.error ?: "Erreur inconnue.") to true
                body == null || body.results.isEmpty() -> homeStatus = "Aucun résultat trouvé." to true
                else -> {
                    results = body.results
                    homeStatus = "${body.results.size} résultats" to false
                }
            }
        }
    }

    private fun searchYoutube(url: String) {
        pushRecent(url)
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            results = emptyList()
            searching = true
            homeStatus = "Récupération du titre YouTube…" to false
            val res = api.youtubeTitle(url)
            searching = false
            val body = res.body
            if (!res.ok || body == null) {
                homeStatus = (if (res.networkError) "Erreur réseau, réessaie." else body?.error ?: "Vidéo YouTube introuvable.") to true
                return@launch
            }
            val guess = parseYoutubeTitle(body.title, body.author)
            if (guess.title.isBlank()) {
                homeStatus = "Impossible de lire le titre de cette vidéo." to true
                return@launch
            }
            homeStatus = null
            openSong(Song(guess.artist.ifBlank { "Artiste inconnu" }, guess.title, body.thumbnail, source = "youtube"))
        }
    }

    /** Texte reçu via "Partager" depuis une autre appli (souvent un lien YouTube). */
    fun openSharedText(text: String) {
        val url = firstUrlIn(text)
        search(if (url != null && isYoutubeUrl(url)) url else text)
    }

    // ===================== paroles =====================

    var song by mutableStateOf<Song?>(null)
        private set
    var lyrics by mutableStateOf<LyricsContent>(LyricsContent.None)
        private set
    /** Relance l'animation du vinyle à chaque nouvelle chanson. */
    var songKey by mutableIntStateOf(0)
        private set

    /** Texte d'origine (sert à copier, enregistrer et traduire). */
    private var originalText = ""
    /** Lignes horodatées de la chanson, conservées à part pour revenir au mode synchronisé après une traduction. */
    private var syncedLines: List<LrcLine> = emptyList()

    var translateTarget by mutableStateOf("")
        private set
    var translating by mutableStateOf(false)
        private set

    private var lyricsJob: Job? = null
    private var translateJob: Job? = null

    val hasLyrics: Boolean get() = lyrics is LyricsContent.Plain || lyrics is LyricsContent.Synced

    val copyableText: String
        get() = when (val l = lyrics) {
            is LyricsContent.Plain -> l.text
            is LyricsContent.Synced -> l.lines.joinToString("\n") { it.text }
            else -> ""
        }

    private fun resetSongState(newSong: Song) {
        lyricsJob?.cancel()
        translateJob?.cancel()
        song = newSong
        songKey++
        originalText = ""
        syncedLines = emptyList()
        translateTarget = ""
        translating = false
        picking = false
        picked = emptySet()
        lyrics = LyricsContent.Loading()
    }

    fun openSong(newSong: Song, preloadedLyrics: String? = null) {
        resetSongState(newSong)
        showLyricsScreen()

        // La recherche de repli (lyrics.ovh...) renvoie déjà les paroles.
        if (preloadedLyrics != null) {
            showPlain(preloadedLyrics)
            return
        }

        lyricsJob = viewModelScope.launch {
            val res = api.lyrics(newSong, enabledSources)
            val body = res.body
            when {
                res.networkError -> lyrics = LyricsContent.Message("Erreur réseau, réessaie.")
                !res.ok || body == null -> lyrics = LyricsContent.Message(body?.error ?: "Erreur lors du chargement des paroles.")
                body.lyrics != null -> applyPayload(body)
                body.embedHtml != null -> lyrics = LyricsContent.Embed(body.embedHtml, body.geniusUrl)
                else -> lyrics = LyricsContent.Message(
                    "Les paroles de cette chanson ne sont pas disponibles pour le moment.",
                    body.geniusUrl,
                )
            }
        }
    }

    fun openResult(result: SearchResult) =
        openSong(result.toSong(), preloadedLyrics = result.lyrics?.takeIf { result.source == "lyricsovh" })

    private fun showPlain(text: String) {
        originalText = text
        syncedLines = emptyList()
        lyrics = LyricsContent.Plain(text)
    }

    /** Version synchronisée si la source en fournit une, texte simple sinon. */
    private fun applyPayload(body: LyricsResponse) {
        originalText = body.lyrics.orEmpty()
        syncedLines = parseLrc(body.syncedLyrics)
        lyrics = if (syncedLines.isNotEmpty()) LyricsContent.Synced(syncedLines) else LyricsContent.Plain(originalText)
    }

    private fun showLyricsScreen() {
        screen = Screen.Lyrics
        startTracking()
    }

    /** Retour aux résultats de recherche. */
    fun showResults() {
        concert = false
        picking = false
        picked = emptySet()
        lightboxOpen = false
        screen = Screen.Home
        stopTracking()
    }

    /** Clic sur le logo : accueil vierge. */
    fun goHome() {
        query = ""
        results = emptyList()
        homeStatus = null
        showResults()
    }

    // ===================== traduction =====================

    /** Une traduction synchronisée est une liste (une entrée par ligne horodatée), une traduction simple un texte. */
    private fun applyTranslation(value: CachedTranslation?, synced: Boolean): Boolean {
        if (value == null) return false
        if (synced && value.lines != null && value.lines.size == syncedLines.size) {
            lyrics = LyricsContent.Synced(syncedLines, value.lines)
            return true
        }
        if (!synced && value.text != null) {
            lyrics = LyricsContent.Plain(value.text)
            return true
        }
        return false
    }

    fun translate(target: String) {
        val current = song ?: return
        if (target.isEmpty()) {
            restoreOriginal()
            return
        }
        translateJob?.cancel()
        val synced = syncedLines.isNotEmpty()
        val key = translationCacheKey(current.artist, current.title, target)

        // Retraduire la même chanson dans la même langue est instantané.
        if (applyTranslation(prefs.cachedTranslation(key), synced)) {
            translateTarget = target
            return
        }

        translateJob = viewModelScope.launch {
            translating = true
            translateTarget = target
            // En mode synchronisé, la source doit être les lignes horodatées :
            // le texte brut n'a pas forcément le même découpage.
            val source = if (synced) syncedLines.joinToString("\n") { it.text } else originalText
            val res = api.translate(source, target, aligned = synced)
            val value = CachedTranslation(text = res.body?.translated, lines = res.body?.lines)
            if (res.ok && applyTranslation(value, synced)) {
                prefs.cacheTranslation(key, value)
            } else {
                translateTarget = ""
                message(
                    when {
                        res.networkError -> "Erreur réseau, réessaie."
                        else -> res.body?.error ?: "Traduction indisponible pour le moment."
                    }
                )
            }
            translating = false
        }
    }

    fun restoreOriginal() {
        translateJob?.cancel()
        translating = false
        translateTarget = ""
        lyrics = if (syncedLines.isNotEmpty()) LyricsContent.Synced(syncedLines) else LyricsContent.Plain(originalText)
    }

    // ===================== bibliothèque =====================

    var library by mutableStateOf(prefs.library)
        private set

    private fun libraryIndex(artist: String, title: String) =
        library.indexOfFirst { it.artist.equals(artist, true) && it.title.equals(title, true) }

    val isSaved: Boolean get() = song?.let { libraryIndex(it.artist, it.title) >= 0 } ?: false

    fun toggleSave() {
        val s = song ?: return
        val index = libraryIndex(s.artist, s.title)
        library = if (index >= 0) {
            library.filterIndexed { i, _ -> i != index }
        } else {
            listOf(LibraryItem(s.artist, s.title, s.thumbnail, originalText, System.currentTimeMillis())) + library
        }
        prefs.library = library
    }

    fun removeFromLibrary(item: LibraryItem) {
        library = library.filterNot { it.artist == item.artist && it.title == item.title }
        prefs.library = library
    }

    fun openLibraryItem(item: LibraryItem) {
        resetSongState(Song(item.artist, item.title, item.thumbnail, source = "library"))
        showLyricsScreen()
        if (item.lyrics.isNullOrBlank()) {
            openSong(Song(item.artist, item.title, item.thumbnail, source = "library"))
        } else {
            showPlain(item.lyrics)
        }
    }

    // ===================== réglages =====================

    var enabledSources by mutableStateOf(prefs.enabledSources)
        private set

    fun setSourceEnabled(key: String, enabled: Boolean) {
        val set = enabledSources.toMutableSet()
        if (enabled) set += key else set -= key
        if (set.isEmpty()) return // toujours garder au moins une source
        enabledSources = ALL_SOURCE_KEYS.filter { it in set }
        prefs.enabledSources = enabledSources
    }

    var textSize by mutableIntStateOf(prefs.textSize)
        private set

    fun changeTextSize(delta: Int) {
        textSize = (textSize + delta).coerceIn(15, 30)
        prefs.textSize = textSize
    }

    var syncOffsetMs by mutableIntStateOf(prefs.syncOffsetMs)
        private set

    fun changeSyncOffset(deltaMs: Int) {
        syncOffsetMs = (syncOffsetMs + deltaMs).coerceIn(-5000, 5000)
        prefs.syncOffsetMs = syncOffsetMs
    }

    // ===================== Spotify =====================

    var spotifyConnected by mutableStateOf(spotify.isConnected)
        private set
    var playback by mutableStateOf<PlaybackState?>(null)
        private set
    var bannerDismissed by mutableStateOf(false)
    var autoFollow by mutableStateOf(prefs.autoFollow)
        private set
    var controlsBusy by mutableStateOf(false)
        private set

    private var pollJob: Job? = null
    private var inForeground = false

    suspend fun spotifyAuthUrl(): String? {
        val url = spotify.authorizationUrl()
        if (url == null) message("Spotify n'est pas configuré sur ce serveur pour le moment.")
        return url
    }

    fun completeSpotifyLogin(code: String?, state: String?, error: String?) {
        if (code == null) {
            if (error != null) message("Connexion Spotify annulée.")
            return
        }
        viewModelScope.launch {
            if (spotify.completeAuthorization(code, state)) {
                spotifyConnected = true
                message("Spotify connecté")
                if (screen == Screen.Lyrics) startTracking()
            } else {
                message("La connexion à Spotify a échoué.")
            }
        }
    }

    fun disconnectSpotify() {
        spotify.disconnect()
        spotifyConnected = false
        autoFollow = false
        prefs.autoFollow = false
        stopTracking()
    }

    /** Bouton "En écoute" de l'accueil : cherche ce que Spotify est en train de jouer. */
    fun searchNowPlaying() {
        viewModelScope.launch {
            val state = spotify.currentlyPlaying()
            if (state == null) {
                homeStatus = "Aucune lecture en cours sur Spotify (ou session expirée)." to true
                spotifyConnected = spotify.isConnected
                return@launch
            }
            search("${state.artist} ${state.title}")
        }
    }

    fun onForeground() {
        inForeground = true
        if (screen == Screen.Lyrics) startTracking()
    }

    fun onBackground() {
        inForeground = false
        stopTracking()
    }

    /**
     * Le sondage réseau (toutes les 3 s) ne sert qu'à recaler la position : entre
     * deux sondages, l'interface l'interpole à partir de l'horloge du téléphone.
     */
    private fun startTracking() {
        stopTracking()
        if (!spotifyConnected || !inForeground) return
        pollJob = viewModelScope.launch {
            while (isActive) {
                refreshPlayback()
                delay(3_000)
            }
        }
    }

    private fun stopTracking() {
        pollJob?.cancel()
        pollJob = null
        playback = null
    }

    private suspend fun refreshPlayback() {
        val state = spotify.currentlyPlaying()
        spotifyConnected = spotify.isConnected
        if (state == null) {
            playback = null
            return
        }
        val previous = playback
        playback = state
        if (!state.isSameTrack(previous) && autoFollow) followPlaying(state)
    }

    fun toggleAutoFollow() {
        autoFollow = !autoFollow
        prefs.autoFollow = autoFollow
        playback?.let { if (autoFollow) followPlaying(it) }
    }

    /** Charge les paroles de ce que joue Spotify, avec ses métadonnées propres. */
    private fun followPlaying(state: PlaybackState) {
        val current = song
        if (current != null && tracksMatch(state.title, current.title) && tracksMatch(state.artist, current.artist)) return

        val primaryArtist = state.artist.split(',').first().trim()
        val newSong = Song(primaryArtist, state.title, state.coverUrl, source = "spotify", displayArtist = state.artist)
        resetSongState(newSong)

        lyricsJob = viewModelScope.launch {
            val res = api.lyrics(newSong, enabledSources)
            val body = res.body
            lyrics = when {
                res.networkError -> LyricsContent.Message("Erreur réseau, réessaie.")
                body?.lyrics != null -> {
                    applyPayload(body)
                    lyrics
                }
                else -> LyricsContent.Message("Paroles introuvables pour cette chanson.")
            }
        }
    }

    private fun isPlayingCurrentSong(): Boolean {
        val pb = playback ?: return false
        val s = song ?: return false
        return tracksMatch(pb.title, s.title) && tracksMatch(pb.artist, s.artist)
    }

    /** Surlignage karaoké possible : paroles horodatées et c'est bien cette chanson qui joue. */
    val karaokeActive: Boolean get() = lyrics is LyricsContent.Synced && isPlayingCurrentSong()

    val syncBarState: SyncBarState
        get() = when {
            lyrics is LyricsContent.Loading || lyrics is LyricsContent.None -> SyncBarState.Hidden
            lyrics !is LyricsContent.Synced && isPlayingCurrentSong() -> SyncBarState.Unavailable
            !karaokeActive -> SyncBarState.Hidden
            playback?.isPlaying == true -> SyncBarState.Synced
            else -> SyncBarState.Paused
        }

    fun togglePlayPause() {
        val pb = playback ?: return
        val willPlay = !pb.isPlaying
        val now = android.os.SystemClock.elapsedRealtime()
        // Retour visuel immédiat, corrigé au prochain sondage si la commande échoue.
        playback = pb.copy(isPlaying = willPlay, progressMs = pb.estimatedProgress(now), anchoredAtMs = now)
        runCommand(if (willPlay) "play" else "pause", 350, "Impossible de contrôler la lecture Spotify.") {
            playback = pb
        }
    }

    fun skipNext() = runCommand("next", 450, "Impossible de passer au titre suivant.")

    fun skipPrevious() = runCommand("previous", 450, "Impossible de revenir au titre précédent.")

    private fun runCommand(path: String, settleMs: Long, fallback: String, onError: () -> Unit = {}) {
        viewModelScope.launch {
            controlsBusy = true
            val code = spotify.command(path)
            if (code in 200..299) {
                delay(settleMs)
                refreshPlayback()
            } else {
                onError()
                message(
                    when (code) {
                        403 -> "Contrôle de la lecture réservé aux comptes Spotify Premium."
                        404 -> "Aucun appareil Spotify actif — lance la lecture depuis l'appli d'abord."
                        -1 -> "Erreur réseau, réessaie."
                        else -> fallback
                    }
                )
            }
            controlsBusy = false
        }
    }

    // ===================== mode concert =====================

    var concert by mutableStateOf(false)

    fun enterConcert() {
        if (song == null) return
        picking = false
        picked = emptySet()
        concert = true
    }

    // ===================== pochette en grand =====================

    var lightboxOpen by mutableStateOf(false)

    // ===================== carte de citation =====================

    var picking by mutableStateOf(false)
        private set
    var picked by mutableStateOf<Set<Int>>(emptySet())
        private set
    var cardFile by mutableStateOf<File?>(null)
    var cardBusy by mutableStateOf(false)
        private set

    fun startPicking() {
        if (!hasLyrics) return
        concert = false
        picking = true
        picked = emptySet()
    }

    fun stopPicking() {
        picking = false
        picked = emptySet()
    }

    fun togglePick(index: Int) {
        picked = when {
            index in picked -> picked - index
            picked.size >= MAX_PICKED_LINES -> picked
            else -> picked + index
        }
    }

    /** Texte d'origine de la ligne affichée à [index] (jamais sa traduction). */
    private fun lineText(index: Int): String? = when (val l = lyrics) {
        is LyricsContent.Plain -> l.text.split('\n').getOrNull(index)
        is LyricsContent.Synced -> l.lines.getOrNull(index)?.text
        else -> null
    }

    fun generateCard() {
        val s = song ?: return
        val lines = picked.sorted().mapNotNull { lineText(it)?.trim() }.filter { it.isNotEmpty() }
        if (lines.isEmpty()) return
        viewModelScope.launch {
            cardBusy = true
            try {
                cardFile = QuoteCardRenderer.render(getApplication(), lines, s)
                stopPicking()
            } catch (e: Exception) {
                message("Impossible de créer la carte pour cette chanson.")
            } finally {
                cardBusy = false
            }
        }
    }

    fun saveCardToGallery() {
        val file = cardFile ?: return
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.Q) return
        viewModelScope.launch {
            val uri = runCatching { QuoteCardRenderer.saveToGallery(getApplication(), file) }.getOrNull()
            message(if (uri != null) "Carte enregistrée dans Images/pstparoles" else "Impossible d'enregistrer la carte.")
        }
    }

    companion object {
        const val MAX_PICKED_LINES = 4
    }
}
