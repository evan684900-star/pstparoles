package com.pstparoles.app.ui.components

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pstparoles.app.data.AVAILABLE_SOURCES
import com.pstparoles.app.ui.MainViewModel
import com.pstparoles.app.ui.theme.Pst
import com.pstparoles.app.ui.theme.PstFonts

private val PanelShape = RoundedCornerShape(16.dp)

/** En-tête commun : logo (retour à l'accueil), bibliothèque, paramètres. */
@Composable
fun Header(vm: MainViewModel, modifier: Modifier = Modifier) {
    var libraryOpen by remember { mutableStateOf(false) }
    var settingsOpen by remember { mutableStateOf(false) }

    // Barres du menu à la verticale, roue qui fait un demi-tour (lentement, sans rebond).
    val menuRotation by animateFloatAsState(
        if (libraryOpen) 90f else 0f,
        tween(420, easing = CubicBezierEasing(0.3f, 0.9f, 0.3f, 1.2f)),
        label = "menu",
    )
    val gearRotation by animateFloatAsState(
        if (settingsOpen) 180f else 0f,
        tween(900, easing = CubicBezierEasing(0.25f, 0.8f, 0.3f, 1f)),
        label = "gear",
    )

    Column(modifier.fillMaxWidth()) {
        Row(
            Modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClickLabel = "Retour à l'accueil",
                    onClick = vm::goHome,
                ),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            EqBars()
            Spacer(Modifier.width(10.dp))
            Text("pstparoles", fontSize = 30.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.6).sp)
        }
        Spacer(Modifier.height(6.dp))
        Text(
            "Trouve les paroles de ta chanson préférée, sans pub ni détour.",
            color = Pst.muted,
            fontSize = 14.5.sp,
        )
        Spacer(Modifier.height(14.dp))

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.09f), RoundedCornerShape(999.dp))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(6.dp).clip(CircleShape).background(Color(0xFF7DDB9B)))
                Spacer(Modifier.width(6.dp))
                Text("Genius + LRCLIB + plus", fontFamily = PstFonts.mono, fontSize = 10.5.sp, color = Pst.muted)
            }

            Box {
                IconCircleButton(PstIcons.Menu, "Bibliothèque", libraryOpen, menuRotation) {
                    settingsOpen = false
                    libraryOpen = !libraryOpen
                }
                DropdownMenu(
                    expanded = libraryOpen,
                    onDismissRequest = { libraryOpen = false },
                    shape = PanelShape,
                    containerColor = Pst.panel,
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f)),
                ) {
                    LibraryPanel(vm) { libraryOpen = false }
                }
            }

            Box {
                IconCircleButton(PstIcons.Settings, "Paramètres", settingsOpen, gearRotation) {
                    libraryOpen = false
                    settingsOpen = !settingsOpen
                }
                DropdownMenu(
                    expanded = settingsOpen,
                    onDismissRequest = { settingsOpen = false },
                    shape = PanelShape,
                    containerColor = Pst.panel,
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f)),
                ) {
                    SettingsPanel(vm) { settingsOpen = false }
                }
            }
        }
    }
}

@Composable
private fun PanelHeader(title: String, count: Int? = null) {
    Row(
        Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 4.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.weight(1f))
        if (count != null) {
            Text(
                count.toString(),
                fontFamily = PstFonts.mono,
                fontSize = 11.sp,
                color = Pst.faint,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            )
        }
    }
    HorizontalDivider(color = Color.White.copy(alpha = 0.08f))
    Spacer(Modifier.height(6.dp))
}

@Composable
private fun LibraryPanel(vm: MainViewModel, close: () -> Unit) {
    Column(Modifier.width(300.dp)) {
        PanelHeader("Bibliothèque", vm.library.size)
        if (vm.library.isEmpty()) {
            Text(
                "Aucune chanson enregistrée pour l'instant.",
                color = Pst.faint,
                fontSize = 13.sp,
                modifier = Modifier.padding(14.dp),
            )
        }
        for (item in vm.library) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .clickable {
                        close()
                        vm.openLibraryItem(item)
                    }
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CoverArt(item.title, item.artist, item.thumbnail, 38.dp, 8.dp, initialsSize = 14.sp)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(item.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(item.artist, color = Pst.muted, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Box(
                    Modifier.size(30.dp).clip(CircleShape).clickable { vm.removeFromLibrary(item) },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(PstIcons.Close, contentDescription = "Retirer", tint = Pst.faint, modifier = Modifier.size(14.dp))
                }
            }
        }
    }
}

@Composable
private fun SettingsPanel(vm: MainViewModel, close: () -> Unit) {
    Column(Modifier.width(300.dp)) {
        PanelHeader("Sources des paroles")
        Text(
            "Moins de sources activées = résultats plus rapides, mais moins de chances de trouver la chanson.",
            color = Pst.faint,
            fontSize = 12.sp,
            lineHeight = 16.sp,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 4.dp),
        )
        for (source in AVAILABLE_SOURCES) {
            val checked = source.key in vm.enabledSources
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .clickable { vm.setSourceEnabled(source.key, !checked) }
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = checked,
                    onCheckedChange = { vm.setSourceEnabled(source.key, it) },
                    colors = CheckboxDefaults.colors(checkedColor = Pst.accent, checkmarkColor = Pst.onAccent, uncheckedColor = Pst.faint),
                )
                Text(source.label, fontSize = 14.sp, modifier = Modifier.weight(1f))
                if (source.badge != null) MonoBadge(source.badge.uppercase(), Pst.accent, Modifier.padding(end = 8.dp))
            }
        }

        if (vm.spotifyConnected) {
            Spacer(Modifier.height(8.dp))
            PanelHeader("Compte Spotify")
            Text(
                "Déconnecter Spotify",
                color = Pst.danger,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .border(1.dp, Color(0x47FF5050), RoundedCornerShape(10.dp))
                    .background(Color(0x14FF5050))
                    .clickable {
                        vm.disconnectSpotify()
                        close()
                    }
                    .padding(vertical = 10.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Spacer(Modifier.height(6.dp))
        }
    }
}
