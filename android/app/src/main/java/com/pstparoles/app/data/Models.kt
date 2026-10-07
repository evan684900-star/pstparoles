package com.pstparoles.app.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

val PstJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
    isLenient = true
}

/** Chanson affichée, quelle que soit son origine (recherche, YouTube, Spotify, bibliothèque). */
data class Song(
    val artist: String,
    val title: String,
    val thumbnail: String? = null,
    val id: Long? = null,
    val url: String? = null,
    val source: String,
    /** Spotify renvoie tous les artistes ("A, B") : on garde le principal pour chercher, tout pour afficher. */
    val displayArtist: String? = null,
)

@Serializable
data class SearchResult(
    val source: String = "genius",
    val id: Long? = null,
    val title: String = "",
    val artist: String = "",
    val thumbnail: String? = null,
    val url: String? = null,
    val lyrics: String? = null,
) {
    fun toSong() = Song(artist, title, thumbnail, id, url, source)
}

@Serializable
data class SearchResponse(val results: List<SearchResult> = emptyList(), val error: String? = null)

@Serializable
data class LyricsResponse(
    val lyrics: String? = null,
    val syncedLyrics: String? = null,
    val source: String? = null,
    val embedHtml: String? = null,
    val geniusUrl: String? = null,
    val error: String? = null,
)

@Serializable
data class TranslateResponse(
    val translated: String? = null,
    val lines: List<String>? = null,
    val error: String? = null,
)

@Serializable
data class YoutubeTitleResponse(
    val title: String? = null,
    val author: String? = null,
    val thumbnail: String? = null,
    val error: String? = null,
)

@Serializable
data class SpotifyConfigResponse(val clientId: String? = null)

@Serializable
data class LibraryItem(
    val artist: String,
    val title: String,
    val thumbnail: String? = null,
    val lyrics: String? = null,
    val savedAt: Long = 0,
)

/** Traduction en cache : texte simple, ou une ligne par ligne horodatée. */
@Serializable
data class CachedTranslation(val text: String? = null, val lines: List<String>? = null)

data class LyricsSource(val key: String, val label: String, val badge: String? = null)

val AVAILABLE_SOURCES = listOf(
    LyricsSource("lrclib", "LRCLIB", "Le plus complet"),
    LyricsSource("lyricsovh", "lyrics.ovh"),
    LyricsSource("textyl", "Textyl"),
    LyricsSource("lyrist", "Lyrist"),
    LyricsSource("chartlyrics", "ChartLyrics"),
)
val ALL_SOURCE_KEYS = AVAILABLE_SOURCES.map { it.key }

val SOURCE_LABELS = mapOf(
    "lyricsovh" to "lyrics.ovh",
    "lrclib" to "LRCLIB",
    "textyl" to "Textyl",
    "lyrist" to "Lyrist",
    "chartlyrics" to "ChartLyrics",
    "genius" to "Genius",
    "youtube" to "YouTube",
    "spotify" to "Spotify",
    "library" to "Bibliothèque",
)

fun sourceLabel(key: String?): String = SOURCE_LABELS[key] ?: (key ?: "")

val TRANSLATE_LANGUAGES = listOf(
    "fr" to "Français",
    "en" to "Anglais",
    "es" to "Espagnol",
    "de" to "Allemand",
    "it" to "Italien",
    "pt" to "Portugais",
    "nl" to "Néerlandais",
    "ar" to "Arabe",
    "tr" to "Turc",
    "ru" to "Russe",
    "ja" to "Japonais",
    "ko" to "Coréen",
    "zh-CN" to "Chinois",
)
