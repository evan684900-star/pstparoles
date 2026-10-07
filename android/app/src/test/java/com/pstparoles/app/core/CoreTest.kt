package com.pstparoles.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LrcTest {
    @Test fun `parse les horodatages et trie`() {
        val lines = parseLrc(
            """
            [ar:Quelqu'un]
            [00:12.50] Ligne B
            [00:03.2] Ligne A
            [01:00.000] Ligne C
            """.trimIndent()
        )
        assertEquals(listOf(3_200L, 12_500L, 60_000L), lines.map { it.timeMs })
        assertEquals("Ligne A", lines[0].text)
    }

    @Test fun `plusieurs horodatages sur une meme ligne`() {
        val lines = parseLrc("[00:10.00][00:40.00] Refrain")
        assertEquals(2, lines.size)
        assertTrue(lines.all { it.text == "Refrain" })
    }

    @Test fun `ligne vide horodatee conservee`() {
        val lines = parseLrc("[00:05.00]\n[00:06.00] Suite")
        assertEquals("", lines[0].text)
    }

    @Test fun `entree vide`() {
        assertTrue(parseLrc(null).isEmpty())
        assertTrue(parseLrc("").isEmpty())
    }

    @Test fun `recherche de la ligne en cours`() {
        val lines = listOf(LrcLine(1_000, "a"), LrcLine(5_000, "b"), LrcLine(9_000, "c"))
        assertEquals(-1, findLineIndexAt(lines, 500))
        assertEquals(0, findLineIndexAt(lines, 1_000))
        assertEquals(1, findLineIndexAt(lines, 8_999))
        assertEquals(2, findLineIndexAt(lines, 99_000))
        assertEquals(-1, findLineIndexAt(emptyList(), 5_000))
    }
}

class TextUtilsTest {
    @Test fun `teinte identique au site`() {
        // Même algorithme que hueOf() en JS : (h * 31 + code) % 360
        var expected = 0
        for (c in "TitreArtiste") expected = (expected * 31 + c.code) % 360
        assertEquals(expected, hueOf("TitreArtiste"))
    }

    @Test fun initiales() {
        assertEquals("JD", initials("jean dupont martin"))
        assertEquals("?", initials(""))
        assertEquals("?", initials(null))
    }

    @Test fun `normalisation des titres`() {
        assertEquals("ma chanson", normalizeTrackName("Ma Chanson (Remastered 2011)"))
        assertEquals("ete", normalizeTrackName("Été - Live"))
        assertTrue(tracksMatch("Ma Chanson - Radio Edit", "ma chanson"))
        assertTrue(tracksMatch("Artiste A, Artiste B", "Artiste A"))
        assertFalse(tracksMatch("Une", "Autre"))
        assertFalse(tracksMatch("", "x"))
    }

    @Test fun `liens youtube`() {
        assertTrue(isYoutubeUrl("https://www.youtube.com/watch?v=abc"))
        assertTrue(isYoutubeUrl("https://youtu.be/abc"))
        assertTrue(isYoutubeUrl("https://m.youtube.com/shorts/abc"))
        assertFalse(isYoutubeUrl("https://example.com/watch?v=abc"))
        assertFalse(isYoutubeUrl("artiste titre"))
        assertEquals("https://youtu.be/abc", firstUrlIn("Regarde : https://youtu.be/abc"))
    }

    @Test fun `titre youtube decoupe`() {
        val t = parseYoutubeTitle("Artiste X - Titre Y (Official Video)", "Chaine")
        assertEquals("Artiste X", t.artist)
        assertEquals("Titre Y", t.title)

        val topic = parseYoutubeTitle("Titre Z [Lyrics]", "Artiste Z - Topic")
        assertEquals("Artiste Z", topic.artist)
        assertEquals("Titre Z", topic.title)
    }

    @Test fun formats() {
        assertEquals("0:00", formatMs(-5))
        assertEquals("3:07", formatMs(187_400))
        assertEquals("+0,3 s", formatOffset(300))
        assertEquals("−1,2 s", formatOffset(-1200))
        assertEquals("0,0 s", formatOffset(0))
    }

    @Test fun `nom de fichier de carte`() {
        assertEquals("pstparoles-artiste-ete-reve.png", cardFileName("Artiste", "Été Rêvé"))
        assertEquals("pstparoles-citation.png", cardFileName("", "!!"))
    }

    @Test fun `retour a la ligne`() {
        val measure = { s: String -> s.length.toFloat() }
        assertEquals(listOf("aa bb", "cc"), wrapWords("aa bb cc", 5f, measure))
        assertEquals(listOf("motbeaucouptroplong"), wrapWords("motbeaucouptroplong", 5f, measure))
    }
}

class PkceTest {
    @Test fun `challenge conforme a la RFC 7636`() {
        // Vecteur de test officiel de la RFC 7636, annexe B.
        assertEquals(
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
            Pkce.challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
        )
    }

    @Test fun `verifier aleatoire`() {
        val v = Pkce.randomString(64)
        assertEquals(64, v.length)
        assertTrue(v.all { it.isLetterOrDigit() })
    }
}

class PlaybackTest {
    @Test fun interpolation() {
        val p = PlaybackState("t", "a", null, 10_000, 12_000, true, anchoredAtMs = 1_000)
        assertEquals(10_500, p.estimatedProgress(1_500))
        assertEquals(12_000, p.estimatedProgress(99_000)) // bornée à la durée
        assertEquals(10_000, p.copy(isPlaying = false).estimatedProgress(99_000))
    }
}
