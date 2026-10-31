package com.pstparoles.app.data

import com.pstparoles.app.BuildConfig
import com.pstparoles.app.core.LrcCandidate
import com.pstparoles.app.core.lrclibQuery
import com.pstparoles.app.core.pickSyncedCandidate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit

object Http {
    val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        // La traduction alignée d'une longue chanson peut prendre du temps côté serveur.
        .readTimeout(45, TimeUnit.SECONDS)
        .build()
}

/** Réponse d'API : [code] vaut -1 en cas d'erreur réseau (pas de réponse du tout). */
data class ApiResult<T>(val ok: Boolean, val code: Int, val body: T?) {
    val networkError get() = code == -1
}

/**
 * Routes /api/* du site déployé. L'appli passe par elles plutôt que
 * d'appeler Genius directement : le jeton Genius reste sur le serveur.
 */
class PstApi(private val baseUrl: String = BuildConfig.API_BASE_URL) {

    private suspend fun <T> get(path: String, params: Map<String, String>, serializer: KSerializer<T>): ApiResult<T> =
        withContext(Dispatchers.IO) {
            val url = "$baseUrl$path".toHttpUrl().newBuilder().apply {
                params.forEach { (k, v) -> addQueryParameter(k, v) }
            }.build()
            try {
                Http.client.newCall(Request.Builder().url(url).build()).execute().use { res ->
                    val text = res.body?.string().orEmpty()
                    val body = runCatching { PstJson.decodeFromString(serializer, text) }.getOrNull()
                    ApiResult(res.isSuccessful, res.code, body)
                }
            } catch (e: IOException) {
                ApiResult(false, -1, null)
            }
        }

    suspend fun search(query: String, sources: List<String>) =
        get("/api/search", mapOf("q" to query, "sources" to sources.joinToString(",")), SearchResponse.serializer())

    /** [sort] : "popularity" ou "title". */
    suspend fun artist(id: Long, page: Int, sort: String) =
        get("/api/artist", mapOf("id" to id.toString(), "page" to page.toString(), "sort" to sort), ArtistResponse.serializer())

    /** [durationMs] : durée du morceau qui joue sur Spotify, pour choisir la bonne version synchronisée. */
    suspend fun lyrics(song: Song, sources: List<String>, durationMs: Long? = null): ApiResult<LyricsResponse> {
        val params = buildMap {
            durationMs?.takeIf { it > 0 }?.let { put("duration", ((it + 500) / 1000).toString()) }
            song.url?.let { put("url", it) }
            song.id?.let { put("id", it.toString()) }
            put("artist", song.artist)
            put("title", song.title)
            put("sources", sources.joinToString(","))
        }
        var result = get("/api/lyrics", params, LyricsResponse.serializer())
        val body = result.body
        // Un raté passager d'une source ne doit pas suffire à dire "introuvable".
        if (result.ok && body != null && body.lyrics == null && !body.instrumental && body.retryable) {
            delay(1_500)
            result = get("/api/lyrics", params, LyricsResponse.serializer())
        }

        // Pas de version synchronisée côté serveur : on la demande directement
        // à LRCLIB. Le serveur du site partage son adresse avec beaucoup
        // d'autres sur Vercel et LRCLIB le limite souvent ; le téléphone, non.
        val final = result.body
        if (result.ok && final != null && final.syncedLyrics == null && !final.instrumental) {
            val synced = syncedFromLrclib(song.artist, song.title, durationMs?.let { it / 1000.0 })
            if (synced != null) {
                return result.copy(body = LyricsResponse(lyrics = synced.plainLyrics, syncedLyrics = synced.syncedLyrics, source = "lrclib"))
            }
        }
        return result
    }

    private suspend fun syncedFromLrclib(artist: String, title: String, durationSec: Double?): LrcCandidate? =
        withContext(Dispatchers.IO) {
            val (mainArtist, cleanTitle) = lrclibQuery(artist, title)
            val url = "https://lrclib.net/api/search".toHttpUrl().newBuilder()
                .addQueryParameter("track_name", cleanTitle)
                .addQueryParameter("artist_name", mainArtist)
                .build()
            // LRCLIB demande que chaque application s'identifie.
            val request = Request.Builder().url(url).header("User-Agent", "pstparoles-android/1.0").build()
            try {
                Http.client.newCall(request).execute().use { res ->
                    if (!res.isSuccessful) return@withContext null
                    val rows = runCatching {
                        PstJson.decodeFromString(ListSerializer(LrclibRow.serializer()), res.body?.string().orEmpty())
                    }.getOrNull() ?: return@withContext null
                    pickSyncedCandidate(rows.map { it.toCandidate() }, artist, title, durationSec)
                }
            } catch (e: IOException) {
                null
            }
        }

    /** [aligned] : une ligne traduite par ligne d'entrée, pour les paroles synchronisées. */
    suspend fun translate(text: String, target: String, aligned: Boolean) =
        get(
            "/api/translate",
            buildMap {
                put("text", text)
                put("target", target)
                if (aligned) put("lines", "1")
            },
            TranslateResponse.serializer(),
        )

    suspend fun youtubeTitle(url: String) =
        get("/api/youtube-title", mapOf("url" to url), YoutubeTitleResponse.serializer())

    suspend fun spotifyConfig() =
        get("/api/spotify-config", emptyMap(), SpotifyConfigResponse.serializer())
}
