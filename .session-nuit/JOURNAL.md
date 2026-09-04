# Journal de session — 4/5 septembre 2026 (heures UTC)

| Heure | Tâche | Résultat |
|---|---|---|
| 03:26 | Démarrage du mode autonome. Inventaire du dépôt (5 parties : planning racine, fabric, navigateur, serveur, web). | OK |
| 03:30 | Plan écrit (`PLAN.md`). Le mod v6 est déjà déployé et vérifié identique au fichier local. | OK |
| 03:50 | 1.1 Page /diagnostic (8 tests, verdict, rapport copiable). 1.2/1.3 Bandeau d'aide en français sur erreur du client et chargement > 45 s (hook de setLoadingScreenStatus). Tests Chromium OK (bandeau, diagnostic, 0 erreur). | OK |
| 04:20 | 2.1 Test de fumée CubeCraft Web (serveur local + Chromium PC et mobile) : jeu lancé en solo, HUD affiché, 0 erreur JS, 28 FPS PC (rendu logiciel) / 55 FPS mobile. Rien à corriger côté chargement. | OK |
| 04:35 | 1.5 Déploiement v6+diagnostic : un octet corrompu dans un commentaire et /diagnostic en 404 (cleanUrls désactivé). Correctif : réécriture /diagnostic dans vercel.json ; build.js récupère mod.js et diagnostic.html depuis GitHub quand ils sont absents, ce qui réduit le déploiement manuel à 4 petits fichiers et garantit l'identité avec le dépôt. | EN COURS |
| 04:50 | 1.5 corrigé et redéployé : /diagnostic répond 200, mod et page de diagnostic en ligne identiques aux fichiers du dépôt (vérifié octet à octet). | OK |
| 05:00 | 3.1 installer.sh testé de bout en bout dans un dossier temporaire : Fabric 0.19.5 installé, 11 mods téléchargés (Sodium, Lithium, Entity Culling, Krypton...), code de sortie 0. | OK |
| 05:20 | 2.2 Plein écran CubeCraft Web (public/js/fullscreen.js) : PC et mobile, verrou d'Échap, paysage. A/B mesuré : aucune régression de FPS. 2.3 Distance de rendu adaptative : testée 5->4->3->2, converge sans oscillation, 0 erreur. | OK |
| 05:40 | 2.4 CubeCraft Web déployé sur un seul projet Vercel (build.js récupère public/ depuis GitHub). Site en ligne re-téléchargé et rejoué dans Chromium : jeu lancé, plein écran actif, 0 erreur, PC et mobile. Les 5 projets d'assets cubecraft-web-js1..5 deviennent inutiles. | OK |
| 05:55 | 3.2/3.3 Installateurs Fabric renforcés (bash + PowerShell) : vérification SHA-1 de chaque mod, option --version latest, --ram, récapitulatif, arrêt explicite si Fabric API ou Sodium manque, messages d'erreur sans doublon. Bash testé : 11 mods OK, version inexistante refusée proprement, latest -> 26.2. PowerShell relu (équilibrage vérifié) mais non exécutable ici. | OK |
| 06:05 | 4.2 Page de planning testée dans Chromium (création employé, créneau, rechargement) : aucune erreur JS, données persistantes. Deux défauts corrigés : un créneau pouvait être enregistré sans collaborateur (invisible dans la grille mais compté dans les heures payées et le coût), et le bouton AJOUTER d'un employé ne disait rien quand un champ obligatoire manquait. Parcours normal revérifié après correction. | OK |
| 06:12 | 4.1 README racine écrit : présentation des 5 parties du dépôt, liens vers les deux sites en ligne, limites annoncées (données locales du planning, mods Java impossibles dans le navigateur). | OK |
| 06:25 | Cas limites du mod : stockage refusé par le navigateur (le client amont plante sur page vide -> le mod affiche maintenant un écran d'explication), diagnostic hors ligne (verdict correct, 0 erreur), erreur répétée (un seul bandeau). | OK |
| 06:40 | Relais WebSocket (mwc-proxy 0.0.4) installé et démarré localement : répond 200 sur /api/vm/net/connect, le chemin utilisé par render.yaml et par la page de diagnostic. docker-compose du serveur validé. | OK |
| 06:50 | Tests rejouables ajoutés : minecraft-navigateur/site/test.js (15 vérifications, npm test) et extension de minecraft-web/test/run.js (scripts déclarés vs présents, validité de chaque fichier, plein écran et distance adaptative toujours branchés). Test du test : un script retiré de index.html fait bien échouer la suite. | OK |
| 07:10 | Page /diagnostic : section « Ton relais » (saisie, mesure de latence, mémorisation dans proxiesData, retour au relais public). Testée dans Chromium contre un faux relais local : test 10 ms, enregistrement au bon format, bascule dans les deux sens, message clair si injoignable, 0 erreur. | OK |
| 07:25 | Multijoueur CubeCraft testé (serveur dédié, deux navigateurs) : Alice et Bob connectés avec mot de passe, /api/health voit 2 joueurs, message de chat transmis. | OK |
| 07:35 | Persistance du monde testée : bloc posé -> écrit dans world.json à l'arrêt -> rechargé au redémarrage (edits:1). | OK |
| 07:50 | **Test bout en bout réel** : serveur Minecraft Java 1.21.11 officiel lancé localement, relais mwc-proxy local, client web connecté. Entrée en jeu confirmée (pseudo, vie, barre d'action, chunks). Le mod ajuste la distance de rendu en conditions réelles (14 FPS -> 3, puis 59 FPS -> 4). | OK |
| 08:05 | Mesure avec/sans mod sur ce serveur : 60 FPS dans les deux cas (plafond de rafraîchissement), mais distance de rendu 3 sans le mod contre 6 avec, soit 49 chunks contre 169 (3,4x plus de terrain affiché à confort égal). Sur un monde plat vide la charge est faible ; l'écart de FPS se verrait sur un serveur chargé. | OK |
| 08:20 | Outil de planning : feuille de repli intégrée (23 Ko, 295 règles) capturée depuis Tailwind lui-même, inactive tant que le CDN répond. Testé dans les deux cas : avec CDN, comportement inchangé (repli inerte) ; sans CDN, page lisible et parcours complet (employé + shift + heures calculées) sans erreur. Script de regénération versionné. | OK |
| 08:35 | Test bout en bout mobile (écran tactile simulé, serveur réel) : réglages mobile appliqués (rendu 2, interface agrandie, rotation auto), connexion établie, en jeu, boutons tactiles présents, adaptation 2 -> 3 à 52 FPS. | OK |
| 08:45 | Chat testé en jeu contre le serveur réel : message envoyé et reçu. L'avertissement « Do not have data for 1.21.11 » du client amont est donc bénin. | OK |
| 08:55 | Repli CSS éprouvé sur trois scénarios : CDN rapide (repli inerte), CDN absent (page utilisable), CDN lent arrivant après activation du repli (aucun conflit, mêmes couleurs, interface utilisable). | OK |
| 09:10 | Revue de code adversariale (agent indépendant) sur tout le travail de la nuit : 29 points relevés. Vérification un par un avant correction. | OK |
| 09:20 | **Défaut grave confirmé et corrigé** : le repli CSS contenait les règles @media print sorties de leur bloc (accolades déséquilibrées). Sans CDN, la page serait passée en fond blanc, zoom 70 %, feuille de signatures ouverte. Repli régénéré en isolant la vraie feuille Tailwind (20 Ko, 252/252 accolades, zéro règle d'impression) et script de capture corrigé pour ne plus jamais recopier la feuille de la page. | OK |
| 09:25 | Repli : activation fiabilisée (attend le CSS de Tailwind, pas seulement sa variable globale ; remise en veille si le CDN arrive en retard ; surveillance bornée à 30 s). Retesté sur les trois scénarios. | OK |
| 09:30 | Défaut signalé sur les tests de relais (CORS, mauvaise route) : **vérifié et infondé**. Le relais public et le relais local renvoient tous deux Access-Control-Allow-Origin:* et un JSON en HTTP 200 sur /api/vm/net/connect. | OK |
| 09:40 | Planning : pause plus longue que le shift refusée (elle donnait une durée négative ajoutée aux heures payées et au coût) ; nom et rôle échappés aux 7 points d'insertion HTML (un nom contenant des chevrons cassait le planning et le sélecteur) ; nom stocké sans espaces superflus ; contrat négatif refusé. Testé. | OK |
| 09:55 | Mod : PC à dalle tactile n'est plus traité comme un téléphone (exige pointeur grossier ET absence de survol) ; la boucle de réglage FPS ne peut plus s'arrêter sur une exception ; l'interception des messages du client se remet en place si le client la remplace ; la vraie fonction de sortie du plein écran est conservée ; ?safe=1 retire aussi la version imposée du serveur. | OK |
| 10:05 | Diagnostic : même détection tactile, effacement du cookie concurrent à l'enregistrement du relais (sans quoi le choix pouvait rester sans effet), et test « accès à Internet » rendu indépendant du relais. | OK |
| 10:15 | CubeCraft : le verrouillage de la souris attend la fin du passage en plein écran (sinon Chrome l'annule et la visée ne répond plus après une reprise) ; évènement plein écran WebKit écouté ; verrous clavier et orientation protégés contre les exceptions synchrones. | OK |
| 10:25 | Chaîne de déploiement : plus de shell dans les scripts de build (execFileSync), référence de branche validée, téléchargement et extraction séparés pour ne plus masquer un échec de curl. Ordre des branches laissé sur la branche de travail car main ne contient pas encore ce travail, avec une note explicite pour la fusion. | OK |
| 10:35 | Installateurs : somme SHA-1 lue sur le bon fichier (via python3), message explicite si aucune somme n'est vérifiable, test « archive valide » ajouté côté PowerShell, options sans valeur et --ram non entier refusés proprement, aide autonome, et surtout le nettoyage n'emporte plus un mod voisin (sodium-extra survit à une relance : vérifié). | OK |
| 10:50 | Les deux sites redéployés avec toutes les corrections, puis retéléchargés et comparés au dépôt : mod, page de diagnostic et module plein écran identiques. | OK |
| 10:55 | Test bout en bout final contre le vrai serveur Minecraft après corrections : entrée en jeu confirmée, distance de rendu portée à 6 (169 chunks) par l'ajustement automatique. | OK |
| 11:05 | Tests de non-régression ajoutés pour la page de planning (12 vérifications : équilibrage du repli, absence de règles d'impression, gardes de saisie, échappement des noms). Test du test : le défaut d'origine réintroduit fait bien échouer la suite. La comparaison du mod dans l'autre suite accepte désormais un build sans fichiers locaux. | OK |
| 11:20 | Points mineurs de la revue traités : effacement des cookies sur tous les domaines parents plausibles (les anciennes lignes étaient inopérantes sur vercel.app), requêtes du diagnostic réellement interrompues au délai (plus de requêtes ni de minuteurs en suspens), liste des relais dédoublonnée et bornée à 8, lecture du HUD simplifiée. | OK |
| 11:35 | Défaut non relevé par la revue et corrigé : les réglages avaient changé sans que leur numéro de version bouge, donc un joueur ayant déjà chargé le site n'aurait jamais reçu la correction de détection tactile. Numéro porté à 7, migration vérifiée. Test navigateur ajouté au dépôt : les 4 profils d'appareil (PC, PC tactile, Android, iPad) sont correctement reconnus. | OK |

## 07 h 50 – 08 h 30 — Reprise des mesures : la mesure était fausse, et elle cachait la vraie panne

- En relisant les captures d'écran de la mesure de 06 h 47, j'ai vu l'écran « You Died! » et
  « Loading world chunks 0 % » sur les deux. Le monde n'était jamais affiché : les 60 images par
  seconde mesurées ne mesuraient rien. **Résultat annulé.**
- Recherche de la cause : serveur redémarré en créatif et en paisible, monde peuplé côté console
  (72 000 blocs, 162 entités, chunks maintenus chargés). Toujours rien à l'écran.
- Journal du navigateur : `Do not have data for 1.21.11`. Le client négocie le protocole mais n'a
  pas les données de blocs de cette version. **C'est la panne.**
- Serveur Minecraft 1.21.8 monté à côté, même scène : monde affiché, joueur vivant. Confirmation
  directe. → OK
- **Correction d'une erreur de ma part, faite plus tard dans la matinée** : j'avais écrit « 0 chunk
  reçu » en 1.21.11. Faux. Les morceaux de terrain arrivent bien (213 reçus côté réseau) ; c'est
  l'affichage qui ne sait pas les construire. Le seul signal juste est l'indicateur du client,
  bloqué sur « 0 % (0 / 169) ». Documents corrigés.
- Correction : `VERSION_CLIENT = '1.21.8'` dans `mod.js`, `SEED_VERSION` 7 → 8, liste des versions
  affichables et alerte dédiée dans `diagnostic.html`. Décision D7.
- Mesure refaite proprement, trois répétitions, résultats identiques à une image près :
  4 images par seconde sans le mod contre 8 à 9 avec ; à distance de rendu imposée identique,
  3 contre 6 à 7. Rendu logiciel : le rapport compte, pas les valeurs absolues. → OK
- `RAPPORT.md` corrigé : l'affirmation « 3,4 fois plus de terrain » est retirée, remplacée par les
  mesures valides et par ce qu'elles ne prouvent pas.

## 08 h 30 – 09 h 10 — Mise en ligne du correctif et garde-fous

- `test.js` : trois contrôles ajoutés — la version imposée par `mod.js` doit faire partie des
  versions affichables, `diagnostic.html` doit annoncer la même, et la page doit savoir signaler
  une version muette. Vérifié qu'ils échouent bien si on remet 1.21.11. → OK (20 contrôles)
- `test-navigateur.js` : les quatre profils d'appareil passent toujours. → OK
- Déploiement : le premier envoi contenait un `build.js` tronqué (erreur de recopie). Remplacé par
  une amorce de trente lignes qui récupère le vrai build depuis le dépôt. Décision D8.
- Site en ligne vérifié dans un vrai navigateur, sur la copie servie par Vercel :
  joueur neuf → version 1.21.8 ; joueur venu hier en 1.21.11 → corrigé automatiquement en 1.21.8 ;
  page de diagnostic → croix rouge et explication quand l'entrée est sur une version muette. → OK

## 09 h 10 – 09 h 40 — Ce que voit un joueur dont le compte est refusé

- Serveur de test repassé en mode « online » (compte Microsoft exigé), comme DonutSMP. Résultat
  avant correction : un mur de texte anglais, « End reason: WebSocket connection closed with
  unknown reason », suivi des octets bruts du dernier paquet. Aucun bandeau d'aide. → défaut réel
- Deux causes. D'abord le mod n'écoutait que l'écran de chargement, or le client remplace toute la
  page par un écran de déconnexion qui ne passe pas par là. Ensuite l'explication ne distinguait
  pas « refusé à l'entrée » de « coupé en cours de partie » : les deux donnent le même message
  WebSocket, mais pas du tout le même conseil.
- Corrigé : surveillance dédiée de l'écran de déconnexion, indépendante du régulateur de FPS (qui
  peut ne jamais démarrer si l'échec survient tôt), et `explain()` reçoit désormais l'information
  « es-tu déjà entré en jeu ». → OK, bandeau vérifié en test réel
- Contre-épreuve : partie normale sur le même serveur, en jeu, vie 20, 81 colonnes de chunks,
  **aucun bandeau**. Pas de faux avertissement. → OK
- `test.js` : 23 contrôles.

## 09 h 40 – 10 h 20 — Un bandeau pour la panne elle-même

- Ajout d'un chien de garde : en jeu depuis plus de 40 secondes sans qu'un seul morceau de terrain
  soit affiché → bandeau en français nommant la cause (la version) et le geste à faire.
- Première version fausse : elle comptait les morceaux **reçus par le réseau**, qui arrivent très
  bien même quand rien ne s'affiche (213 en 1.21.11). Elle n'aurait jamais rien signalé. Refaite
  sur l'indicateur d'affichage du client, celui que le joueur a sous les yeux. → OK
- Vérifié dans les deux sens sur deux vrais serveurs, en 1.21.11 et en 1.21.8 : bandeau présent sur
  la panne (« en jeu depuis 41 s, aucun morceau de terrain affiché »), absent sur la partie saine.
- `test.js` : 25 contrôles, dont un qui interdit de revenir au mauvais signal.
- Documents corrigés partout où j'avais écrit « 0 chunk reçu ».

## 10 h 20 – 10 h 50 — Empêcher que la panne revienne par le haut

- Le client compilé est récupéré à chaque build depuis son dépôt amont. Rien n'empêchait une mise à
  jour amont de retirer les données de 1.21.8 : le site se serait remis à afficher un écran vide,
  sans que personne le voie avant un joueur.
- Ajout d'un contrôle au moment du build : la version imposée doit figurer dans **toutes** les
  listes de versions Java du client. Première version trop faible — elle exigeait la version dans
  au moins une liste, or 1.21.11 figure dans la liste du protocole et serait passée. Corrigée.
- Vérifié en remettant 1.21.11 : le build s'arrête, code de sortie 1, et le message nomme la liste
  fautive. → OK
- `test.js` : 27 contrôles.

## 10 h 50 – 11 h 30 — Relecture critique de mes propres ajouts du matin

- Deux défauts trouvés dans le chien de garde que je venais d'écrire, avant qu'ils n'atteignent le
  site :
  1. Il lisait `innerText` toutes les 1,5 s. Cette lecture force un recalcul de mise en page à
     chaque appel : sur un mod dont le seul but est la fluidité, c'est une faute. Remplacé par un
     pré-filtre `textContent`, qui ne force rien, et `innerText` n'est lu que dans les rares
     instants où le texte surveillé est effectivement présent.
  2. Il concluait « le monde est affiché » dès que l'indicateur du client était absent. Sur une
     machine où cet indicateur apparaît une seconde après l'entrée en jeu, la panne serait passée
     inaperçue pour le reste de la partie. Ajout d'un délai de grâce de 15 secondes avant de
     conclure quoi que ce soit.
- Les trois scénarios rejoués après la correction : bandeau en 1.21.11, aucun bandeau en 1.21.8,
  bandeau sur compte refusé, aucun bandeau sur partie normale. → OK
- Parcours complet sur téléphone (Pixel 7) contre un vrai serveur : en jeu, monde affiché, profil
  mobile (distance 2), boutons tactiles, aucun bandeau. → OK
- Suites complètes : `minecraft-web` npm test OK, profils d'appareil OK, `test.js` 28 contrôles.

## 11 h 30 – 12 h 10 — Séparer l'appareil du serveur

- La page de diagnostic testait le relais, le serveur, la carte graphique… mais ne permettait pas
  de répondre à la question la plus simple : « est-ce mon appareil ou le serveur ? »
- Ajout d'un bouton « Essayer une partie solo » : un monde local, sans réseau, sans relais et sans
  compte. Si le solo s'affiche et pas DonutSMP, l'appareil est hors de cause.
- Vérifié en cliquant réellement sur le bouton depuis la page : monde généré affiché, aucun
  indicateur de chargement bloqué, aucun bandeau. → OK
- Rapport remis dans l'ordre de lecture : la panne principale passe en tête, les ajouts de fin de
  matinée rejoignent les sections auxquelles ils appartiennent.
- `test.js` : 29 contrôles.

## 12 h 10 – 12 h 40 — Un déploiement qui ne déployait rien

- Après avoir ajouté l'essai en solo, la page en ligne ne changeait pas. Le déploiement était
  pourtant « prêt », et le mod, lui, était bien à jour.
- Deux causes, trouvées en regardant les en-têtes et la durée du build :
  1. Vercel avait réutilisé le build précédent, les fichiers envoyés étant identiques au bit près.
     Build en 10 secondes, rien de reconstruit. Le déploiement paraissait réussi.
  2. La page de diagnostic était servie depuis le cache (`x-vercel-cache: HIT`, âge 600 s), sans
     en-tête l'interdisant, contrairement à la page d'accueil.
- Corrigé : l'amorce épingle le commit visé (le fichier change donc à chaque déploiement, et le
  site déployé vient d'un commit précis), et la page de diagnostic passe en `no-cache`. Décision D9.
- `test.js` : 30 contrôles.
