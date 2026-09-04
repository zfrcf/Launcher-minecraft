# Le vrai Minecraft Java dans le navigateur (client open source) — DonutSMP avec ton compte Microsoft

Tu avais raison sur un point : un client **réécrit de zéro**, sans une ligne de code Mojang, qui
parle le protocole officiel, est légal. Il existe : **Minecraft Web Client** (licence MIT, projet
PrismarineJS / zardoy). Il tourne dans le navigateur (PC et mobile), se connecte avec **ton compte
Microsoft** aux serveurs officiels en mode « online », et supporte les versions 1.8 à 1.21.11.
DonutSMP accepte les clients 1.7.2 à 26.2, donc 1.21.11 passe.

Une seule contrainte technique : un navigateur ne sait pas ouvrir une connexion TCP. Il faut un
**relais WebSocket** entre le navigateur et le serveur Minecraft. Le projet en fournit un public
et gratuit (utilisé par défaut), et tu peux héberger le tien sur Render (dossier prêt ici).

## Ton site : le client, prêt à jouer sur DonutSMP

Le dossier `site/` déploie sur Vercel la version compilée officielle du client (récupérée au
moment du build depuis le dépôt public de son intégration continue, dossier `docs/`). L'adresse
racine ouvre directement le menu du jeu avec `donutsmp.net` en 1.21.11 pré-rempli.
Pour redéployer ou changer de serveur : modifier `site/vercel.json` (redirection) puis
redéployer le projet Vercel `minecraft-donutsmp`.

### Le mod d'optimisation (`site/mod.js`)

Les mods Fabric (Sodium, Entity Culling, Dynamic FPS…) sont des mods Java : ils ne peuvent pas
tourner dans un navigateur. `site/mod.js` est leur équivalent côté navigateur, injecté en tête
de la page avant le client :

- **Profil performance** : tous les réglages du client poussés au maximum et adaptés à
  l'appareil (cœurs, mémoire, tactile) : carte graphique dédiée, moteur WASM, skins des
  joueurs désactivés, éclairage simplifié, pas de musique ni de télémétrie, écran maintenu
  allumé. Réappliqué automatiquement à chaque nouvelle version du mod, ou avec `?reset=1`.
- **Plein écran partout** : menus compris, sur PC et mobile, dès le premier clic ou touche.
  Le client ne peut plus le quitter tout seul ; seule la touche Échap du navigateur le fait,
  et on y revient au geste suivant. Sur iPhone/iPad (pas d'API plein écran dans Safari), un
  bandeau explique comment installer l'app sur l'écran d'accueil. `?fullscreen=0` désactive.
- **FPS adaptatif** : en jeu, la distance de rendu baisse d'un cran quand les FPS passent
  sous 24 (spawn de DonutSMP, foule) et remonte quand ils dépassent 50 de façon stable.
  `?hud=1` affiche un compteur FPS / distance de rendu en haut à gauche.

Les mods réels côté client (Fabric) restent la seule option pour des FPS élevés sur PC : voir
`minecraft-fabric/`.

## Jouer maintenant (0 installation, 0 inscription)

1. Ouvre <https://mcraft.fun/?ip=donutsmp.net&version=1.21.11> (ou le bouton sur
   <https://cubecraft-web.vercel.app/serveur>).
2. Clique sur le serveur → le client demande une **connexion Microsoft** : un code à saisir sur
   microsoft.com/link, avec ton compte Minecraft normal. Rien n'est stocké côté site : le jeton
   reste dans ton navigateur.
3. Tu es sur DonutSMP, avec ton pseudo, ton inventaire, ton île.

Sur mobile, les commandes tactiles sont intégrées (joystick, boutons). Choisis une petite
distance de rendu dans les réglages.

## Ton propre relais sur Render (recommandé si le relais public est lent ou bloqué)

Le relais public a une adresse IP de datacenter que certains serveurs traitent comme un VPN.
Le tien aussi (Render), mais il n'est utilisé que par toi : moins de risque de limitation.

1. Sur <https://render.com> (compte gratuit) → **New → Blueprint** → choisis ce dépôt → Render
   lit `minecraft-navigateur/render.yaml` → **Apply**.
   Sans Blueprint : **New → Web Service**, ce dépôt, *Root Directory* `minecraft-navigateur`,
   *Build* `npm install`, *Start* `npm start`, plan Free.
2. Note l'adresse obtenue, ex. `https://minecraft-web-proxy-xxxx.onrender.com`.
3. Joue avec ton relais :
   `https://mcraft.fun/?ip=donutsmp.net&version=1.21.11&proxy=https://minecraft-web-proxy-xxxx.onrender.com`
   (ou colle l'adresse dans le champ *Proxy* du client, ou sur la page serveur du site).

Offre gratuite Render : le service s'endort après 15 minutes sans trafic, le premier chargement
prend alors 30 à 60 secondes.

Le relais a été lancé et testé ici avec la même commande (`npx minecraft-web-proxy`) : démarrage
OK, point de connexion actif. Ce que je n'ai pas pu tester depuis cet environnement : la partie
réelle sur DonutSMP (le bac à sable n'a pas de sortie TCP vers les serveurs Minecraft).

## Ce qu'il faut savoir avant de jouer (angles morts)

- **Ce n'est pas le client officiel** : le rendu est moins beau, certaines fonctions manquent ou
  sont approximatives (interfaces de conteneurs, sons, quelques blocs), et les FPS sont inférieurs
  à Fabric + Sodium sur PC. Pour jouer sérieusement sur PC, l'installateur Fabric du dossier
  `minecraft-fabric` reste la meilleure option.
- **Règles du serveur** : DonutSMP autorise-t-il un client tiers ? Techniquement c'est un client
  vanilla (aucune triche) mais lis leurs règles ; un anticheat peut réagir au proxy.
- **Adresse IP** : le serveur voit l'IP du relais, pas la tienne.
- **Versions 26.x** : le client s'arrête à 1.21.11 pour l'instant ; DonutSMP accepte 1.21.11.

## Héberger aussi le client (optionnel)

Si tu veux ta propre copie du client (et non mcraft.fun) : le dépôt
<https://github.com/zardoy/minecraft-web-client> fournit un `Dockerfile` (client + relais dans un
seul service). Sur Render : **New → Web Service → Docker**, dépôt `zardoy/minecraft-web-client`,
branche `next`. La compilation est lourde (plusieurs minutes) ; c'est pour ça que le chemin
recommandé est mcraft.fun + ton relais.
