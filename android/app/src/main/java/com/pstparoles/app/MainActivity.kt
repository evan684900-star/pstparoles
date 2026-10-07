package com.pstparoles.app

import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.browser.customtabs.CustomTabsIntent
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.pstparoles.app.ui.MainViewModel
import com.pstparoles.app.ui.PstApp
import com.pstparoles.app.ui.theme.PstTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val vm: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)

        // Le sondage Spotify ne tourne que lorsque l'appli est à l'écran.
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) = vm.onForeground()
            override fun onStop(owner: LifecycleOwner) = vm.onBackground()
        })

        // Après une rotation, l'intent de départ a déjà été traité.
        if (savedInstanceState == null) handleIntent(intent)

        setContent {
            PstTheme {
                PstApp(vm, onConnectSpotify = ::openSpotifyLogin)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        when (intent?.action) {
            // Retour de la page de connexion Spotify : pstparoles://callback?code=...&state=...
            Intent.ACTION_VIEW -> {
                val data = intent.data ?: return
                if (data.scheme == "pstparoles" && data.host == "callback") {
                    vm.completeSpotifyLogin(
                        code = data.getQueryParameter("code"),
                        state = data.getQueryParameter("state"),
                        error = data.getQueryParameter("error"),
                    )
                }
            }
            // "Partager" depuis une autre appli (YouTube, navigateur...).
            Intent.ACTION_SEND -> {
                intent.getStringExtra(Intent.EXTRA_TEXT)?.takeIf { it.isNotBlank() }?.let(vm::openSharedText)
            }
        }
    }

    private fun openSpotifyLogin() {
        lifecycleScope.launch {
            val url = vm.spotifyAuthUrl() ?: return@launch
            val uri = Uri.parse(url)
            try {
                CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this@MainActivity, uri)
            } catch (e: ActivityNotFoundException) {
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
            }
        }
    }
}
