@file:OptIn(ExperimentalLayoutApi::class)

package com.pstparoles.app.ui.screens

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.interaction.DragInteraction
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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.pstparoles.app.core.findLineIndexAt
import com.pstparoles.app.core.formatMs
import com.pstparoles.app.core.formatOffset
import com.pstparoles.app.data.TRANSLATE_LANGUAGES
import com.pstparoles.app.data.sourceLabel
import com.pstparoles.app.ui.LyricsContent
import com.pstparoles.app.ui.MainViewModel
import com.pstparoles.app.ui.SyncBarState
import com.pstparoles.app.ui.components.CoverStack
import com.pstparoles.app.ui.components.Header
import com.pstparoles.app.ui.components.PstIcons
import com.pstparoles.app.ui.components.ToolButton
import com.pstparoles.app.ui.theme.Pst
import com.pstparoles.app.ui.theme.PstFonts
import kotlinx.coroutines.isActive

private enum class LineStatus { Idle, Done, Active, Next }

@Composable
fun LyricsScreen(vm: MainViewModel, onConnectSpotify: () -> Unit) {
    val song = vm.song ?: return
    val insets = WindowInsets.safeDrawing.asPaddingValues()
    val listState = rememberLazyListState()
    val screenHeight = LocalConfiguration.current.screenHeightDp.dp

    // ---------- horloge d'affichage (~60 images/s pendant la lecture) ----------
    val clock = remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    val hasPlayback = vm.playback != null
    LaunchedEffect(hasPlayback) {
        while (isActive && vm.playback != null) {
            withFrameMillis { }
            clock.longValue = SystemClock.elapsedRealtime()
        }
    }

    // ---------- ligne en cours ----------
    val synced = vm.lyrics as? LyricsContent.Synced
    // derivedStateOf : recalculé à chaque image, mais ne déclenche une
    // recomposition que lorsque la ligne active change réellement.
    val activeIndex by remember(synced) {
        derivedStateOf {
            val lines = synced?.lines ?: return@derivedStateOf -1
            if (!vm.karaokeActive) return@derivedStateOf -1
            val pos = vm.playback?.estimatedProgress(clock.longValue) ?: return@derivedStateOf -1
            findLineIndexAt(lines, pos - vm.syncOffsetMs)
        }
    }

    // ---------- éléments avant les paroles (pour retrouver l'index d'une ligne) ----------
    val showBanner = !vm.concert && !vm.spotifyConnected && !vm.bannerDismissed
    val syncState = vm.syncBarState
    val preKeys = buildList {
        if (!vm.concert) {
            add("header")
            add("back")
            if (showBanner) add("banner")
        }
        if (vm.playback != null) add("progress")
        if (!vm.concert) {
            add("song")
            add("toolbar")
            if (syncState != SyncBarState.Hidden) add("sync")
        }
    }
    val firstLineIndex = preKeys.size

    // ---------- défilement automatique, sauf si l'utilisateur vient de défiler lui-même ----------
    var lastManualScroll by remember { mutableLongStateOf(0L) }
    LaunchedEffect(listState) {
        listState.interactionSource.interactions.collect {
            if (it is DragInteraction.Start) lastManualScroll = SystemClock.elapsedRealtime()
        }
    }
    LaunchedEffect(activeIndex, vm.concert) {
        if (activeIndex < 0) return@LaunchedEffect
        if (SystemClock.elapsedRealtime() - lastManualScroll < 6_000) return@LaunchedEffect
        val target = firstLineIndex + activeIndex
        val info = listState.layoutInfo
        val viewport = info.viewportEndOffset - info.viewportStartOffset
        val visible = info.visibleItemsInfo.firstOrNull { it.index == target }
        if (visible != null) {
            listState.animateScrollBy((visible.offset + visible.size / 2 - viewport / 2).toFloat(), tween(450))
        } else {
            listState.animateScrollToItem(target)
            listState.animateScrollBy(-(viewport / 2f) + 40f, tween(300))
        }
    }

    val textSizeSp = if (vm.concert) {
        (LocalConfiguration.current.screenWidthDp * 0.075f).coerceIn(32f, 54f)
    } else {
        vm.textSize.toFloat()
    }

    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        LazyColumn(
            state = listState,
            modifier = Modifier.widthIn(max = if (vm.concert) 1000.dp else 760.dp).fillMaxSize(),
            contentPadding = PaddingValues(
                start = 18.dp,
                end = 18.dp,
                top = insets.calculateTopPadding() + if (vm.concert) 72.dp else 28.dp,
                // en mode concert, la dernière ligne peut monter jusqu'au centre de l'écran
                bottom = insets.calculateBottomPadding() + if (vm.concert) screenHeight * 0.45f else 110.dp,
            ),
        ) {
            for (k in preKeys) {
                item(key = k) {
                    when (k) {
                        "header" -> Header(vm)
                        "back" -> Text(
                            "← Retour aux résultats",
                            color = Pst.muted,
                            fontSize = 14.sp,
                            modifier = Modifier
                                .padding(top = 22.dp, bottom = 16.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .clickable(onClick = vm::showResults)
                                .padding(vertical = 6.dp),
                        )
                        "banner" -> SpotifyBanner(onConnect = onConnectSpotify, onDismiss = { vm.bannerDismissed = true })
                        "progress" -> SpotifyPanel(vm, clock)
                        "song" -> SongHead(vm)
                        "toolbar" -> Toolbar(vm)
                        "sync" -> SyncBar(vm, syncState)
                    }
                }
            }

            lyricsItems(vm, activeIndex, textSizeSp)

            if (!vm.concert) {
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
}

// ============================ paroles ============================

private fun LazyListScope.lyricsItems(vm: MainViewModel, activeIndex: Int, textSizeSp: Float) {
    when (val content = vm.lyrics) {
        LyricsContent.None -> Unit

        is LyricsContent.Loading -> item(key = "loading") {
            Text(content.message, fontFamily = PstFonts.serif, fontSize = textSizeSp.sp, color = Pst.muted)
        }

        is LyricsContent.Message -> item(key = "message") {
            Column {
                Text(content.text, fontFamily = PstFonts.serif, fontSize = textSizeSp.sp, color = Pst.lyric, lineHeight = 1.5.em)
                content.geniusUrl?.let { GeniusLink(it) }
            }
        }

        is LyricsContent.Embed -> item(key = "embed") {
            Column {
                Text("Paroles via le widget officiel Genius :", color = Pst.muted, fontSize = 13.sp)
                Spacer(Modifier.height(10.dp))
                GeniusEmbed(content.html)
                content.geniusUrl?.let { GeniusLink(it) }
            }
        }

        is LyricsContent.Plain -> {
            val lines = content.text.split('\n')
            itemsIndexed(lines, key = { i, _ -> "plain$i" }) { i, line ->
                LyricLine(vm, i, line, null, LineStatus.Idle, synced = false, textSizeSp)
            }
        }

        is LyricsContent.Synced -> {
            val karaoke = vm.karaokeActive
            itemsIndexed(content.lines, key = { i, _ -> "sync$i" }) { i, line ->
                val status = when {
                    !karaoke || activeIndex < 0 -> LineStatus.Idle
                    i < activeIndex -> LineStatus.Done
                    i == activeIndex -> LineStatus.Active
                    i == activeIndex + 1 -> LineStatus.Next
                    else -> LineStatus.Idle
                }
                LyricLine(vm, i, line.text, content.translations?.getOrNull(i), status, synced = karaoke, textSizeSp)
            }
        }
    }
}

@Composable
private fun LyricLine(
    vm: MainViewModel,
    index: Int,
    rawText: String,
    translation: String?,
    status: LineStatus,
    synced: Boolean,
    textSizeSp: Float,
) {
    val text = rawText.trim()
    if (text.isEmpty()) {
        Spacer(Modifier.height((textSizeSp * 0.45f).dp))
        return
    }

    val picked = vm.picking && index in vm.picked
    val isTag = text.startsWith("[")
    val targetColor = when {
        picked -> Pst.accent
        isTag -> Pst.faint
        !synced -> Pst.lyric
        status == LineStatus.Active -> Pst.accent
        status == LineStatus.Done -> Pst.syncDone
        status == LineStatus.Next -> Pst.syncNext
        else -> Pst.syncIdle
    }
    val color by animateColorAsState(targetColor, tween(280), label = "lineColor")
    val scale by animateFloatAsState(
        if (synced && status == LineStatus.Active) (if (vm.concert) 1.06f else 1.04f) else 1f,
        tween(280),
        label = "lineScale",
    )
    val trColor = when (status) {
        LineStatus.Active -> Pst.accent.copy(alpha = 0.74f)
        LineStatus.Next -> Pst.syncIdle
        LineStatus.Done -> Color(0xFF4A4951)
        LineStatus.Idle -> Pst.faint
    }

    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = if (isTag) 18.dp else 0.dp, bottom = if (translation != null) 9.dp else 2.dp)
            .then(
                if (vm.picking) {
                    Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (picked) Pst.accent.copy(alpha = 0.16f) else Color.Transparent)
                        .drawBehind {
                            if (picked) drawRect(Pst.accent, size = size.copy(width = 2.dp.toPx()))
                        }
                        .clickable { vm.togglePick(index) }
                        .padding(horizontal = 10.dp, vertical = 2.dp)
                } else {
                    Modifier
                }
            )
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                transformOrigin = if (vm.concert) TransformOrigin.Center else TransformOrigin(0f, 0.5f)
            },
    ) {
        Text(
            text,
            fontFamily = PstFonts.serif,
            fontSize = textSizeSp.sp,
            lineHeight = if (vm.concert) 1.5.em else 1.75.em,
            color = color,
            textAlign = if (vm.concert) TextAlign.Center else TextAlign.Start,
            modifier = Modifier.fillMaxWidth(),
        )
        if (!translation.isNullOrBlank() && translation != text) {
            Text(
                translation,
                fontFamily = PstFonts.sans,
                fontSize = (textSizeSp * if (vm.concert) 0.5f else 0.68f).sp,
                lineHeight = 1.45.em,
                color = trColor,
                textAlign = if (vm.concert) TextAlign.Center else TextAlign.Start,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun GeniusLink(url: String) {
    val context = LocalContext.current
    Text(
        "Lire les paroles sur Genius →",
        color = Pst.accent,
        fontSize = 14.sp,
        modifier = Modifier
            .padding(top = 16.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }
            .padding(vertical = 6.dp),
    )
}

/**
 * Widget officiel Genius. Son script utilise document.write() : chargé comme
 * contenu initial de la WebView (et non injecté après coup), il fonctionne
 * normalement.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun GeniusEmbed(html: String) {
    key(html) {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    setBackgroundColor(android.graphics.Color.WHITE)
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                            if (!request.isForMainFrame) return false
                            runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                            return true
                        }
                    }
                    val page = """
                        <!doctype html><html><head>
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <style>
                          html, body { margin: 0; padding: 0; background: #fff; }
                          iframe { width: 100% !important; }
                        </style>
                        </head><body>$html</body></html>
                    """.trimIndent()
                    loadDataWithBaseURL("https://genius.com/", page, "text/html", "utf-8", null)
                }
            },
            modifier = Modifier.fillMaxWidth().height(700.dp).clip(RoundedCornerShape(16.dp)),
        )
    }
}

// ============================ en-tête de chanson ============================

@Composable
private fun SongHead(vm: MainViewModel) {
    val song = vm.song ?: return
    Row(Modifier.padding(bottom = 22.dp), verticalAlignment = Alignment.CenterVertically) {
        CoverStack(song.title, song.artist, song.thumbnail, vm.songKey, onCoverClick = { vm.lightboxOpen = true })
        Column(Modifier.weight(1f)) {
            Text(song.title, fontFamily = PstFonts.serif, fontSize = 34.sp, lineHeight = 1.08.em, letterSpacing = (-0.4).sp)
            Spacer(Modifier.height(7.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    song.displayArtist ?: song.artist,
                    color = Pst.muted,
                    fontSize = 14.5.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Text(" · ", color = Pst.muted, fontSize = 14.5.sp)
                Text(sourceLabel(song.source), color = Pst.muted, fontFamily = PstFonts.mono, fontSize = 11.5.sp)
            }
        }
    }
}

// ============================ barre d'outils ============================

@Composable
private fun Toolbar(vm: MainViewModel) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }
    var languagesOpen by remember { mutableStateOf(false) }
    LaunchedEffect(copied) {
        if (copied) {
            kotlinx.coroutines.delay(1500)
            copied = false
        }
    }

    FlowRow(
        Modifier.padding(bottom = 22.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (vm.hasLyrics) {
            ToolButton(if (copied) "✓ Copié" else "Copier les paroles", onClick = {
                clipboard.setText(AnnotatedString(vm.copyableText))
                copied = true
            })
        }
        ToolButton("Partager", onClick = {
            val song = vm.song ?: return@ToolButton
            val text = buildString {
                append("${song.title} — ${song.displayArtist ?: song.artist}")
                song.url?.let { append("\n").append(it) }
            }
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
            context.startActivity(Intent.createChooser(send, null))
        })

        if (vm.hasLyrics) {
            ToolButton("Créer une carte", icon = PstIcons.Card, active = vm.picking, onClick = {
                if (vm.picking) vm.stopPicking() else vm.startPicking()
            })
            ToolButton("Mode concert", icon = PstIcons.Fullscreen, onClick = vm::enterConcert)
            ToolButton(
                if (vm.isSaved) "Enregistré" else "Enregistrer",
                icon = if (vm.isSaved) PstIcons.BookmarkFilled else PstIcons.Bookmark,
                active = vm.isSaved,
                onClick = vm::toggleSave,
            )

            Box {
                val label = when {
                    vm.translating -> "Traduction…"
                    vm.translateTarget.isNotEmpty() ->
                        "Traduit : " + (TRANSLATE_LANGUAGES.firstOrNull { it.first == vm.translateTarget }?.second ?: vm.translateTarget)
                    else -> "Traduire vers…"
                }
                ToolButton(
                    label,
                    active = vm.translateTarget.isNotEmpty(),
                    enabled = !vm.translating,
                    onClick = { languagesOpen = true },
                )
                DropdownMenu(
                    expanded = languagesOpen,
                    onDismissRequest = { languagesOpen = false },
                    containerColor = Pst.panel,
                    shape = RoundedCornerShape(14.dp),
                ) {
                    for ((code, name) in TRANSLATE_LANGUAGES) {
                        DropdownMenuItem(
                            text = { Text(name, color = if (code == vm.translateTarget) Pst.accent else Pst.text) },
                            onClick = {
                                languagesOpen = false
                                vm.translate(code)
                            },
                        )
                    }
                }
            }
            if (vm.translating) {
                CircularProgressIndicator(
                    color = Pst.accent,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp).align(Alignment.CenterVertically),
                )
            }
            if (vm.translateTarget.isNotEmpty() && !vm.translating) {
                ToolButton("Original", onClick = vm::restoreOriginal)
            }
        }

        if (vm.spotifyConnected) {
            ToolButton(
                if (vm.autoFollow) "Suit Spotify ✓" else "Suivre Spotify",
                active = vm.autoFollow,
                tint = Pst.spotify,
                onClick = vm::toggleAutoFollow,
            )
        }

        // A− 19px A+
        Row(
            Modifier
                .clip(RoundedCornerShape(999.dp))
                .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(999.dp)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("A−", fontSize = 13.sp, color = Pst.muted, modifier = Modifier.clickable { vm.changeTextSize(-1) }.padding(horizontal = 12.dp, vertical = 8.dp))
            Text("${vm.textSize}px", fontFamily = PstFonts.mono, fontSize = 11.sp, color = Pst.faint)
            Text("A+", fontSize = 15.sp, color = Pst.muted, modifier = Modifier.clickable { vm.changeTextSize(1) }.padding(horizontal = 12.dp, vertical = 7.dp))
        }
    }
}

// ============================ Spotify ============================

private val SpotifyCardBrush = Brush.linearGradient(listOf(Color(0x1F1DB954), Color(0x081DB954)))

@Composable
private fun SpotifyBanner(onConnect: () -> Unit, onDismiss: () -> Unit) {
    Row(
        Modifier
            .padding(bottom = 18.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, Pst.spotify.copy(alpha = 0.28f), RoundedCornerShape(16.dp))
            .background(SpotifyCardBrush)
            .padding(start = 14.dp, top = 12.dp, bottom = 12.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(PstIcons.Spotify, contentDescription = null, tint = Pst.spotify, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("Connecte Spotify", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text("Récupère automatiquement les paroles de ce que tu écoutes.", color = Pst.muted, fontSize = 12.sp, lineHeight = 15.sp)
        }
        Spacer(Modifier.width(8.dp))
        Text(
            "Connecter",
            color = Color(0xFF06170D),
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(Pst.spotify)
                .clickable(onClick = onConnect)
                .padding(horizontal = 14.dp, vertical = 8.dp),
        )
        Box(Modifier.size(34.dp).clip(CircleShape).clickable(onClick = onDismiss), contentAlignment = Alignment.Center) {
            Icon(PstIcons.Close, contentDescription = "Masquer", tint = Pst.faint, modifier = Modifier.size(13.dp))
        }
    }
}

@Composable
private fun SpotifyPanel(vm: MainViewModel, clock: State<Long>) {
    val pb = vm.playback ?: return
    val pos = pb.estimatedProgress(clock.value)
    val fraction = if (pb.durationMs > 0) (pos.toFloat() / pb.durationMs).coerceIn(0f, 1f) else 0f

    Column(
        Modifier
            .padding(bottom = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, Pst.spotify.copy(alpha = 0.28f), RoundedCornerShape(16.dp))
            .background(SpotifyCardBrush)
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(PstIcons.Spotify, contentDescription = null, tint = Pst.spotify, modifier = Modifier.size(15.dp))
            Spacer(Modifier.width(6.dp))
            Text("EN ÉCOUTE", color = Pst.spotify, fontFamily = PstFonts.mono, fontSize = 11.sp, letterSpacing = 0.6.sp, fontWeight = FontWeight.Medium)
        }
        Text(
            "${pb.title} — ${pb.artist}",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 5.dp, bottom = 8.dp),
        )
        Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(999.dp)).background(Color.White.copy(alpha = 0.1f))) {
            Box(Modifier.fillMaxWidth(fraction).fillMaxHeight().clip(RoundedCornerShape(999.dp)).background(Pst.spotify))
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
            Text(formatMs(pos), fontFamily = PstFonts.mono, fontSize = 11.sp, color = Pst.faint, modifier = Modifier.weight(1f))
            Text(formatMs(pb.durationMs), fontFamily = PstFonts.mono, fontSize = 11.sp, color = Pst.faint)
        }
        Row(
            Modifier.fillMaxWidth().padding(top = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ControlButton(PstIcons.Previous, "Titre précédent", 34, primary = false, enabled = !vm.controlsBusy, onClick = vm::skipPrevious)
            ControlButton(
                if (pb.isPlaying) PstIcons.Pause else PstIcons.Play,
                "Lecture / Pause",
                42,
                primary = true,
                enabled = !vm.controlsBusy,
                onClick = vm::togglePlayPause,
            )
            ControlButton(PstIcons.Next, "Titre suivant", 34, primary = false, enabled = !vm.controlsBusy, onClick = vm::skipNext)
        }
    }
}

@Composable
private fun ControlButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    sizeDp: Int,
    primary: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .size(sizeDp.dp)
            .graphicsLayer { alpha = if (enabled) 1f else 0.4f }
            .clip(CircleShape)
            .background(if (primary) Pst.spotify else Pst.spotify.copy(alpha = 0.12f))
            .border(1.dp, Pst.spotify.copy(alpha = if (primary) 1f else 0.3f), CircleShape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = description,
            tint = if (primary) Color(0xFF06110A) else Pst.spotify,
            modifier = Modifier.size(16.dp),
        )
    }
}

@Composable
private fun SyncBar(vm: MainViewModel, state: SyncBarState) {
    val neutral = state == SyncBarState.Unavailable
    val accent = if (neutral) Pst.faint else Pst.spotify
    val pulse by rememberInfiniteTransition(label = "pulse")
        .animateFloat(0.35f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "dot")

    Row(
        Modifier
            .padding(top = 0.dp, bottom = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, accent.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
            .background(if (neutral) Color.White.copy(alpha = 0.03f) else Pst.spotify.copy(alpha = 0.08f))
            .padding(horizontal = 13.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(7.dp)
                .graphicsLayer { alpha = if (state == SyncBarState.Synced) pulse else 1f }
                .clip(CircleShape)
                .background(accent)
        )
        Spacer(Modifier.width(9.dp))
        Text(
            when (state) {
                SyncBarState.Synced -> "Synchronisé avec Spotify"
                SyncBarState.Paused -> "Lecture en pause"
                else -> "Pas de paroles synchronisées pour cette chanson"
            },
            color = if (neutral) Pst.muted else Pst.spotify,
            fontSize = 12.5.sp,
            modifier = Modifier.weight(1f),
        )
        if (!neutral) {
            // Décalage manuel : afficher les paroles plus tôt / plus tard.
            Text("−", color = Pst.muted, fontSize = 18.sp, modifier = Modifier.clip(CircleShape).clickable { vm.changeSyncOffset(-100) }.padding(horizontal = 10.dp))
            Text(formatOffset(vm.syncOffsetMs), fontFamily = PstFonts.mono, fontSize = 11.sp, color = Pst.muted)
            Text("+", color = Pst.muted, fontSize = 18.sp, modifier = Modifier.clip(CircleShape).clickable { vm.changeSyncOffset(100) }.padding(horizontal = 10.dp))
        }
    }
}
