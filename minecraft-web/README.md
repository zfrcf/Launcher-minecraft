# CubeCraft Web

Jeu de blocs façon Minecraft, jouable dans un navigateur sur PC et mobile, avec multijoueur.
**Aucun compte n'est stocké** : l'accès se fait par mot de passe de partie ou par connexion Microsoft
(jeton vérifié à la volée, jamais enregistré).

> Ce n'est pas le Minecraft de Mojang (logiciel propriétaire) : c'est un clone complet et autonome,
> écrit en JavaScript (Three.js), sans aucun fichier du jeu original.

## Contenu

- Monde infini généré procéduralement (collines, montagnes, déserts, neige, plages, grottes, minerais, arbres, cactus, eau)
- 27 blocs, casser / poser, sable et gravier qui tombent
- Mode **Survie** (inventaire, drops, 12 recettes de craft) et mode **Créatif** (tous les blocs, vol)
- Cycle jour / nuit (20 min), nage, sprint, accroupi
- Multijoueur : joueurs visibles, chat, blocs synchronisés, monde persistant
- Commandes clavier/souris (AZERTY et QWERTY) et **tactiles** (joystick, regard au doigt, boutons)
- **Plein écran partout** (accueil, menus, jeu) sur PC et mobile, dès le premier geste ; en plein
  écran la touche Échap ouvre le menu du jeu au lieu de sortir (appui long pour sortir vraiment),
  et l'écran se verrouille en paysage sur mobile. `?fullscreen=0` désactive.
- **Qualité automatique à deux niveaux** : la résolution de rendu s'ajuste aux FPS, puis, une fois
  au plancher, la distance de rendu descend d'un cran (jusqu'à 2) et remonte quand ça respire.
- Sauvegarde du monde : navigateur (solo / hébergement) ou fichier `world.json` (serveur dédié)

## 4 façons de jouer

| Mode | Où ça tourne | Multijoueur | Ce qu'il faut |
|---|---|---|---|
| Solo | navigateur seul | non | rien (marche sur Vercel) |
| Héberger | navigateur de l'hôte (WebRTC) | oui, via un code à 6 lettres | rien (marche sur Vercel), l'hôte doit rester en jeu |
| Rejoindre | navigateur | oui | le code (+ mot de passe éventuel) de l'hôte |
| Serveur dédié | `server.js` (Node) | oui, 24h/24 | un hébergeur Node (Render, Railway, Fly, VPS…) |

Sur **Vercel** (site statique + fonction `api/config`), les modes Solo / Héberger / Rejoindre marchent
directement. Vercel ne sait pas faire tourner un serveur WebSocket permanent : pour le mode « Serveur
dédié », déployer `server.js` ailleurs (fichiers `render.yaml` et `Dockerfile` fournis) et indiquer son
adresse `wss://…/ws` dans le jeu ou dans la variable `WS_URL` de Vercel.

## Version en ligne (Vercel)

Le jeu est déployé sur **<https://cubecraft-web.vercel.app>** (projet Vercel `cubecraft-web`).
Le dépôt GitHub n'étant pas relié à Vercel, le déploiement a été fait par envoi direct des fichiers :
la page principale (`index.html`, CSS, fonction `api/config`) est sur le projet `cubecraft-web`, et les
scripts du jeu sont servis par cinq petits projets d'assets `cubecraft-web-js1` … `cubecraft-web-js5`
(voir le chargeur en bas de `public/index.html` version Vercel). Les bibliothèques (three.js, PeerJS, MSAL)
viennent des CDN.

Pour un déploiement plus simple à l'avenir : installer l'application GitHub de Vercel sur le dépôt
(<https://vercel.com/new>), importer le dépôt avec **Root Directory = `minecraft-web`**, et chaque
`git push` redéploiera automatiquement.

## Lancer en local

```bash
cd minecraft-web
npm install
npm start          # http://localhost:3000
npm test           # tests du moteur (génération, maillage, gravité)
```

Au démarrage, le serveur affiche le mot de passe de la partie (`GAME_KEY`). Choisir le mode
« Serveur dédié » dans le jeu et saisir ce mot de passe.

## Variables d'environnement

| Variable | Où | Rôle |
|---|---|---|
| `GAME_KEY` | serveur | mot de passe de la partie (généré aléatoirement si absent) |
| `MS_CLIENT_ID` | Vercel + serveur | identifiant de l'application Microsoft (active le bouton « Se connecter avec Microsoft ») |
| `MS_TENANT` | Vercel + serveur | `consumers` (comptes Microsoft personnels, défaut) ou `common` |
| `ALLOWED_EMAILS` | Vercel + serveur | e-mails Microsoft autorisés, séparés par des virgules |
| `REQUIRE_LOGIN` | Vercel + serveur | `1` = connexion Microsoft obligatoire pour jouer |
| `WS_URL` | Vercel | adresse du serveur dédié proposée par défaut (`wss://…/ws`) |
| `SEED` | serveur | graine du monde (sinon aléatoire, puis conservée dans `world.json`) |
| `WORLD_FILE` | serveur | chemin du fichier de sauvegarde (défaut `./world.json`) |
| `MAX_PLAYERS` | serveur | nombre maximal de joueurs (défaut 16) |
| `PORT` | serveur | port HTTP (défaut 3000) |

## Connexion avec un compte Microsoft (réservé à toi)

1. Aller sur <https://entra.microsoft.com> → *Applications* → *Inscriptions d'applications* → *Nouvelle inscription*.
2. Nom libre ; types de comptes : **« Comptes Microsoft personnels uniquement »** ; plateforme **Application monopage (SPA)**, URI de redirection = l'adresse du site (ex. `https://ton-projet.vercel.app/`).
3. Copier l'**ID d'application (client)**.
4. Sur Vercel (et sur le serveur dédié si utilisé), définir `MS_CLIENT_ID`, `ALLOWED_EMAILS=ton.email@outlook.fr` et `REQUIRE_LOGIN=1`, puis redéployer.

Le jeton Microsoft reste dans le `sessionStorage` du navigateur le temps de l'onglet ; le serveur dédié
vérifie sa signature auprès de Microsoft à chaque connexion et n'enregistre rien.

Sans `MS_CLIENT_ID`, le jeu fonctionne avec le mot de passe de partie.

## Commandes

**PC** : ZQSD / WASD · souris · clic gauche casser · clic droit poser · clic molette copier le bloc visé (créatif) ·
Espace sauter (double = voler en créatif) · Maj accroupi / descendre · Ctrl courir · molette ou 1-9 · E inventaire &
craft · T chat · F3 infos · Échap menu.

**Mobile** : joystick à gauche · glisser à droite pour regarder · appui court = poser · appui long = casser ·
boutons ⬆ sauter, ⬇ accroupi, 🪽 voler (créatif), ⛏ casser, 🧱 poser, 🎒 inventaire, 💬 chat, ☰ menu.

**Chat** : `/creatif` `/survie` `/tp x y z` `/spawn` `/give id quantité` `/jour` `/nuit` `/aide`.

## Structure

```
minecraft-web/
├── server.js            serveur Node (Express + WebSocket, vérification Microsoft, sauvegarde world.json)
├── api/config.js        fonction serverless Vercel (configuration publique)
├── public/
│   ├── index.html       page du jeu (interface en français)
│   ├── css/style.css
│   ├── lib/             three.js, peerjs, msal-browser (copies locales)
│   └── js/
│       ├── noise.js     bruit simplex avec graine
│       ├── blocks.js    blocs, liste créatif, recettes
│       ├── textures.js  atlas de textures généré au chargement
│       ├── world.js     chunks, génération, modifications, gravité
│       ├── mesher.js    maillage (faces cachées, occlusion ambiante)
│       ├── player.js    physique, collisions, lancer de rayon
│       ├── host.js      logique d'hôte partagée (serveur et navigateur)
│       ├── net.js       transports : solo, hôte WebRTC, invité WebRTC, WebSocket
│       ├── auth.js      connexion Microsoft (MSAL)
│       ├── touch.js     commandes tactiles
│       ├── ui.js        interface
│       └── main.js      boucle de jeu
└── test/run.js          tests Node du moteur
```
