package com.pstparoles.app.ui.components

import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/**
 * Icônes du site, construites à partir des mêmes tracés SVG (viewBox 24×24).
 * La teinte vient de Icon(tint = ...), qui s'applique au trait comme au remplissage.
 */
object PstIcons {
    private fun icon(name: String, vararg paths: String, stroke: Float? = null): ImageVector {
        val builder = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        for (d in paths) {
            if (stroke != null) {
                builder.addPath(
                    pathData = addPathNodes(d),
                    stroke = SolidColor(Color.Black),
                    strokeLineWidth = stroke,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                )
            } else {
                builder.addPath(pathData = addPathNodes(d), fill = SolidColor(Color.Black))
            }
        }
        return builder.build()
    }

    val Menu = icon("menu", "M4 7h16M4 12h16M4 17h16", stroke = 2.1f)
    val Settings = icon(
        "settings",
        "M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0z",
        "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
        stroke = 2f,
    )
    val Search = icon("search", "M18 11a7 7 0 1 1-14 0a7 7 0 1 1 14 0z", "M16.5 16.5L21 21", stroke = 1.8f)
    val Close = icon("close", "M6 6l12 12M18 6L6 18", stroke = 2.2f)
    val Bookmark = icon("bookmark", "M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z", stroke = 2.2f)
    val BookmarkFilled = icon("bookmark_filled", "M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z")
    val Card = icon(
        "card",
        "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
        "M7 10h7M7 14h10",
        stroke = 2.1f,
    )
    val Fullscreen = icon("fullscreen", "M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4", stroke = 2.1f)
    val Play = icon("play", "M8 5v14l11-7z")
    val Pause = icon("pause", "M7 5h4v14H7zm6 0h4v14h-4z")
    val Previous = icon("previous", "M6 6h2v12H6zm3.5 6 10 6.5V5.5z")
    val Next = icon("next", "M16 6h2v12h-2zM4.5 18 14.5 12 4.5 6z")
    val Spotify = icon("spotify", "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24 0-.36-.06-.6-.18-1.68-1.02-3.72-1.56-6.06-1.56-1.32 0-2.76.18-3.96.48-.18.06-.42.12-.54.12-.42 0-.66-.3-.66-.66 0-.42.24-.66.6-.72 1.44-.36 2.94-.54 4.56-.54 2.58 0 4.86.6 6.72 1.74.24.12.42.36.42.66 0 .36-.24.66-.48.66zm1.2-2.82c-.3 0-.48-.12-.72-.24-1.86-1.14-4.68-1.8-7.62-1.8-1.5 0-3.06.18-4.5.6-.18.06-.3.06-.48.06-.48 0-.84-.36-.84-.84 0-.48.24-.78.72-.9 1.68-.48 3.36-.72 5.16-.72 3.24 0 6.3.78 8.4 2.04.36.24.6.54.6.96-.06.48-.36.84-.72.84zM17 11.1c-1.98-1.14-5.28-1.32-7.2-.72-.24.06-.48.12-.66.12-.66 0-1.02-.48-1.02-1.02 0-.6.36-.9.78-1.02 2.28-.66 6-.48 8.34.84.42.24.66.6.66 1.02 0 .48-.36 1.02-.9 1.02-.24 0-.42-.06-.54-.12z")
}
