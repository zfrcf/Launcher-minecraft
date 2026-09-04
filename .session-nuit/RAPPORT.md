# Rapport de session — nuit du 4 au 5 septembre 2026

## Résumé en 5 lignes

Les mods Fabric ne pourront jamais tourner dans un navigateur : j'ai donc poussé le client web au
maximum de ce qu'il permet, et ajouté ce qui manquait pour comprendre et corriger les blocages.
Le site DonutSMP a maintenant une page de diagnostic, des messages d'erreur en français, un choix
de relais et un écran d'explication quand le navigateur bloque le stockage. CubeCraft Web passe en
plein écran partout et ajuste sa distance de rendu aux FPS. Les installateurs Fabric vérifient
chaque téléchargement. Deux vrais bugs corrigés dans l'outil de planning.

## Ce qui est en ligne maintenant

| Site | Adresse | État |
|---|---|---|
| Minecraft navigateur (DonutSMP) | <https://minecraft-donutsmp.vercel.app> | déployé et vérifié |
| Diagnostic | <https://minecraft-donutsmp.vercel.app/diagnostic> | déployé et vérifié |
| CubeCraft Web | <https://cubecraft-web.vercel.app> | déployé et vérifié |

Pour chaque déploiement, j'ai retéléchargé le site et comparé octet à octet avec le dépôt.

## Tâches terminées

**Client Minecraft navigateur** (`minecraft-navigateur/`)
- Page `/diagnostic` : huit tests (relais, serveur DonutSMP, WebGL 2, WebAssembly, appareil, état
  du mod, plein écran, accès Internet), verdict clair et rapport copiable.
- Section « Ton relais » : saisir l'adresse de ton relais Render, mesurer sa latence, l'enregistrer
  comme relais par défaut, ou revenir au relais public.
- Bandeau d'aide en français quand le client échoue (relais en panne, compte Microsoft, version
  refusée, connexion coupée) ou quand le chargement dépasse 45 secondes.
- Écran d'explication quand le navigateur refuse le stockage local : avant, le client s'arrêtait
  sur une page vide sans un mot.
- Mod v6 : réglages à risque retirés, mode `?safe=1` pour isoler une panne, cookies concurrents
  nettoyés.

**CubeCraft Web** (`minecraft-web/`)
- Plein écran partout (accueil, menus, jeu), PC et mobile, avec la touche Échap qui ouvre le menu
  du jeu au lieu de sortir, et verrouillage en paysage sur mobile.
- Qualité automatique à deux niveaux : la résolution s'ajuste aux FPS, puis la distance de rendu
  descend jusqu'à 2 et remonte quand ça respire.
- Déploiement ramené de six projets Vercel à un seul.

**Installateurs Fabric** (`minecraft-fabric/`)
- Chaque mod vérifié par sa somme SHA-1 : un fichier corrompu est rejeté au lieu de faire planter
  le jeu au lancement.
- Options `--version latest` (dernière version suivie par Sodium, aujourd'hui 26.2) et `--ram`.
- Récapitulatif final, arrêt explicite si Fabric API ou Sodium manque, messages d'erreur clairs.

**Outil de planning** (`index.html`) — deux vrais défauts corrigés
- Un shift pouvait être enregistré **sans collaborateur**. Il n'apparaissait dans aucune ligne de
  la grille, mais ses heures et son coût étaient bien additionnés : les totaux affichés devenaient
  faux sans que rien ne le signale. La saisie est maintenant refusée avec un message.
- Le bouton « AJOUTER » d'un employé ne faisait rien, sans explication, quand le nom ou les heures
  de contrat manquaient. Chaque champ manquant est désormais nommé.

**Vérifications rejouables**
- `minecraft-navigateur/site` : `npm test` → 16 contrôles.
- `minecraft-web` : `npm test` → moteur du jeu, plus cohérence des scripts du site et garde-fous
  sur le plein écran et la distance adaptative. J'ai vérifié que retirer un script fait bien
  échouer la suite.

## La vérification qui compte : un vrai serveur Minecraft

J'ai fini par monter un **serveur Minecraft Java 1.21.11 officiel** sur cette machine, avec le
relais WebSocket, et j'ai connecté le client web dessus. Ce n'est plus une simulation : c'est la
chaîne complète, navigateur → mod → client → relais → serveur.

- Entrée en jeu confirmée : pseudo, barre de vie, barre d'action, chargement des chunks.
- **Le mod fonctionne en conditions réelles** : « 14 FPS : distance de rendu → 3 », puis
  « 59 FPS : distance de rendu → 4 ». Il descend quand ça rame et remonte quand ça respire.
- Le chat marche : message envoyé, relayé par le serveur, reçu et affiché.
- Même chose en mode mobile tactile : réglages adaptés, connexion, boutons tactiles, en jeu.

**Mesure avec et sans le mod, sur le même serveur** : 60 images par seconde dans les deux cas (le
plafond de l'écran), mais distance de rendu 3 sans le mod contre 6 avec, soit 49 chunks affichés
contre 169. Autrement dit : à confort égal, le mod te fait voir **3,4 fois plus de terrain**. Sur un
monde de test presque vide, il ne peut pas faire mieux que le plafond. Sur DonutSMP, où la scène est
chargée, c'est l'inverse qui joue : la distance baisse toute seule pour protéger la fluidité.

## Ce que j'ai testé pour de vrai

| Vérification | Résultat |
|---|---|
| Client web connecté à un vrai serveur Minecraft, via le relais | en jeu, mod actif |
| Même chose en mode mobile tactile | en jeu, réglages mobiles appliqués |
| Chat en jeu | message envoyé et reçu |
| Installateur Fabric de bout en bout | Fabric 0.19.5 + 11 mods installés et vérifiés |
| Version inexistante passée à l'installateur | refusée avec un message utile |
| CubeCraft en solo, PC et mobile | jeu lancé, plein écran, aucune erreur |
| CubeCraft multijoueur, serveur dédié | 2 joueurs connectés, chat transmis |
| Persistance du monde après redémarrage du serveur | bloc posé retrouvé |
| Distance de rendu adaptative | 5 → 4 → 3 → 2, sans oscillation |
| Relais WebSocket personnel (mwc-proxy) | démarre et répond correctement |
| Page de planning : employé, shift, rechargement | données conservées, aucune erreur |
| Page de planning sans aucun CDN | lisible, parcours complet fonctionnel |
| Navigateur bloquant le stockage | écran d'explication affiché |
| Diagnostic hors ligne | verdict correct, aucune erreur |

## Ce que je n'ai pas pu vérifier

- **Une partie réelle sur DonutSMP.** Le serveur de test est local : je n'ai pas de route réseau
  vers DonutSMP depuis cette machine. Ce qui dépend de DonutSMP lui-même (file d'attente, anticheat
  face à un relais, charge du serveur aux heures de pointe) reste à confirmer par toi.
- **`installer.ps1`** : PowerShell n'existe pas ici. Il a reçu les mêmes fonctions que la version
  Linux et une relecture attentive, mais il n'a pas été exécuté. À surveiller au premier lancement.
- **Les FPS réels.** La machine n'a pas de carte graphique : les mesures viennent d'un rendu
  logiciel, bien plus lent que ton matériel. Elles servent à comparer, pas à prédire.

## Une revue de code a trouvé un défaut grave dans mon propre travail

En fin de session, j'ai fait relire tout le travail de la nuit par une revue indépendante, avec
pour consigne de chercher les défauts plutôt que de valider. Elle a relevé 29 points. J'ai vérifié
chacun avant de corriger, et l'un d'eux était sérieux.

**Le filet de sécurité de l'outil de planning était lui-même cassé.** En recopiant la mise en forme
de repli, les règles d'impression étaient sorties de leur bloc. Résultat : le jour où le CDN
n'aurait pas répondu, la page serait passée en fond blanc, zoomée à 70 %, avec la feuille de
signatures ouverte en permanence. Pire que l'absence de mise en forme. C'est corrigé, le repli est
régénéré proprement, et le script qui le fabrique ne peut plus commettre la même erreur.

Autres corrections issues de cette relecture :
- **Un PC à écran tactile était pris pour un téléphone** par le mod : distance de rendu divisée par
  deux, interface géante, carte graphique dédiée refusée. Exactement l'inverse du but recherché.
- **La souris n'était plus captée après une reprise de partie** dans CubeCraft, parce que le
  verrouillage du pointeur était demandé pendant la transition vers le plein écran, ce que Chrome
  refuse.
- **Une pause plus longue que le shift** donnait une durée négative, ajoutée aux heures payées et
  au coût. La saisie est refusée.
- **Un nom de collaborateur contenant des chevrons** cassait le planning et le sélecteur de shift.
  Les noms sont maintenant échappés partout où ils s'affichent.
- **Le mode sans risque n'était pas complet** : il gardait la version imposée au serveur, et
  pouvait donc innocenter le mod à tort.
- **Le nettoyage des mods emportait un mod voisin** : réinstaller Sodium supprimait Sodium Extra.
- La chaîne de déploiement n'utilise plus de shell, et un téléchargement incomplet ne peut plus
  passer inaperçu.

Un point signalé comme bloquant s'est révélé **infondé après vérification** : les tests de relais
fonctionnent bien, les deux relais renvoyant les en-têtes nécessaires. Je l'ai mesuré plutôt que de
corriger à l'aveugle.

## Décisions prises à ta place

1. **Déployer en production pendant la nuit.** Tu avais demandé le site sur Vercel et des
   améliorations pour cet après-midi. Je n'ai déployé que des versions passées par les tests, et
   Vercel garde les versions précédentes : un retour arrière se fait en un clic.
2. **Corriger le bug des shifts sans collaborateur** dans l'outil de planning, parce qu'il faussait
   des chiffres affichés. Sans toucher aux données ni aux calculs.
3. **Regrouper CubeCraft sur un seul projet Vercel** au lieu de six, en faisant récupérer les
   fichiers depuis GitHub au moment du build.
4. **Versionner ce compte rendu** dans le dépôt : le conteneur est éphémère, un fichier non commité
   aurait disparu.

Le détail est dans `DECISIONS.md`, et le déroulé complet dans `JOURNAL.md`.

## Ce qui t'attend

**Rien de bloquant.** Le travail est commité et poussé sur la branche
`claude/repo-cleanup-extract-zip-9cei1x`. Aucune pull request n'a été créée.

À décider quand tu auras cinq minutes :
- **Supprimer les projets Vercel devenus inutiles** : `cubecraft-web-js1` à `cubecraft-web-js5`.
  Je ne l'ai pas fait, c'est irréversible et c'est ton compte.
- **Relier le dépôt à Vercel** (<https://vercel.com/new>) pour que chaque `git push` redéploie tout
  seul, au lieu de passer par moi.
- **Ton propre relais sur Render** si tu veux gagner en latence : la marche à suivre est dans
  `minecraft-navigateur/README.md`, et la page `/diagnostic` te permet de le tester puis de
  l'enregistrer.

## Fait aussi, en fin de session

- **L'outil de planning ne dépend plus du réseau pour s'afficher.** Une feuille de style de repli
  est intégrée à la page : inactive tant que le CDN répond, activée automatiquement sinon. Testée
  dans les trois cas (CDN rapide, absent, lent arrivant après coup), sans conflit ni régression.
  Concrètement : la page reste lisible et utilisable même sans connexion en salle.

## Améliorations possibles, non faites

- **Les données du planning restent dans un seul navigateur.** Pas de synchronisation entre ton
  téléphone et ton ordinateur, et vider les données du navigateur les efface. Un export ou une
  vraie synchronisation serait un chantier à part entière.
- **Le mode « héberger une partie » de CubeCraft** (pair à pair) n'a pas été testé : il demande deux
  machines qui se joignent par Internet.
