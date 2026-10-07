package com.pstparoles.app.core

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * OAuth 2.0 "Authorization Code + PKCE" : la connexion Spotify se fait sans
 * secret client embarqué dans l'appli.
 */
object Pkce {
    private const val CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    private val random = SecureRandom()

    fun randomString(length: Int): String = buildString(length) {
        repeat(length) { append(CHARS[random.nextInt(CHARS.length)]) }
    }

    /** code_challenge = base64url(SHA-256(code_verifier)), sans padding. */
    fun challenge(verifier: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
    }
}
