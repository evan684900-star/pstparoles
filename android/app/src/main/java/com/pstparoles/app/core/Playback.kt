package com.pstparoles.app.core

/**
 * Ce que Spotify est en train de jouer, "ancré" à un instant de l'horloge
 * monotone. Entre deux sondages réseau (toutes les 3 s), la position est
 * interpolée localement : c'est ce qui rend le surlignage précis à la ligne
 * près au lieu de sauter toutes les 3 secondes.
 */
data class PlaybackState(
    val title: String,
    val artist: String,
    val coverUrl: String?,
    val progressMs: Long,
    val durationMs: Long,
    val isPlaying: Boolean,
    val anchoredAtMs: Long,
) {
    fun estimatedProgress(nowMs: Long): Long {
        if (!isPlaying) return progressMs
        val cap = if (durationMs > 0) durationMs else Long.MAX_VALUE
        return minOf(progressMs + (nowMs - anchoredAtMs), cap)
    }

    fun isSameTrack(other: PlaybackState?): Boolean =
        other != null && other.title == title && other.artist == artist
}
