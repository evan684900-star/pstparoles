package com.pstparoles.app.core

import java.text.Normalizer
import java.util.Locale

private val COMBINING_MARKS = Regex("""\p{Mn}+""")

private fun stripAccents(value: String): String =
    Normalizer.normalize(value, Normalizer.Form.NFD).replace(COMBINING_MARKS, "")

/** Teinte (0-359) dérivée du texte : chaque chanson garde sa couleur de halo. */
fun hueOf(text: String): Int {
    var h = 0
    for (c in text) h = (h * 31 + c.code) % 360
    return h
}

fun initials(name: String?): String {
    val words = (name ?: "").split(' ').filter { it.isNotBlank() }
    if (words.isEmpty()) return "?"
    return words.take(2).joinToString("") { it.first().uppercase() }
}

/** Version comparable d'un titre ou d'un artiste : sans accents, ni "(Remastered)", ni "feat.". */
fun normalizeTrackName(value: String?): String =
    stripAccents((value ?: "").lowercase(Locale.ROOT))
        .replace(Regex("""\([^)]*\)|\[[^\]]*\]"""), " ")
        .replace(Regex("""\s-\s.*$"""), " ")
        .replace(Regex("""\b(feat|ft|with|remaster(ed)?|version|live)\b"""), " ")
        .replace(Regex("""[^a-z0-9]+"""), " ")
        .trim()

fun tracksMatch(a: String?, b: String?): Boolean {
    val x = normalizeTrackName(a)
    val y = normalizeTrackName(b)
    if (x.isEmpty() || y.isEmpty()) return false
    return x == y || x.contains(y) || y.contains(x)
}

private val YOUTUBE_URL = Regex(
    """^https?://(www\.|m\.)?(youtube\.com/(watch\?|shorts/)|youtu\.be/)""",
    RegexOption.IGNORE_CASE,
)

fun isYoutubeUrl(text: String): Boolean = YOUTUBE_URL.containsMatchIn(text.trim())

/** Premier lien http(s) d'un texte partagé ("Regarde ça : https://youtu.be/..."). */
fun firstUrlIn(text: String): String? =
    Regex("""https?://\S+""").find(text)?.value

private val VIDEO_SUFFIX = Regex(
    """\s*[(\[]\s*(official\s*)?(music\s*)?(video|audio|lyrics?|hd|4k|visualizer|full\s*song)\s*[)\]]""",
    RegexOption.IGNORE_CASE,
)

/** Retire "(Official Video)", "[Lyrics]"… d'un titre de vidéo. */
fun stripVideoSuffix(text: String): String = text.replace(VIDEO_SUFFIX, "").trim()

data class GuessedTrack(val artist: String, val title: String)

/** "Artiste - Titre (Official Video)" est le format de titre YouTube le plus courant. */
fun parseYoutubeTitle(title: String?, author: String?): GuessedTrack {
    val raw = (title ?: "").trim()
    val parts = raw.split(Regex("""\s[-–—]\s"""))
    if (parts.size >= 2) {
        return GuessedTrack(
            artist = parts[0].trim(),
            title = stripVideoSuffix(parts.drop(1).joinToString(" - ").trim()),
        )
    }
    val artist = (author ?: "").replace(Regex("""\s*-\s*Topic$""", RegexOption.IGNORE_CASE), "").trim()
    return GuessedTrack(artist = artist, title = stripVideoSuffix(raw))
}

fun formatMs(ms: Long): String {
    val totalSeconds = maxOf(0L, ms / 1000)
    return "${totalSeconds / 60}:${(totalSeconds % 60).toString().padStart(2, '0')}"
}

/** "+0,3 s", "−1,2 s", "0,0 s" */
fun formatOffset(ms: Int): String {
    val seconds = ms / 1000.0
    val sign = when {
        seconds > 0 -> "+"
        seconds < 0 -> "−"
        else -> ""
    }
    return sign + String.format(Locale.US, "%.1f", kotlin.math.abs(seconds)).replace('.', ',') + " s"
}

fun cardFileName(artist: String, title: String): String {
    val base = stripAccents("$artist-$title".lowercase(Locale.ROOT))
        .replace(Regex("""[^a-z0-9]+"""), "-")
        .trim('-')
        .take(60)
        .trim('-')
    return "pstparoles-${base.ifEmpty { "citation" }}.png"
}

/** Découpe [text] en lignes qui tiennent dans [maxWidth], selon la fonction de mesure fournie. */
fun wrapWords(text: String, maxWidth: Float, measure: (String) -> Float): List<String> {
    val words = text.split(Regex("""\s+""")).filter { it.isNotEmpty() }
    val out = mutableListOf<String>()
    var current = ""
    for (word in words) {
        val candidate = if (current.isEmpty()) word else "$current $word"
        if (current.isNotEmpty() && measure(candidate) > maxWidth) {
            out += current
            current = word
        } else {
            current = candidate
        }
    }
    if (current.isNotEmpty()) out += current
    return out.ifEmpty { listOf("") }
}

fun translationCacheKey(artist: String, title: String, target: String): String =
    "$artist|$title|$target".lowercase(Locale.ROOT)
