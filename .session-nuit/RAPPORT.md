# Rapport de session — nuit et matinée du 4 septembre 2026

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

## La panne qui expliquait « DonutSMP ne charge même pas »
C'est le correctif le plus important, et je l'ai trouvé par accident. En reprenant au matin mes
mesures de performance de la nuit, j'ai regardé les captures d'écran : elles montraient l'écran
« You Died! » et un compteur figé sur « Loading world chunks 0 % ». Le monde n'était jamais
affiché. Les 60 images par seconde que j'avais mesurées étaient donc **60 images par seconde de
rien du tout** — un résultat que j'ai retiré de ce rapport. En cherchant pourquoi le monde ne
s'affichait pas, je suis tombé sur ta panne.

Le journal du navigateur donne la cause en une ligne : `Do not have data for 1.21.11`. Ce client
web **sait parler** le protocole 1.21.11, mais il **n'embarque pas les données de blocs** de cette
version. Conséquence : la connexion réussit, le pseudo apparaît, le chat fonctionne — et l'écran
reste vide pour toujours. Or le mod forçait précisément la connexion à DonutSMP en 1.21.11.

Vérification sur le même serveur, la même scène, la même machine. J'ai d'abord cru que les
morceaux de terrain n'arrivaient pas du tout ; en insistant, j'ai vu qu'ils arrivent très bien.
C'est l'affichage qui ne sait pas les construire :

| Version de connexion | Morceaux reçus par le réseau | Morceaux affichés | Écran |
|---|---|---|---|
| 1.21.11 | 213 | 0 sur 169 | vide, indicateur bloqué à 0 % |
| 1.21.8 | 81 | tous | monde affiché |

La distinction compte : le réseau, le relais et le serveur font leur travail. Compter les morceaux
reçus aurait donné un diagnostic faussement rassurant. Le seul signal juste est celui que le joueur
a sous les yeux, l'indicateur « Loading world chunks » du client, qui reste sur « 0 % (0 / 169) ».

Le mod se connecte désormais en **1.21.8**, la version la plus récente dont ce client possède les
données. DonutSMP annonce accepter de 1.7.2 à la dernière version : rien ne s'y oppose. La page de
diagnostic signale maintenant, en rouge, une entrée de serveur configurée sur une version que le
client ne sait pas afficher. Les joueurs déjà venus sont corrigés automatiquement.

**C'est très probablement la cause de « DonutSMP ne charge même pas ».** Je ne peux pas le prouver
depuis cette machine, qui n'a pas de compte Microsoft pour entrer sur DonutSMP : à toi de confirmer
en ouvrant le site.

## Les deux autres messages que le jeu te donne maintenant
DonutSMP exige un compte Microsoft. J'ai reproduit ce refus sur mon serveur de test, et ce que
voyait le joueur était indéfendable : un écran anglais annonçant « WebSocket connection closed with
unknown reason », suivi des octets bruts du dernier paquet reçu. Rien qui aide, et un message qui
oriente vers une panne réseau alors que le problème est le compte.

Le mod affiche maintenant un bandeau en français dans ce cas précis, avec les trois causes
possibles dans l'ordre de fréquence : compte Microsoft non connecté, serveur qui refuse les
connexions relayées, serveur saturé. Il sait faire la différence entre « refusé à l'entrée » et
« coupé en cours de partie », qui produisent le même message technique mais appellent des gestes
opposés. Vérifié dans les deux sens : le bandeau apparaît sur le refus, et n'apparaît pas sur une
partie normale.


Le plus pénible dans cette panne n'était pas la panne, c'était le silence. J'ai donc ajouté un
chien de garde : si tu es en jeu depuis plus de quarante secondes et qu'aucun morceau de terrain
n'est affiché, un bandeau en français apparaît, nomme la cause probable et te donne le geste à
faire. Vérifié sur deux serveurs réels, dans les deux sens : il apparaît sur la panne, il
n'apparaît pas sur une partie normale.

Au passage, une erreur de ma part que je préfère écrire noir sur blanc : j'avais d'abord conclu que
les morceaux de terrain n'arrivaient pas. Faux. Ils arrivent tous, c'est l'affichage qui ne sait
pas les construire. Ma première version du chien de garde comptait donc la mauvaise chose et
n'aurait jamais rien signalé. Corrigée, et un contrôle automatique interdit désormais d'y revenir.

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
- Mod v8 : connexion en 1.21.8 (le correctif le plus important, décrit en tête de ce rapport),
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

**Outil de planning, en fin de session**

- **L'outil de planning ne dépend plus du réseau pour s'afficher.** Une feuille de style de repli
  est intégrée à la page : inactive tant que le CDN répond, activée automatiquement sinon. Testée
  dans les trois cas (CDN rapide, absent, lent arrivant après coup), sans conflit ni régression.
  Concrètement : la page reste lisible et utilisable même sans connexion en salle.

## La vérification qui compte : un vrai serveur Minecraft
J'ai fini par monter un **serveur Minecraft Java 1.21.11 officiel** sur cette machine, avec le
relais WebSocket, et j'ai connecté le client web dessus. Ce n'est plus une simulation : c'est la
chaîne complète, navigateur → mod → client → relais → serveur.

- Entrée en jeu confirmée : pseudo, barre de vie, barre d'action. **Attention** : ces premiers
  essais étaient en 1.21.11, où le monde ne s'affiche jamais. Tout a été refait en 1.21.8, avec le
  monde réellement affiché.
- **Le mod fonctionne en conditions réelles** : « 14 FPS : distance de rendu → 3 », puis
  « 59 FPS : distance de rendu → 4 ». Il descend quand ça rame et remonte quand ça respire.
- Le chat marche : message envoyé, relayé par le serveur, reçu et affiché.
- Même chose en mode mobile tactile : réglages adaptés, connexion, boutons tactiles, en jeu.

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
| Connexion en 1.21.11 sur un vrai serveur | 0 morceau affiché sur 169 — cause trouvée |
| Connexion en 1.21.8 sur le même serveur | monde affiché, joueur vivant |
| Bandeau « le monde ne s’affiche pas » | apparaît en 1.21.11, absent en 1.21.8 |
| Bandeau « le serveur a refusé la connexion » | apparaît sur compte refusé, absent sinon |
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
- **Que la version était bien la seule cause de ton blocage.** Je l'ai reproduit et corrigé sur un
  serveur local, ce qui est solide. Mais DonutSMP peut avoir sa propre cause en plus. La page de
  diagnostic est faite pour trancher en trente secondes.

## Une revue de code a trouvé un défaut grave dans mon propre travail
En fin de session, j'ai fait relire tout le travail de la nuit par une revue indépendante, avec
pour consigne de chercher les défauts plutôt que de valider. Elle a relevé 29 points. J'ai vérifié
chacun avant de corriger, et l'un d'eux était sérieux. Le lendemain matin, en me méfiant de mes
propres chiffres, j'ai trouvé le défaut le plus grave de tous : ma mesure de performance ne
mesurait rien, et ce qu'elle cachait était la panne que tu m'avais signalée.

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
5. **Descendre la version de connexion de 1.21.11 à 1.21.8** sans te demander ton avis. C'est le
   correctif le plus important de la nuit, et il est réversible : une constante dans `mod.js`.

Le détail est dans `DECISIONS.md`, et le déroulé complet dans `JOURNAL.md`.

## Ce qui t'attend
**Rien de bloquant.** Le travail est commité et poussé sur la branche
`claude/repo-cleanup-extract-zip-9cei1x`. Aucune pull request n'a été créée.

**Si l'écran reste noir, une question à trancher en trente secondes :** sur la page de
diagnostic, le bouton « Essayer une partie solo » ouvre un monde local, sans réseau, sans relais et
sans compte. S'il s'affiche et que DonutSMP reste noir, ton appareil est hors de cause et le
problème est côté serveur, relais ou compte. S'il ne s'affiche pas non plus, c'est ton appareil ou
ton navigateur.

**La seule chose que je te demande de faire :** ouvre
<https://minecraft-donutsmp.vercel.app> et essaie d'entrer sur DonutSMP. Si le monde s'affiche,
c'était bien la version qui bloquait. Si l'écran reste vide, va sur
<https://minecraft-donutsmp.vercel.app/diagnostic> et envoie-moi le rapport : je n'ai pas de compte
Microsoft ni de route réseau vers DonutSMP depuis cette machine, donc c'est le seul point que je ne
peux pas vérifier moi-même.

À décider quand tu auras cinq minutes :
- **Supprimer les projets Vercel devenus inutiles** : `cubecraft-web-js1` à `cubecraft-web-js5`.
  Je ne l'ai pas fait, c'est irréversible et c'est ton compte.
- **Relier le dépôt à Vercel** (<https://vercel.com/new>) pour que chaque `git push` redéploie tout
  seul, au lieu de passer par moi.
- **Ton propre relais sur Render** si tu veux gagner en latence : la marche à suivre est dans
  `minecraft-navigateur/README.md`, et la page `/diagnostic` te permet de le tester puis de
  l'enregistrer.

## Améliorations possibles, non faites
- **Les données du planning restent dans un seul navigateur.** Pas de synchronisation entre ton
  téléphone et ton ordinateur, et vider les données du navigateur les efface. Un export ou une
  vraie synchronisation serait un chantier à part entière.
- **Le mode « héberger une partie » de CubeCraft** (pair à pair) n'a pas été testé : il demande deux
  machines qui se joignent par Internet.
