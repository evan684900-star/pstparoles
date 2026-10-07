package com.pstparoles.app.spotify

import android.net.Uri
import android.os.SystemClock
import com.pstparoles.app.core.Pkce
import com.pstparoles.app.core.PlaybackState
import com.pstparoles.app.data.Http
import com.pstparoles.app.data.PstApi
import com.pstparoles.app.data.PstJson
import com.pstparoles.app.data.Prefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import okhttp3.FormBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

/**
 * Connexion Spotify en PKCE (aucun secret dans l'APK) et accès au lecteur.
 *
 * L'URI de redirection [REDIRECT_URI] doit être ajoutée dans le tableau de
 * bord développeur Spotify de l'appli, à côté de celle du site.
 */
class SpotifyRepo(private val prefs: Prefs, private val api: PstApi) {

    companion object {
        const val REDIRECT_URI = "pstparoles://callback"
        private const val AUTH_URL = "https://accounts.spotify.com/authorize"
        private const val TOKEN_URL = "https://accounts.spotify.com/api/token"
        private const val PLAYER_URL = "https://api.spotify.com/v1/me/player"
        private const val SCOPE = "user-read-currently-playing user-modify-playback-state"
    }

    private var cachedClientId: String? = null

    val isConnected: Boolean get() = prefs.spotifyRefreshToken != null

    private suspend fun clientId(): String? {
        cachedClientId?.let { return it }
        cachedClientId = api.spotifyConfig().body?.clientId?.takeIf { it.isNotBlank() }
        return cachedClientId
    }

    /** URL de la page de connexion Spotify, ou null si le serveur n'a pas de client Spotify configuré. */
    suspend fun authorizationUrl(): String? {
        val clientId = clientId() ?: return null
        val verifier = Pkce.randomString(64)
        val state = Pkce.randomString(16)
        prefs.spotifyPkceVerifier = verifier
        prefs.spotifyPkceState = state

        return Uri.parse(AUTH_URL).buildUpon()
            .appendQueryParameter("client_id", clientId)
            .appendQueryParameter("response_type", "code")
            .appendQueryParameter("redirect_uri", REDIRECT_URI)
            .appendQueryParameter("code_challenge_method", "S256")
            .appendQueryParameter("code_challenge", Pkce.challenge(verifier))
            .appendQueryParameter("scope", SCOPE)
            .appendQueryParameter("state", state)
            .build()
            .toString()
    }

    /** Échange le code reçu au retour du navigateur contre des jetons. */
    suspend fun completeAuthorization(code: String, state: String?): Boolean {
        val verifier = prefs.spotifyPkceVerifier
        val expectedState = prefs.spotifyPkceState
        prefs.spotifyPkceVerifier = null
        prefs.spotifyPkceState = null
        if (verifier == null || state != expectedState) return false

        val clientId = clientId() ?: return false
        val form = FormBody.Builder()
            .add("client_id", clientId)
            .add("grant_type", "authorization_code")
            .add("code", code)
            .add("redirect_uri", REDIRECT_URI)
            .add("code_verifier", verifier)
            .build()
        return requestTokens(form)
    }

    private suspend fun requestTokens(form: FormBody): Boolean = withContext(Dispatchers.IO) {
        try {
            Http.client.newCall(Request.Builder().url(TOKEN_URL).post(form).build()).execute().use { res ->
                if (!res.isSuccessful) return@withContext false
                val json = PstJson.parseToJsonElement(res.body?.string().orEmpty()).jsonObject
                val access = json["access_token"]?.jsonPrimitive?.content ?: return@withContext false
                val expiresIn = json["expires_in"]?.jsonPrimitive?.longOrNull ?: 3600
                prefs.spotifyAccessToken = access
                prefs.spotifyExpiresAt = System.currentTimeMillis() + expiresIn * 1000
                json["refresh_token"]?.jsonPrimitive?.content?.let { prefs.spotifyRefreshToken = it }
                true
            }
        } catch (e: Exception) {
            false
        }
    }

    private suspend fun refreshToken(): String? {
        val refresh = prefs.spotifyRefreshToken ?: return null
        val clientId = clientId() ?: return null
        val form = FormBody.Builder()
            .add("client_id", clientId)
            .add("grant_type", "refresh_token")
            .add("refresh_token", refresh)
            .build()
        if (!requestTokens(form)) {
            disconnect()
            return null
        }
        return prefs.spotifyAccessToken
    }

    private suspend fun validToken(): String? {
        if (!isConnected) return null
        if (System.currentTimeMillis() < prefs.spotifyExpiresAt - 5_000) return prefs.spotifyAccessToken
        return refreshToken()
    }

    fun disconnect() = prefs.clearSpotify()

    /**
     * Morceau en cours. La position renvoyée correspond au moment où Spotify a
     * traité la requête, quelque part entre l'envoi et la réception : on
     * compense avec la moitié du temps d'aller-retour.
     */
    suspend fun currentlyPlaying(): PlaybackState? {
        val token = validToken() ?: return null
        return withContext(Dispatchers.IO) {
            try {
                val sentAt = SystemClock.elapsedRealtime()
                Http.client.newCall(
                    Request.Builder()
                        .url("$PLAYER_URL/currently-playing")
                        .header("Authorization", "Bearer $token")
                        .build()
                ).execute().use { res ->
                    val receivedAt = SystemClock.elapsedRealtime()
                    if (res.code == 204 || !res.isSuccessful) return@withContext null

                    val json = PstJson.parseToJsonElement(res.body?.string().orEmpty()).jsonObject
                    val item = json["item"] as? JsonObject ?: return@withContext null
                    val artists = (item["artists"]?.jsonArray ?: return@withContext null)
                        .mapNotNull { (it as? JsonObject)?.get("name")?.jsonPrimitive?.content }
                    val cover = (item["album"] as? JsonObject)?.get("images")?.jsonArray
                        ?.firstOrNull()?.jsonObject?.get("url")?.jsonPrimitive?.content

                    PlaybackState(
                        title = item["name"]?.jsonPrimitive?.content.orEmpty(),
                        artist = artists.joinToString(", "),
                        coverUrl = cover,
                        progressMs = (json["progress_ms"]?.jsonPrimitive?.longOrNull ?: 0L) + (receivedAt - sentAt) / 2,
                        durationMs = item["duration_ms"]?.jsonPrimitive?.longOrNull ?: 0L,
                        isPlaying = json["is_playing"]?.jsonPrimitive?.booleanOrNull ?: false,
                        anchoredAtMs = receivedAt,
                    )
                }
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * Commande du lecteur ("play", "pause", "next", "previous"). Renvoie le
     * code HTTP : 403 = compte non Premium, 404 = aucun appareil actif.
     */
    suspend fun command(path: String): Int {
        val token = validToken() ?: return 401
        val method = if (path == "play" || path == "pause") "PUT" else "POST"
        return withContext(Dispatchers.IO) {
            try {
                Http.client.newCall(
                    Request.Builder()
                        .url("$PLAYER_URL/$path")
                        .header("Authorization", "Bearer $token")
                        .method(method, ByteArray(0).toRequestBody())
                        .build()
                ).execute().use { it.code }
            } catch (e: IOException) {
                -1
            }
        }
    }
}
