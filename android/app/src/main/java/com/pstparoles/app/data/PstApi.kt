package com.pstparoles.app.data

import com.pstparoles.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
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

    suspend fun lyrics(song: Song, sources: List<String>): ApiResult<LyricsResponse> {
        val params = buildMap {
            song.url?.let { put("url", it) }
            song.id?.let { put("id", it.toString()) }
            put("artist", song.artist)
            put("title", song.title)
            put("sources", sources.joinToString(","))
        }
        return get("/api/lyrics", params, LyricsResponse.serializer())
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
