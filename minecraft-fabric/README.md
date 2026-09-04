# Fabric + mods de performance pour Minecraft Java 1.21.11

Tu as acheté le jeu : ce dossier installe **Fabric** (le loader de mods le plus léger) et les
mods de performance de référence dans ton launcher officiel, en un clic. Tu joues ensuite
avec ton compte Microsoft normal, sur **donutsmp.net** ou n'importe quel serveur.

Aucun mod de triche : uniquement de l'optimisation (autorisée sur DonutSMP).

## Installation

**Windows** : clic droit sur `installer.ps1` → *Exécuter avec PowerShell*.
Si Windows bloque : ouvrir PowerShell dans le dossier et lancer
```powershell
powershell -ExecutionPolicy Bypass -File .\installer.ps1
```

**macOS / Linux** :
```bash
bash installer.sh            # ou : bash installer.sh --shaders
```

### Options

| Option (Linux/macOS) | Option (Windows) | Effet |
|---|---|---|
| `--shaders` | `-Shaders` | ajoute Iris (shaders compatibles Sodium) |
| `--version 1.21.11` | `-Version 1.21.11` | installe une autre version |
| `--version latest` | `-Version latest` | dernière version suivie par Sodium (aujourd'hui 26.2) |
| `--ram 8` | `-Ram 8` | mémoire allouée au jeu, en Go (4 par défaut) |
| `--dir DOSSIER` | `-MinecraftDir DOSSIER` | autre dossier `.minecraft` |
| `--no-profile` | `-NoProfile` | n'ajoute pas de profil au launcher |

Chaque mod téléchargé est vérifié par sa **somme SHA-1** publiée par Modrinth : un fichier tronqué
ou corrompu est rejeté plutôt que d'être installé (et de faire planter le jeu au lancement). Le
script se termine par un récapitulatif ; si Fabric API ou Sodium manque, il le dit clairement et
s'arrête avec un code d'erreur, car sans eux il n'y a aucun gain de FPS.

Le script :
1. trouve Java (celui du launcher, sinon télécharge un JRE 21) ;
2. installe Fabric Loader pour 1.21.11 et crée le profil dans le launcher ;
3. télécharge la dernière version compatible de chaque mod depuis Modrinth dans `.minecraft/mods` ;
4. règle le profil sur 4 Go de RAM avec des options JVM anti-saccades.

Ferme le launcher avant de lancer le script, puis rouvre-le : choisis le profil
**« Fabric 1.21.11 (Sodium, FPS+) »** et clique sur *Jouer*.

## Mods installés

| Mod | Rôle |
|---|---|
| Fabric API | base obligatoire pour les autres mods |
| Sodium | moteur de rendu : le plus gros gain de FPS |
| Lithium | optimisation de la logique du jeu (ticks, IA, physique) |
| FerriteCore | réduit la mémoire utilisée |
| ImmediatelyFast | accélère le rendu de l'interface et des entités |
| Entity Culling | ne dessine pas les entités cachées |
| Krypton | optimise le réseau (moins de lag sur les serveurs) |
| Dynamic FPS | baisse les FPS quand le jeu est en arrière-plan |
| Sodium Extra + Reese's Sodium Options | réglages avancés de Sodium dans le menu |
| Mod Menu | liste et configuration des mods |
| Iris (option `--shaders` / `-Shaders`) | shaders compatibles Sodium |

## Réglages conseillés en jeu

Options → Graphismes : distance de rendu 8-12, distance de simulation 6-8, graphismes « Rapide »,
nuages « Rapide », particules « Réduites », V-Sync désactivé, limite de FPS = fréquence de l'écran.
Sur un PC modeste : distance de rendu 6, ombres des entités désactivées (Sodium Extra).

## Se connecter à DonutSMP

Multijoueur → Ajouter un serveur → adresse `donutsmp.net`. Depuis l'application mobile
(Bedrock), même compte Microsoft, DonutSMP accepte aussi les joueurs Bedrock (port 19132).

Si le serveur refuse la version : relancer le script avec `--version <version demandée>`
(`-Version` sous Windows). Les mods des autres versions sont remplacés automatiquement.

## Dépannage

- « Java introuvable » : le script télécharge un JRE, il faut juste une connexion.
- Le profil n'apparaît pas : le launcher était ouvert pendant l'installation, ferme-le et relance le script.
- Crash au lancement : supprime les mods d'une autre version dans `.minecraft/mods`, ou relance le script.
- Le script macOS/Linux a été testé de bout en bout (Fabric 0.19.5 installé, 11 mods téléchargés
  et vérifiés, version inexistante correctement refusée, `--version latest` résout 26.2).
- Le script Windows reçoit les mêmes fonctions mais n'a pas pu être exécuté ici : PowerShell n'est
  pas disponible dans l'environnement de développement. À vérifier au premier lancement.
