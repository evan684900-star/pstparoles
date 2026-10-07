@file:OptIn(ExperimentalLayoutApi::class)

package com.pstparoles.app.ui.screens

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pstparoles.app.data.SearchResult
import com.pstparoles.app.data.sourceLabel
import com.pstparoles.app.ui.MainViewModel
import com.pstparoles.app.ui.components.CoverArt
import com.pstparoles.app.ui.components.Header
import com.pstparoles.app.ui.components.MonoBadge
import com.pstparoles.app.ui.components.PstIcons
import com.pstparoles.app.ui.components.VinylDisc
import com.pstparoles.app.ui.components.rise
import com.pstparoles.app.ui.theme.Pst
import com.pstparoles.app.ui.theme.PstFonts

@Composable
fun HomeScreen(vm: MainViewModel) {
    val insets = WindowInsets.safeDrawing.asPaddingValues()
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        LazyColumn(
            modifier = Modifier.widthIn(max = 760.dp).fillMaxSize(),
            contentPadding = PaddingValues(
                start = 18.dp,
                end = 18.dp,
                top = insets.calculateTopPadding() + 28.dp,
                bottom = insets.calculateBottomPadding() + 96.dp,
            ),
        ) {
            item(key = "header") { Header(vm) }
            item(key = "search") {
                Spacer(Modifier.height(24.dp))
                SearchBar(vm)
            }
            if (vm.recents.isNotEmpty() && !vm.searching) {
                item(key = "recents") { Recents(vm) }
            }
            vm.homeStatus?.let { (text, isError) ->
                item(key = "status") {
                    Text(
                        text,
                        color = if (isError) Color(0xFFFF8A80) else Pst.muted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 14.dp, bottom = 4.dp, start = 4.dp),
                    )
                }
            }
            if (vm.searching) {
                item(key = "loading") { SearchingSkeleton() }
            }
            itemsIndexed(vm.results, key = { i, r -> "r$i-${r.id}-${r.title}" }) { i, result ->
                ResultRow(result, Modifier.rise(i * 70, vm.results)) { vm.openResult(result) }
            }
            if (!vm.searching && vm.results.isEmpty() && vm.homeStatus == null) {
                item(key = "empty") { EmptyState() }
            }
            item(key = "footer") {
                Text(
                    "Recherche via l'API Genius · Paroles via LRCLIB, lyrics.ovh & plus",
                    fontFamily = PstFonts.mono,
                    fontSize = 10.5.sp,
                    color = Pst.faint,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 48.dp),
                )
            }
        }
    }
}

@Composable
private fun SearchBar(vm: MainViewModel) {
    val keyboard = LocalSoftwareKeyboardController.current
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val submit = {
        keyboard?.hide()
        vm.search()
    }

    Column {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BasicTextField(
                value = vm.query,
                onValueChange = vm::onQueryChange,
                singleLine = true,
                interactionSource = interaction,
                textStyle = TextStyle(color = Pst.text, fontSize = 16.sp, fontFamily = PstFonts.sans),
                cursorBrush = SolidColor(Pst.accent),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { submit() }),
                modifier = Modifier.weight(1f),
                decorationBox = { inner ->
                    val shape = RoundedCornerShape(14.dp)
                    Row(
                        Modifier
                            .clip(shape)
                            .border(1.dp, if (focused) Pst.accent.copy(alpha = 0.55f) else Color.White.copy(alpha = 0.1f), shape)
                            .background(Color.White.copy(alpha = 0.035f))
                            .padding(horizontal = 16.dp, vertical = 15.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            PstIcons.Search,
                            contentDescription = null,
                            tint = if (focused) Pst.accent else Color(0xFF6F6E79),
                            modifier = Modifier.size(17.dp),
                        )
                        Spacer(Modifier.width(11.dp))
                        Box(Modifier.weight(1f)) {
                            if (vm.query.isEmpty()) {
                                Text("Artiste, titre, un bout de refrain…", color = Pst.faint, fontSize = 16.sp, maxLines = 1)
                            }
                            inner()
                        }
                    }
                },
            )
            Text(
                "Rechercher",
                color = Pst.onAccent,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .background(Pst.accent)
                    .clickable { submit() }
                    .padding(horizontal = 18.dp, vertical = 16.dp),
            )
        }

        if (vm.spotifyConnected) {
            Spacer(Modifier.height(10.dp))
            Row(
                Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .border(1.dp, Pst.spotify.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
                    .background(Pst.spotify.copy(alpha = 0.1f))
                    .clickable { vm.searchNowPlaying() }
                    .padding(horizontal = 16.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(PstIcons.Spotify, contentDescription = null, tint = Pst.spotify, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(8.dp))
                Text("En écoute", color = Pst.spotify, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            }
        }

        Text(
            "Tu peux aussi coller un lien YouTube à la place d'une recherche.",
            fontFamily = PstFonts.mono,
            fontSize = 10.5.sp,
            color = Pst.faint,
            modifier = Modifier.padding(top = 8.dp, start = 6.dp),
        )
    }
}

@Composable
private fun Recents(vm: MainViewModel) {
    Column(Modifier.padding(top = 16.dp)) {
        Text("RÉCENT", fontFamily = PstFonts.mono, fontSize = 10.sp, color = Pst.faint, letterSpacing = 1.sp)
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (q in vm.recents) {
                Text(
                    q,
                    fontSize = 13.sp,
                    color = Pst.text.copy(alpha = 0.85f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .widthIn(max = 260.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(999.dp))
                        .clickable { vm.search(q) }
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                )
            }
        }
    }
}

@Composable
private fun SearchingSkeleton() {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val pulse by transition.animateFloat(0.5f, 1f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "pulse")
    val angle by transition.animateFloat(0f, 360f, infiniteRepeatable(tween(1400, easing = LinearEasing)), label = "spin")

    Column(Modifier.padding(top = 18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            VinylDisc(Pst.accent, Modifier.size(22.dp).graphicsLayer { rotationZ = angle })
            Spacer(Modifier.width(10.dp))
            Text("Ça cherche…", color = Pst.muted, fontSize = 14.sp)
        }
        repeat(3) { i ->
            Row(
                Modifier.padding(top = 14.dp).graphicsLayer { alpha = pulse },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(56.dp).clip(RoundedCornerShape(10.dp)).background(Color.White.copy(alpha = 0.05f)))
                Spacer(Modifier.width(14.dp))
                Column {
                    Box(Modifier.width(listOf(180, 220, 150)[i].dp).height(12.dp).clip(RoundedCornerShape(6.dp)).background(Color.White.copy(alpha = 0.07f)))
                    Spacer(Modifier.height(8.dp))
                    Box(Modifier.width(listOf(110, 90, 120)[i].dp).height(10.dp).clip(RoundedCornerShape(5.dp)).background(Color.White.copy(alpha = 0.05f)))
                }
            }
        }
    }
}

@Composable
private fun ResultRow(result: SearchResult, modifier: Modifier, onClick: () -> Unit) {
    Row(
        modifier
            .padding(top = 10.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(14.dp))
            .background(Pst.surface)
            .clickable(onClick = onClick)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CoverArt(result.title, result.artist, result.thumbnail, 56.dp, 10.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(result.title, fontWeight = FontWeight.SemiBold, fontSize = 15.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(result.artist, color = Pst.muted, fontSize = 13.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))
        MonoBadge(sourceLabel(result.source))
        Spacer(Modifier.width(10.dp))
        Text("→", color = Pst.faint, fontSize = 16.sp)
    }
}

@Composable
private fun EmptyState() {
    Column(
        Modifier
            .padding(top = 28.dp)
            .fillMaxWidth()
            .drawBehind {
                drawRoundRect(
                    color = Color.White.copy(alpha = 0.1f),
                    style = Stroke(width = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f))),
                    cornerRadius = CornerRadius(18.dp.toPx()),
                )
            }
            .padding(horizontal = 20.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "Qu'est-ce qui te trotte dans la tête ?",
            fontFamily = PstFonts.serif,
            fontStyle = FontStyle.Italic,
            fontSize = 23.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Essaie avec l'artiste et le titre, ou juste un bout de refrain.",
            color = Pst.muted,
            fontSize = 13.5.sp,
            textAlign = TextAlign.Center,
        )
    }
}
