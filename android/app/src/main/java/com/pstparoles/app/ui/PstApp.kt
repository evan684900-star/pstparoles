package com.pstparoles.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.pstparoles.app.ui.components.CardPreview
import com.pstparoles.app.ui.components.ConcertBar
import com.pstparoles.app.ui.components.CoverLightbox
import com.pstparoles.app.ui.components.Halo
import com.pstparoles.app.ui.components.KaraokeFx
import com.pstparoles.app.ui.components.PickBar
import com.pstparoles.app.ui.components.findActivity
import com.pstparoles.app.ui.screens.HomeScreen
import com.pstparoles.app.ui.screens.LyricsScreen
import com.pstparoles.app.ui.theme.Pst
import com.pstparoles.app.ui.theme.songTint

@Composable
fun PstApp(vm: MainViewModel, onConnectSpotify: () -> Unit) {
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(Unit) {
        vm.messages.collect {
            snackbar.currentSnackbarData?.dismiss()
            snackbar.showSnackbar(it)
        }
    }

    ConcertWindowEffect(vm.concert)

    // Retour arrière : on ferme la couche la plus haute d'abord. Le dernier
    // BackHandler déclaré est prioritaire.
    BackHandler(enabled = vm.screen == Screen.Lyrics) { vm.showResults() }
    BackHandler(enabled = vm.concert) { vm.concert = false }
    BackHandler(enabled = vm.picking) { vm.stopPicking() }
    BackHandler(enabled = vm.lightboxOpen) { vm.lightboxOpen = false }
    BackHandler(enabled = vm.cardFile != null) { vm.cardFile = null }

    Box(Modifier.fillMaxSize().background(Pst.bg)) {
        val song = vm.song
        Halo(
            color = if (vm.screen == Screen.Lyrics && song != null) songTint(song.title, song.artist) else Pst.accent,
            replayKey = if (vm.screen == Screen.Lyrics) vm.songKey else -1,
        )
        KaraokeFx(vm.karaokeFxKey)

        AnimatedContent(
            targetState = vm.screen,
            transitionSpec = { fadeIn(tween(260)) togetherWith fadeOut(tween(180)) },
            label = "screen",
        ) { screen ->
            when (screen) {
                Screen.Home -> HomeScreen(vm)
                Screen.Lyrics -> LyricsScreen(vm, onConnectSpotify)
            }
        }

        ConcertBar(vm, Modifier.align(Alignment.TopCenter))
        PickBar(vm, Modifier.align(Alignment.BottomCenter))
        CoverLightbox(vm.song, vm.lightboxOpen) { vm.lightboxOpen = false }
        CardPreview(vm)

        SnackbarHost(
            snackbar,
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(16.dp),
        ) { data ->
            Snackbar(containerColor = Pst.panel, contentColor = Pst.text) { Text(data.visuals.message) }
        }
    }
}

/**
 * Mode concert : barres système masquées et écran qui ne s'éteint pas
 * (l'équivalent natif de l'API Wake Lock du site).
 */
@Composable
private fun ConcertWindowEffect(active: Boolean) {
    val view = LocalView.current
    DisposableEffect(active) {
        val window = view.context.findActivity()?.window
        if (window != null) {
            val controller = WindowCompat.getInsetsController(window, view)
            if (active) {
                controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                controller.hide(WindowInsetsCompat.Type.systemBars())
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars())
            }
        }
        view.keepScreenOn = active
        onDispose { view.keepScreenOn = false }
    }
}
