# pstparoles — appli Android

Réécriture native (Kotlin + Jetpack Compose) du site pstparoles.

## Ouvrir et compiler

1. Android Studio → **File › Open** → choisir ce dossier `android/`.
2. Laisser la synchronisation Gradle se terminer (téléchargement du SDK et des dépendances au premier lancement).
3. Brancher un téléphone (ou lancer un émulateur) → bouton ▶ **Run**.

Pour un APK à installer directement : **Build › Build App Bundle(s) / APK(s) › Build APK(s)**,
ou en ligne de commande `./gradlew assembleRelease`.
L'APK sort dans `app/build/outputs/apk/release/app-release.apk`. Il est signé avec la clé
de debug : installable tel quel, mais il faudra une vraie clé pour le Play Store.

## Deux réglages à faire une fois

**1. L'adresse du site.** L'appli réutilise les routes `/api/*` du site déployé sur Vercel
(recherche Genius, paroles, traduction, config Spotify), ce qui garde le jeton Genius sur le
serveur au lieu de l'embarquer dans l'APK. Vérifie la ligne `PST_API_BASE_URL` dans
`gradle.properties` : elle doit pointer vers le domaine de production du projet Vercel
(onglet **Domains** du projet).

**2. Spotify.** Dans le tableau de bord développeur Spotify de l'appli (le même que pour le
site), ajouter l'URI de redirection :

```
pstparoles://callback
```

Sans ça, la connexion Spotify renverra une erreur « INVALID_CLIENT: Invalid redirect URI ».

## Ce que fait l'appli

Tout ce que fait le site : recherche (et collage d'un lien YouTube — on peut aussi faire
« Partager » depuis l'appli YouTube vers pstparoles), paroles multi-sources avec repli sur le
widget Genius, connexion Spotify avec suivi en direct, karaoké synchronisé et réglage du
décalage, contrôles de lecture, traduction bilingue synchronisée avec cache, bibliothèque,
choix des sources, carte de citation partageable, mode concert (plein écran, écran toujours
allumé), pochette en grand, vinyle animé, et l'easter egg « karaoke ».

## Tests

La logique pure (parsing LRC, comparaison de titres, PKCE, découpage des titres YouTube…)
est dans `app/src/main/java/com/pstparoles/app/core/` et testée par
`./gradlew testDebugUnitTest`.
