# Fitness Park Akinvest — planning et Minecraft

Ce dépôt réunit cinq projets indépendants : un outil de planning d'équipes, et quatre façons de
jouer à Minecraft (client officiel avec mods, client dans le navigateur, relais réseau, jeu maison).

| Dossier | Ce que c'est | Où ça tourne |
|---|---|---|
| `index.html` (racine) | **Fitness Park Manager** : planning des équipes, feuille d'émargement, coûts | fichier à ouvrir dans un navigateur |
| `minecraft-fabric/` | Installateur **Fabric + mods de performance** (Sodium, Lithium, Entity Culling…) | PC (Windows, macOS, Linux) |
| `minecraft-navigateur/` | Le **vrai Minecraft Java dans le navigateur**, prêt pour DonutSMP | [minecraft-donutsmp.vercel.app](https://minecraft-donutsmp.vercel.app) |
| `minecraft-web/` | **CubeCraft Web**, jeu de blocs maison, multijoueur | [cubecraft-web.vercel.app](https://cubecraft-web.vercel.app) |
| `minecraft-serveur/` | Serveur Minecraft Java auto-hébergé (Docker) | machine perso ou VPS |

---

## 1. Fitness Park Manager (`index.html`)

Outil de planning à ouvrir directement dans un navigateur, sans installation ni serveur. Vue
semaine ou jour, plusieurs clubs (Bègles, Mérignac, Bordeaux Lac, Libourne), suivi des heures
payées et du coût estimé, feuille d'émargement imprimable.

Les données (employés, plannings) sont enregistrées **dans le navigateur** de la machine utilisée.
Elles ne partent nulle part, mais ne se synchronisent pas non plus entre deux appareils : vider les
données du navigateur les efface.

La mise en forme vient normalement d'un CDN. Si celui-ci est injoignable (wifi de salle capricieux,
réseau qui filtre), une **feuille de repli intégrée** prend le relais automatiquement : la page reste
lisible et utilisable, sans connexion. Pour la regénérer après une refonte visuelle :
`node .session-nuit/regenerer-styles-repli.js`, puis remplacer le contenu de la balise
`<style id="repliTailwind">` dans `index.html`.

## 2. Minecraft sur PC avec les mods de performance (`minecraft-fabric/`)

C'est la meilleure expérience si tu as acheté le jeu : Fabric plus les mods de référence
(Sodium, Lithium, FerriteCore, ImmediatelyFast, Entity Culling, Krypton, Dynamic FPS). Un script
fait tout, y compris créer le profil dans le launcher officiel.

```bash
bash minecraft-fabric/installer.sh              # macOS / Linux
```
```powershell
powershell -ExecutionPolicy Bypass -File minecraft-fabric\installer.ps1   # Windows
```

Chaque mod est vérifié par sa somme de contrôle. Voir `minecraft-fabric/README.md` pour les options
(`--version latest`, `--ram 8`, `--shaders`).

## 3. Minecraft Java dans le navigateur (`minecraft-navigateur/`)

Un client open source (MIT) qui parle le protocole officiel : tu te connectes avec **ton compte
Microsoft** à DonutSMP, sans rien installer, sur PC comme sur téléphone.

- Site : **<https://minecraft-donutsmp.vercel.app>**
- Un **mod d'optimisation maison** (`site/mod.js`) est injecté dans la page : réglages de
  performance adaptés à l'appareil, plein écran partout, distance de rendu qui s'ajuste aux FPS.
- Page **`/diagnostic`** : teste le relais, le serveur, la carte graphique et l'état du mod, et
  donne la solution pour chaque point en défaut.
- `?safe=1` retire les réglages du mod, `?hud=1` affiche un compteur FPS.

Les mods Java (Sodium et compagnie) **ne peuvent pas** fonctionner ici : un navigateur n'exécute
pas de mods Minecraft. Pour des FPS élevés sur PC, utiliser le dossier `minecraft-fabric/`.

## 4. CubeCraft Web (`minecraft-web/`)

Un jeu de blocs écrit de zéro en JavaScript : monde infini, survie et créatif, craft, multijoueur
par code de partie ou serveur dédié, commandes tactiles. Ce n'est pas le jeu de Mojang.

- Site : **<https://cubecraft-web.vercel.app>**
- En local : `cd minecraft-web && npm install && npm start` puis <http://localhost:3000>
- Tests du moteur : `npm test`

## 5. Serveur Minecraft auto-hébergé (`minecraft-serveur/`)

`docker-compose.yml` prêt à lancer pour héberger ton propre serveur Minecraft Java, avec
`.env.example` à recopier en `.env`.

---

## Déploiement

Les deux sites sont hébergés sur Vercel. Leur script de build récupère les fichiers depuis ce
dépôt au moment du build : le site en ligne correspond donc exactement à ce qui est commité, et
un déploiement n'envoie que quelques petits fichiers de configuration.

Pour redéployer automatiquement à chaque `git push`, relier le dépôt à Vercel
(<https://vercel.com/new>) avec **Root Directory** = `minecraft-navigateur/site` ou `minecraft-web`.
