package com.pstparoles.app.data

import android.content.Context
import androidx.core.content.edit
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer

/** Équivalent du localStorage du site : tout ce qui doit survivre à la fermeture de l'appli. */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("pstparoles", Context.MODE_PRIVATE)

    private fun <T> readJson(key: String, serializer: KSerializer<T>, default: T): T =
        sp.getString(key, null)?.let { runCatching { PstJson.decodeFromString(serializer, it) }.getOrNull() } ?: default

    private fun <T> writeJson(key: String, serializer: KSerializer<T>, value: T) =
        sp.edit { putString(key, PstJson.encodeToString(serializer, value)) }

    // ---------- recherches récentes ----------

    var recents: List<String>
        get() = readJson("recents", ListSerializer(String.serializer()), emptyList())
        set(value) = writeJson("recents", ListSerializer(String.serializer()), value)

    // ---------- bibliothèque ----------

    var library: List<LibraryItem>
        get() = readJson("library", ListSerializer(LibraryItem.serializer()), emptyList())
        set(value) = writeJson("library", ListSerializer(LibraryItem.serializer()), value)

    // ---------- réglages ----------

    var enabledSources: List<String>
        get() = readJson("sources", ListSerializer(String.serializer()), emptyList()).ifEmpty { ALL_SOURCE_KEYS }
        set(value) = writeJson("sources", ListSerializer(String.serializer()), value)

    var textSize: Int
        get() = sp.getInt("text_size", 19).coerceIn(15, 30)
        set(value) = sp.edit { putInt("text_size", value.coerceIn(15, 30)) }

    var syncOffsetMs: Int
        get() = sp.getInt("sync_offset", 0)
        set(value) = sp.edit { putInt("sync_offset", value.coerceIn(-5000, 5000)) }

    var autoFollow: Boolean
        get() = sp.getBoolean("auto_follow", false)
        set(value) = sp.edit { putBoolean("auto_follow", value) }

    // ---------- cache des traductions ----------

    private val translationsSerializer = MapSerializer(String.serializer(), CachedTranslation.serializer())

    fun cachedTranslation(key: String): CachedTranslation? =
        readJson("translations", translationsSerializer, emptyMap())[key]

    fun cacheTranslation(key: String, value: CachedTranslation) {
        val cache = LinkedHashMap(readJson("translations", translationsSerializer, emptyMap()))
        cache.remove(key)
        cache[key] = value
        // Des paroles traduites sont volumineuses : on ne garde que les plus récentes.
        while (cache.size > MAX_CACHED_TRANSLATIONS) cache.remove(cache.keys.first())
        writeJson("translations", translationsSerializer, cache)
    }

    // ---------- Spotify ----------

    var spotifyAccessToken: String?
        get() = sp.getString("spotify_access_token", null)
        set(value) = sp.edit { putString("spotify_access_token", value) }

    var spotifyRefreshToken: String?
        get() = sp.getString("spotify_refresh_token", null)
        set(value) = sp.edit { putString("spotify_refresh_token", value) }

    var spotifyExpiresAt: Long
        get() = sp.getLong("spotify_expires_at", 0)
        set(value) = sp.edit { putLong("spotify_expires_at", value) }

    /** Conservés le temps de l'aller-retour dans le navigateur (l'appli peut être tuée entre-temps). */
    var spotifyPkceVerifier: String?
        get() = sp.getString("spotify_verifier", null)
        set(value) = sp.edit { putString("spotify_verifier", value) }

    var spotifyPkceState: String?
        get() = sp.getString("spotify_state", null)
        set(value) = sp.edit { putString("spotify_state", value) }

    fun clearSpotify() = sp.edit {
        remove("spotify_access_token")
        remove("spotify_refresh_token")
        remove("spotify_expires_at")
    }

    private companion object {
        const val MAX_CACHED_TRANSLATIONS = 40
    }
}
