package com.pstparoles.app.ui.components

import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Build
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.pstparoles.app.data.Song
import com.pstparoles.app.ui.MainViewModel
import com.pstparoles.app.ui.theme.Pst
import java.io.File

/** Capte les appuis sans effet visuel (pour fermer en touchant le fond). */
private fun Modifier.plainClick(onClick: () -> Unit): Modifier = clickable(
    interactionSource = MutableInteractionSource(),
    indication = null,
    onClick = onClick,
)

/** Empêche un appui sur le contenu de fermer la surcouche en dessous. */
private fun Modifier.swallowTaps(): Modifier = pointerInput(Unit) { detectTapGestures { } }

@Composable
private fun CloseCircle(onClick: () -> Unit, modifier: Modifier = Modifier, rotation: Float = 0f) {
    Box(
        modifier
            .size(40.dp)
            .graphicsLayer { rotationZ = rotation }
            .clip(CircleShape)
            .border(1.dp, Color.White.copy(alpha = 0.14f), CircleShape)
            .background(Color.White.copy(alpha = 0.06f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(PstIcons.Close, contentDescription = "Fermer", tint = Pst.text, modifier = Modifier.size(18.dp))
    }
}

// ============================ pochette en grand ============================

private data class Pose(val scale: Float, val rotation: Float, val dy: Float)

/** Images clés du "pop" : petite et penchée → dépasse → rebondit → se pose. */
private val POP_KEYFRAMES = listOf(
    0.00f to Pose(0.30f, -9f, 70f),
    0.55f to Pose(1.12f, 3f, -14f),
    0.75f to Pose(0.95f, -1.5f, 4f),
    0.90f to Pose(1.02f, 0.5f, -1f),
    1.00f to Pose(1.00f, 0f, 0f),
)

private fun lerp(a: Float, b: Float, t: Float) = a + (b - a) * t

private fun poseAt(t: Float): Pose {
    val i = POP_KEYFRAMES.indexOfLast { it.first <= t }.coerceIn(0, POP_KEYFRAMES.size - 2)
    val (t0, a) = POP_KEYFRAMES[i]
    val (t1, b) = POP_KEYFRAMES[i + 1]
    val local = ((t - t0) / (t1 - t0)).coerceIn(0f, 1f)
    val eased = 1f - (1f - local) * (1f - local) * (1f - local)
    return Pose(lerp(a.scale, b.scale, eased), lerp(a.rotation, b.rotation, eased), lerp(a.dy, b.dy, eased))
}

@Composable
fun CoverLightbox(song: Song?, open: Boolean, onClose: () -> Unit) {
    AnimatedVisibility(visible = open && song != null, enter = fadeIn(tween(200)), exit = fadeOut(tween(200))) {
        val s = song ?: return@AnimatedVisibility
        val pop = remember { Animatable(0f) }
        val closeSpin = remember { Animatable(-180f) }
        LaunchedEffect(Unit) { pop.animateTo(1f, tween(320, easing = LinearEasing)) }
        LaunchedEffect(Unit) { closeSpin.animateTo(0f, tween(260, delayMillis = 50)) }
        val side = minOf(LocalConfiguration.current.screenWidthDp * 0.78f, 420f).dp

        Box(
            Modifier.fillMaxSize().background(Color(0xE6060608)).plainClick(onClose),
            contentAlignment = Alignment.Center,
        ) {
            CoverArt(
                s.title, s.artist, s.thumbnail, side, 22.dp,
                Modifier
                    .graphicsLayer {
                        val p = poseAt(pop.value)
                        scaleX = p.scale
                        scaleY = p.scale
                        rotationZ = p.rotation
                        translationY = p.dy.dp.toPx()
                        alpha = (pop.value / 0.55f).coerceAtMost(1f)
                    }
                    .shadow(30.dp, RoundedCornerShape(22.dp))
                    .swallowTaps(),
                initialsSize = 96.sp,
            )
            CloseCircle(
                onClose,
                Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(18.dp),
                rotation = closeSpin.value,
            )
        }
    }
}

// ============================ carte de citation ============================

@Composable
fun PickBar(vm: MainViewModel, modifier: Modifier = Modifier) {
    AnimatedVisibility(
        visible = vm.picking,
        enter = slideInVertically(tween(300)) { it } + fadeIn(tween(250)),
        exit = slideOutVertically(tween(250)) { it } + fadeOut(tween(200)),
        modifier = modifier,
    ) {
        val n = vm.picked.size
        Row(
            Modifier
                .navigationBarsPadding()
                .padding(bottom = 18.dp)
                .shadow(20.dp, RoundedCornerShape(999.dp))
                .clip(RoundedCornerShape(999.dp))
                .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(999.dp))
                .background(Color(0xF5121216))
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                if (n >= MainViewModel.MAX_PICKED_LINES) "Maximum ${MainViewModel.MAX_PICKED_LINES} lignes"
                else "Choisis jusqu'à ${MainViewModel.MAX_PICKED_LINES} lignes",
                color = Pst.muted,
                fontSize = 12.5.sp,
                modifier = Modifier.padding(start = 8.dp),
            )
            Text(
                "Annuler",
                color = Pst.muted,
                fontSize = 13.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(999.dp))
                    .clickable(onClick = vm::stopPicking)
                    .padding(horizontal = 13.dp, vertical = 8.dp),
            )
            val enabled = n > 0 && !vm.cardBusy
            Text(
                when {
                    vm.cardBusy -> "Création…"
                    n > 0 -> "Créer la carte ($n)"
                    else -> "Créer la carte"
                },
                color = Pst.onAccent,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                modifier = Modifier
                    .graphicsLayer { alpha = if (enabled) 1f else 0.4f }
                    .clip(RoundedCornerShape(999.dp))
                    .background(Pst.accent)
                    .clickable(enabled = enabled, onClick = vm::generateCard)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
fun CardPreview(vm: MainViewModel) {
    val file = vm.cardFile
    val context = LocalContext.current
    AnimatedVisibility(visible = file != null, enter = fadeIn(tween(250)), exit = fadeOut(tween(200))) {
        val f: File = file ?: return@AnimatedVisibility
        val bitmap = remember(f) { BitmapFactory.decodeFile(f.absolutePath)?.asImageBitmap() }

        Box(
            Modifier.fillMaxSize().background(Color(0xE6060608)).plainClick { vm.cardFile = null },
            contentAlignment = Alignment.Center,
        ) {
            Column(
                Modifier.padding(24.dp).swallowTaps(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (bitmap != null) {
                    val inner = remember { Animatable(0.9f) }
                    LaunchedEffect(Unit) { inner.animateTo(1f, tween(320)) }
                    Image(
                        bitmap,
                        contentDescription = "Aperçu de la carte de citation",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .widthIn(max = 400.dp)
                            .heightIn(max = (LocalConfiguration.current.screenHeightDp * 0.66f).dp)
                            .graphicsLayer { scaleX = inner.value; scaleY = inner.value }
                            .shadow(30.dp, RoundedCornerShape(16.dp))
                            .clip(RoundedCornerShape(16.dp)),
                    )
                }
                Spacer(Modifier.height(18.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ToolButton("Télécharger", onClick = vm::saveCardToGallery)
                    }
                    ToolButton("Partager", active = true, onClick = {
                        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", f)
                        val send = Intent(Intent.ACTION_SEND)
                            .setType("image/png")
                            .putExtra(Intent.EXTRA_STREAM, uri)
                            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        context.startActivity(Intent.createChooser(send, null))
                    })
                }
            }
            CloseCircle({ vm.cardFile = null }, Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(18.dp))
        }
    }
}

// ============================ mode concert ============================

@Composable
fun ConcertBar(vm: MainViewModel, modifier: Modifier = Modifier) {
    val song = vm.song ?: return
    AnimatedVisibility(visible = vm.concert, enter = fadeIn(tween(300)) + scaleIn(initialScale = 0.98f), exit = fadeOut(tween(200)), modifier = modifier) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(Color(0xF50A0A0C), Color(0xB30A0A0C), Color.Transparent)))
                .statusBarsPadding()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(song.title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(song.displayArtist ?: song.artist, color = Pst.muted, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            CloseCircle({ vm.concert = false })
        }
    }
}
