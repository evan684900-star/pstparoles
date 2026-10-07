@file:OptIn(ExperimentalLayoutApi::class)

package com.pstparoles.app.ui.components

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.pstparoles.app.core.initials
import com.pstparoles.app.ui.theme.Pst
import com.pstparoles.app.ui.theme.PstFonts
import com.pstparoles.app.ui.theme.songTint
import kotlinx.coroutines.delay
import kotlin.math.ceil
import kotlin.random.Random

val EaseOutSoft = CubicBezierEasing(0.2f, 0.8f, 0.2f, 1f)

tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/** Apparition en cascade des éléments de liste (animation "rise" du site). */
@Composable
fun Modifier.rise(delayMs: Int, key: Any?): Modifier {
    val progress = remember(key) { Animatable(0f) }
    LaunchedEffect(key) {
        delay(delayMs.toLong())
        progress.animateTo(1f, tween(500, easing = EaseOutSoft))
    }
    return graphicsLayer {
        alpha = progress.value
        translationY = (1f - progress.value) * 14.dp.toPx()
    }
}

/** Pochette : image si disponible, sinon dégradé à la couleur de la chanson + initiales. */
@Composable
fun CoverArt(
    title: String,
    artist: String,
    thumbnail: String?,
    side: Dp,
    corner: Dp,
    modifier: Modifier = Modifier,
    initialsSize: TextUnit = 22.sp,
) {
    val tint = songTint(title, artist)
    Box(
        modifier
            .size(side)
            .clip(RoundedCornerShape(corner))
            .background(Brush.linearGradient(listOf(tint, Pst.bg)))
            .drawWithContent {
                drawContent()
                // rayures diagonales, comme sur le site
                val step = 10.dp.toPx()
                val stroke = 3.5.dp.toPx()
                var x = -this.size.height
                while (x < this.size.width) {
                    drawLine(
                        Color.Black.copy(alpha = 0.18f),
                        Offset(x, this.size.height),
                        Offset(x + this.size.height, 0f),
                        strokeWidth = stroke,
                    )
                    x += step
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        if (thumbnail != null) {
            AsyncImage(
                model = thumbnail,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Text(initials(artist), fontFamily = PstFonts.serif, fontSize = initialsSize, color = Color.Black.copy(alpha = 0.6f))
        }
    }
}

/** Halo coloré en haut de l'écran, qui prend la couleur de la chanson affichée. */
@Composable
fun Halo(color: Color, replayKey: Any?, modifier: Modifier = Modifier) {
    val animated by animateColorAsState(color, tween(900), label = "halo")
    val intro = remember { Animatable(0f) }
    LaunchedEffect(replayKey) {
        intro.snapTo(0f)
        intro.animateTo(1f, tween(1200, easing = EaseOutSoft))
    }
    Canvas(modifier.fillMaxWidth().height(440.dp)) {
        val k = intro.value
        val radius = 460.dp.toPx() * (0.6f + 0.4f * k)
        val center = Offset(size.width / 2f, -30.dp.toPx())
        drawCircle(
            Brush.radialGradient(
                listOf(animated.copy(alpha = 0.40f * k), animated.copy(alpha = 0.12f * k), Color.Transparent),
                center = center,
                radius = radius,
            ),
            radius = radius,
            center = center,
        )
    }
}

/** Les quatre barres d'égaliseur animées du logo. */
@Composable
fun EqBars(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "eq")
    val delays = listOf(0, 180, 360, 540)
    val alphas = listOf(1f, 0.75f, 0.9f, 0.6f)
    Row(modifier.height(22.dp), horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.Bottom) {
        delays.forEachIndexed { i, d ->
            val scale by transition.animateFloat(
                initialValue = 0.3f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    tween(550, easing = FastOutSlowInEasing),
                    RepeatMode.Reverse,
                    initialStartOffset = StartOffset(d),
                ),
                label = "bar$i",
            )
            Box(
                Modifier
                    .width(3.dp)
                    .fillMaxHeight()
                    .graphicsLayer {
                        scaleY = scale
                        transformOrigin = TransformOrigin(0.5f, 1f)
                    }
                    .clip(RoundedCornerShape(2.dp))
                    .background(Pst.accent.copy(alpha = alphas[i]))
            )
        }
    }
}

/** Disque vinyle : sillons, reflets et étiquette à la couleur de la chanson. */
@Composable
fun VinylDisc(labelColor: Color, modifier: Modifier = Modifier) {
    val sheen = remember {
        listOf(0xFF16161A, 0xFF2A2A31, 0xFF131317, 0xFF26262C, 0xFF121216, 0xFF2A2A31, 0xFF16161A).map { Color(it) }
    }
    Canvas(modifier) {
        val r = size.minDimension / 2f
        val c = center
        drawCircle(Brush.sweepGradient(sheen, c), r, c)
        val grooveStep = 3.dp.toPx()
        var groove = r * 0.38f
        while (groove < r - 1f) {
            drawCircle(Color.White.copy(alpha = 0.05f), groove, c, style = Stroke(1f))
            groove += grooveStep
        }
        drawCircle(labelColor, r * 0.34f, c)
        drawCircle(Color.Black.copy(alpha = 0.25f), r * 0.34f, c, style = Stroke(1f))
        drawCircle(Pst.bg, 2.dp.toPx(), c)
        drawCircle(Color.White.copy(alpha = 0.06f), r - 0.5f, c, style = Stroke(1f))
    }
}

/** Pochette + vinyle qui sort à moitié de derrière elle et tourne en continu. */
@Composable
fun CoverStack(
    title: String,
    artist: String,
    thumbnail: String?,
    replayKey: Int,
    onCoverClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val tint = songTint(title, artist)
    val slide = remember(replayKey) { Animatable(0f) }
    LaunchedEffect(replayKey) {
        delay(250)
        slide.animateTo(1f, tween(1100, easing = EaseOutSoft))
    }
    val spin = rememberInfiniteTransition(label = "vinyl")
    val angle by spin.animateFloat(0f, 360f, infiniteRepeatable(tween(3400, easing = LinearEasing)), label = "angle")

    Box(modifier.padding(end = 46.dp).size(88.dp)) {
        VinylDisc(
            tint,
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    val k = slide.value
                    translationX = size.width * 0.52f * k
                    alpha = k
                    scaleX = 0.88f + 0.12f * k
                    scaleY = scaleX
                    rotationZ = angle
                },
        )
        CoverArt(
            title, artist, thumbnail, 88.dp, 14.dp,
            Modifier.clickable(onClick = onCoverClick),
            initialsSize = 32.sp,
        )
    }
}

private val KARAOKE_COLORS = listOf(
    0xFFFF3B30, 0xFFFF9500, 0xFFFFD60A, 0xFF34C759, 0xFF30B8C4, 0xFF5AC8FA, 0xFFAF7AC5, 0xFFFF2D95,
).map { Color(it) }

/** Easter egg : taper "karaoke" fait clignoter une grille colorée en fond pendant 10 s. */
@Composable
fun KaraokeFx(trigger: Int, modifier: Modifier = Modifier) {
    var active by remember { mutableStateOf(false) }
    var seed by remember { mutableIntStateOf(0) }
    LaunchedEffect(trigger) {
        if (trigger == 0) return@LaunchedEffect
        active = true
        val end = System.currentTimeMillis() + 10_000
        while (System.currentTimeMillis() < end) {
            seed++
            delay(140)
        }
        active = false
    }
    val alpha by animateFloatAsState(if (active) 0.28f else 0f, tween(350), label = "karaoke")
    if (alpha <= 0f) return

    Canvas(modifier.fillMaxSize().graphicsLayer { this.alpha = alpha }.background(Color.Black)) {
        val target = 56.dp.toPx()
        val gap = 3.dp.toPx()
        val cols = ceil(size.width / target).toInt().coerceAtLeast(1)
        val rows = ceil(size.height / target).toInt().coerceAtLeast(1)
        val cw = (size.width - gap) / cols - gap
        val ch = (size.height - gap) / rows - gap
        val corner = CornerRadius(5.dp.toPx())
        val rnd = Random(seed)
        for (r in 0 until rows) {
            for (c in 0 until cols) {
                val color = KARAOKE_COLORS[rnd.nextInt(KARAOKE_COLORS.size)]
                val topLeft = Offset(gap + c * (cw + gap), gap + r * (ch + gap))
                drawRoundRect(
                    Brush.radialGradient(
                        listOf(Color.White.copy(alpha = 0.85f), color),
                        center = topLeft + Offset(cw * 0.35f, ch * 0.3f),
                        radius = cw * 0.75f,
                    ),
                    topLeft = topLeft,
                    size = Size(cw, ch),
                    cornerRadius = corner,
                )
            }
        }
    }
}

/** Bouton "pilule" de la barre d'outils (.tool du site). */
@Composable
fun ToolButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    active: Boolean = false,
    enabled: Boolean = true,
    tint: Color = Pst.accent,
) {
    val shape = RoundedCornerShape(999.dp)
    val color = if (active) tint else Pst.text.copy(alpha = 0.86f)
    Row(
        modifier
            .clip(shape)
            .border(1.dp, if (active) tint.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.1f), shape)
            .background(if (active) tint.copy(alpha = 0.1f) else Color.White.copy(alpha = 0.03f))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 13.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(13.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(text, fontSize = 13.sp, color = color.copy(alpha = if (enabled) 1f else 0.4f), fontWeight = FontWeight.Medium)
    }
}

/** Bouton rond à icône (menu, paramètres), avec rotation animée à l'ouverture. */
@Composable
fun IconCircleButton(
    icon: ImageVector,
    contentDescription: String,
    expanded: Boolean,
    rotation: Float,
    onClick: () -> Unit,
) {
    val border = if (expanded) Pst.accent.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.09f)
    Box(
        Modifier
            .size(36.dp)
            .clip(CircleShape)
            .border(1.dp, border, CircleShape)
            .background(Color.White.copy(alpha = 0.03f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = contentDescription,
            tint = if (expanded) Pst.accent else Pst.muted,
            modifier = Modifier.size(18.dp).graphicsLayer { rotationZ = rotation },
        )
    }
}

/** Petite étiquette en police mono ("LRCLIB", "Le plus complet"...). */
@Composable
fun MonoBadge(text: String, color: Color = Pst.muted, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .border(1.dp, color.copy(alpha = 0.35f), RoundedCornerShape(999.dp))
            .padding(horizontal = 7.dp, vertical = 2.dp),
        fontFamily = PstFonts.mono,
        fontSize = 10.sp,
        color = color,
    )
}
