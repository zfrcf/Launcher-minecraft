# Rapport de session — nuit du 4 au 5 septembre 2026

## Résumé en 5 lignes

**J'ai trouvé pourquoi DonutSMP ne chargeait pas** : le mod imposait la version 1.21.11, que ce
client sait négocier mais pas afficher. Il se connectait, puis restait sur un écran vide. Il se
connecte maintenant en 1.21.8, vérifié sur un vrai serveur. Pour le reste : les mods Fabric ne
tourneront jamais dans un navigateur, j'ai donc poussé le client web au maximum de ce qu'il permet.
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
- Mod v8 : connexion en 1.21.8 (voir plus bas, c'est le correctif le plus important de la nuit),
  réglages à risque retirés, mode `?safe=1` pour isoler une panne, cookies concurrents nettoyés.

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

- Entrée en jeu confirmée : pseudo, barre de vie, barre d'action. **Attention** : ces premiers
  essais étaient en 1.21.11, où le monde ne s'affiche jamais (voir la section suivante). Tout a été
  refait en 1.21.8, avec le monde réellement affiché.
- **Le mod fonctionne en conditions réelles** : « 14 FPS : distance de rendu → 3 », puis
  « 59 FPS : distance de rendu → 4 ». Il descend quand ça rame et remonte quand ça respire.
- Le chat marche : message envoyé, relayé par le serveur, reçu et affiché.
- Même chose en mode mobile tactile : réglages adaptés, connexion, boutons tactiles, en jeu.

## La panne qui expliquait « DonutSMP ne charge même pas »

En reprenant ces mesures au matin, je me suis aperçu qu'elles ne valaient rien : les captures
d'écran montraient l'écran « You Died! » et le compteur « Loading world chunks 0 % ». Le monde
n'était jamais affiché. Les 60 images par seconde annoncées plus haut étaient donc **60 images par
seconde de rien du tout**. J'ai cherché pourquoi, et c'est là que se trouvait le vrai problème.

Le journal du navigateur donne la cause en une ligne : `Do not have data for 1.21.11`. Ce client
web **sait parler** le protocole 1.21.11, mais il **n'embarque pas les données de blocs** de cette
version. Conséquence : la connexion réussit, le pseudo apparaît, le chat fonctionne — et l'écran
reste vide pour toujours. Or le mod forçait précisément la connexion à DonutSMP en 1.21.11.

Vérification sur le même serveur, la même scène, la même machine :

| Version de connexion | Colonnes de chunks reçues | Monde affiché |
|---|---|---|
| 1.21.11 | 0 | non, écran bloqué |
| 1.21.8 | 81 | oui |

Le mod se connecte désormais en **1.21.8**, la version la plus récente dont ce client possède les
données. DonutSMP annonce accepter de 1.7.2 à la dernière version : rien ne s'y oppose. La page de
diagnostic signale maintenant, en rouge, une entrée de serveur configurée sur une version que le
client ne sait pas afficher. Les joueurs déjà venus sont corrigés automatiquement.

**C'est très probablement la cause de « DonutSMP ne charge même pas ».** Je ne peux pas le prouver
depuis cette machine, qui n'a pas de compte Microsoft pour entrer sur DonutSMP : à toi de confirmer
en ouvrant le site.

## Ce que le mod apporte vraiment

Une fois le monde réellement affiché, j'ai refait la mesure proprement : serveur local 1.21.8,
72 000 blocs posés, 162 entités, chunks maintenus chargés, joueur vivant, trois répétitions.

| | Sans le mod | Avec le mod |
|---|---|---|
| Images par seconde, réglages libres | 4 | 8 à 9 |
| Distance de rendu choisie | 3 | 2 |
| Images par seconde, distance imposée à 5 des deux côtés | 3 | 6 à 7 |

Deux lectures. À réglages libres, le mod **double** le nombre d'images par seconde, en partie parce
qu'il baisse lui-même la distance de rendu quand ça rame. À distance de rendu identique, il la
double encore : le gain ne vient donc pas seulement de la distance, mais aussi des autres réglages
(pas de skins téléchargés, éclairage simplifié, particules réduites).

**Ce que cette mesure ne dit pas.** Cette machine n'a pas de carte graphique : le rendu passe par
un émulateur logiciel. Les 4 et 9 images par seconde n'ont donc aucun sens en valeur absolue — sur
ton PC ou ton téléphone, ce sera bien plus. Le rapport entre les deux colonnes est ce qui compte,
et lui-même peut différer sur du vrai matériel, où c'est la carte graphique qui limite et non le
processeur. À prendre comme un ordre de grandeur, pas comme une promesse chiffrée.

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
| Connexion en 1.21.11 sur un vrai serveur | monde jamais affiché (0 chunk) — cause trouvée |
| Connexion en 1.21.8 sur le même serveur | monde affiché, 81 chunks, joueur vivant |
| Mesure images par seconde avec et sans le mod, scène chargée | 4 contre 8-9, trois répétitions |
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
