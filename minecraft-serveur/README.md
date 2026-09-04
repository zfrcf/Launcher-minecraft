# Serveur Minecraft officiel 1.21.11 (PC + mobile, compte Microsoft)

Le vrai Minecraft ne peut pas tourner dans une page web : le client est un logiciel propriétaire
de Mojang, et les « Minecraft dans le navigateur » sont des copies illégales du code du jeu.
Ce qui est légal et fonctionne : **héberger un serveur officiel** (le jar serveur est distribué
gratuitement par Mojang) et t'y connecter avec **ton compte Microsoft** depuis :

- **PC** : le launcher officiel Minecraft Java Edition (version 1.21.11).
- **Mobile / tablette / console** : l'application Minecraft (Bedrock), grâce au plugin Geyser
  installé sur le serveur. Floodgate permet aux joueurs Bedrock d'entrer sans compte Java.

Aucun compte n'est stocké par ce dossier : l'authentification est faite par Microsoft
(`ONLINE_MODE=true`) et l'accès est limité à la liste blanche (`WHITELIST`).

## Démarrage rapide (Docker)

```bash
cd minecraft-serveur
cp .env.example .env        # puis mettre ton pseudo Java dans WHITELIST et OPS
docker compose up -d
docker compose logs -f      # attendre « Done (…s)! For help, type "help" »
```

- PC : Multijoueur → Ajouter un serveur → adresse `IP-DU-SERVEUR:25565`.
- Mobile : Jouer → Serveurs → Ajouter un serveur → adresse `IP-DU-SERVEUR`, port `19132`.
  Ton pseudo apparaîtra côté serveur préfixé d'un point (ex. `.Antoine`) : ajoute-le aussi à la
  liste blanche avec `whitelist add .Antoine` dans la console (`docker attach minecraft-1-21-11`,
  détacher avec Ctrl+P puis Ctrl+Q).

Sur ton propre PC il faut ouvrir les ports 25565/TCP et 19132/UDP sur la box (redirection de
ports) ou passer par un tunnel gratuit comme playit.gg. Sur un VPS (Hetzner, OVH, Scaleway…),
ouvrir les mêmes ports dans le pare-feu.

## Sans Docker

Aternos (gratuit) ou un hébergeur Minecraft : choisir **Paper 1.21.11**, activer la liste blanche,
installer les plugins **Geyser-Spigot** et **floodgate**, puis suivre les mêmes étapes de connexion.

## Réduire le lag côté serveur

Déjà réglé dans `docker-compose.yml` : Paper (bien plus optimisé que le serveur vanilla), drapeaux JVM
Aikar, 4 Go de RAM, distance de vue 8 et distance de simulation 6. Si ça rame encore :
- baisser `VIEW_DISTANCE` à 6 et `SIMULATION_DISTANCE` à 4 ;
- garder le serveur sur une machine avec un bon monocœur (Minecraft utilise surtout un seul cœur) ;
- éviter les fermes géantes à entités ;
- vérifier le ping : un serveur en France pour des joueurs à Bordeaux.

## Réduire le lag / augmenter les FPS côté client (jeu officiel)

- Installer **Sodium** (Fabric) ou **Embeddium** : gain de FPS énorme sur tout PC.
- Ajouter **Lithium** (optimisation logique) et **Iris** seulement si tu veux des shaders.
- Options vidéo : distance de rendu 8-12, graphismes « Rapide », désactiver V-Sync, nuages « Rapide »,
  particules « Réduites », limiter les FPS à la fréquence de l'écran.
- Allouer 4 Go de RAM au jeu dans le launcher (Installations → Modifier → Plus d'options,
  `-Xmx4G`), pas plus de la moitié de la RAM du PC.
- Sur mobile : distance de rendu 6-8, « Belles feuilles » désactivé, particules réduites.

## Page web de statut

La page `minecraft-web/public/serveur.html` (déployée sur <https://cubecraft-web.vercel.app/serveur>)
affiche l'état du serveur (en ligne, version, joueurs) et rappelle comment se connecter depuis PC et
mobile. Entrer l'adresse du serveur une fois, elle est mémorisée dans le navigateur.
