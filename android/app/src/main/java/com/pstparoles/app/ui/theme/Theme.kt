package com.pstparoles.app.ui.theme

import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.pstparoles.app.R
import com.pstparoles.app.core.hueOf

/** Mêmes jetons de couleur que le :root du site. */
object Pst {
    val bg = Color(0xFF0A0A0C)
    val panel = Color(0xFF121216)
    val text = Color(0xFFF2F0EC)
    val lyric = Color(0xFFE9E7E2)
    val muted = Color(0xFF8E8D98)
    val faint = Color(0xFF63626C)
    val accent = Color(0xFFFFB545)
    val onAccent = Color(0xFF26180A)
    val spotify = Color(0xFF1DB954)
    val line = Color.White.copy(alpha = 0.08f)
    val surface = Color.White.copy(alpha = 0.028f)
    val danger = Color(0xFFFF9C9C)

    // karaoké
    val syncIdle = Color(0xFF6A6974)
    val syncDone = Color(0xFF56555E)
    val syncNext = Color(0xFF8E8D98)
}

object PstFonts {
    val serif = FontFamily(Font(R.font.instrument_serif, FontWeight.Normal))
    val sans = FontFamily(
        Font(R.font.space_grotesk, FontWeight.Normal),
        Font(R.font.space_grotesk, FontWeight.Medium),
        Font(R.font.space_grotesk, FontWeight.SemiBold),
        Font(R.font.space_grotesk, FontWeight.Bold),
    )
    val mono = FontFamily(
        Font(R.font.jetbrains_mono, FontWeight.Normal),
        Font(R.font.jetbrains_mono, FontWeight.Medium),
    )
}

/** Couleur propre à chaque chanson (halo, pochette par défaut, carte). */
fun songTint(title: String, artist: String): Color =
    Color.hsl(hueOf(title + artist).toFloat(), 0.7f, 0.62f)

@Composable
fun PstTheme(content: @Composable () -> Unit) {
    val base = TextStyle(fontFamily = PstFonts.sans, color = Pst.text)
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Pst.accent,
            onPrimary = Pst.onAccent,
            background = Pst.bg,
            onBackground = Pst.text,
            surface = Pst.panel,
            onSurface = Pst.text,
            surfaceVariant = Pst.panel,
            onSurfaceVariant = Pst.muted,
            outline = Pst.line,
        ),
        typography = Typography(
            bodyLarge = base,
            bodyMedium = base,
            bodySmall = base,
            labelLarge = base,
            labelMedium = base,
            titleMedium = base,
        ),
    ) {
        // Pas de Surface à la racine : sans ça, icônes et textes sans couleur
        // explicite seraient noirs sur fond noir.
        CompositionLocalProvider(LocalContentColor provides Pst.text, content = content)
    }
}
