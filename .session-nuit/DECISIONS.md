# Décisions prises à la place de l'utilisateur

## D1 — Branche de travail
- Contexte : le mode autonome recommande une branche `nuit/AAAA-MM-JJ` ; l'environnement impose de ne pousser que sur `claude/repo-cleanup-extract-zip-9cei1x`.
- Choix : rester sur la branche imposée, commits atomiques par tâche.
- Réversible : oui (cherry-pick possible).

## D2 — Déploiement Vercel du client navigateur
- Contexte : le mode autonome interdit les déploiements en production ; mais l'utilisateur a demandé explicitement, dans cette session, que ce site soit sur Vercel et amélioré pour demain après-midi. Il ne joue pas pendant la nuit. Vercel garde les déploiements précédents (retour arrière en un clic).
- Choix : ne déployer en production que des builds passés par les tests Chromium (PC + mobile), après vérification octet à octet du mod en ligne. Aucun autre projet Vercel n'est touché sans vérification équivalente.
- Réversible : oui (rollback Vercel vers le déploiement précédent).

## D3 — Périmètre de la page racine « Fitness Park Manager »
- Contexte : outil métier avec données en localStorage (employés, plannings). Pas de consigne précise.
- Choix : ne corriger que des erreurs JavaScript évidentes ; ne pas changer la structure des données ni la logique métier.
- Réversible : oui.

## D4 — Le compte rendu de session est versionné
- Contexte : le mode autonome suggère d'ignorer `.session-nuit/` dans git. Mais ce conteneur est éphémère : tout fichier non commité disparaît, et le rapport ne serait jamais lu.
- Choix : versionner `PLAN.md`, `JOURNAL.md`, `DECISIONS.md` et `RAPPORT.md` dans le dépôt.
- Réversible : oui (supprimer le dossier et le remettre dans `.gitignore`).

## D5 — Périmètre des corrections sur la page de planning
- Contexte : deux défauts trouvés (shift sans collaborateur compté dans les totaux, refus silencieux à l'ajout d'un employé). Le premier fausse des chiffres affichés.
- Choix : corriger les deux, sans toucher à la structure des données, aux calculs ni à la logique métier. Parcours normal revérifié après correction.
- Réversible : oui (deux modifications localisées dans `index.html`).

## D6 — Déploiement des sites Vercel depuis GitHub
- Contexte : l'envoi direct des fichiers plafonne en taille, ce qui avait conduit à éclater CubeCraft sur six projets Vercel avec une correspondance fichier -> projet à maintenir à la main.
- Choix : les scripts de build récupèrent les sources depuis le dépôt GitHub au moment du build. Un déploiement n'envoie plus que quelques fichiers de configuration, et le site en ligne correspond exactement à ce qui est commité.
- Conséquence : les projets `cubecraft-web-js1` à `js5` ne servent plus. Je ne les ai pas supprimés (action irréversible côté compte Vercel) : c'est à toi de le faire si tu le souhaites.
- Réversible : oui.

## D7 — Version imposée à DonutSMP : 1.21.8 au lieu de 1.21.11

**Contexte.** Le mod forçait la connexion à DonutSMP en 1.21.11. En reprenant les mesures de
performance sur un vrai serveur, j'ai découvert que le client web se connecte bien en 1.21.11 mais
n'affiche jamais le monde : l'écran reste sur « Loading world chunks 0 % », la vie reste à zéro et
l'interface montre « You Died! ». Le journal du navigateur donne la cause exacte :
`Do not have data for 1.21.11`. Le client parle le protocole 1.21.11, mais il n'embarque pas les
données de blocs de cette version.

**Vérification.** Même serveur, même scène, même machine. En 1.21.8 : monde affiché, vie à 20. En
1.21.11 : l'indicateur du client reste sur « 0 % (0 / 169) » et l'écran est vide. Correction d'une
première lecture erronée de ma part : les morceaux de terrain **arrivent** par le réseau (213 reçus
côté client), c'est l'affichage qui ne sait pas les construire. Les versions dont le client possède
les données sont 1.21.1, 1.21.3, 1.21.4, 1.21.5, 1.21.6 et 1.21.8.

**Options.** (a) Laisser 1.21.11 et documenter le problème. (b) Descendre à 1.21.8. (c) Détecter la
version affichable la plus haute au chargement.

**Choix : (b), avec la détection de (c) reportée.** DonutSMP annonce accepter de 1.7.2 à la dernière
version : 1.21.8 passe. La détection dynamique dépendrait de variables internes au client compilé,
donc d'un détail d'implémentation qui casserait à la prochaine mise à jour du client.

**Réversible.** Une constante `VERSION_CLIENT` dans `mod.js`, et la même liste dans
`diagnostic.html`. `SEED_VERSION` passe de 7 à 8 pour que les joueurs déjà venus soient corrigés
automatiquement.

**Portée probable.** C'est très vraisemblablement la cause de « DonutSMP ne charge même pas ».

## D8 — Le déploiement Vercel n'envoie plus qu'une amorce

**Contexte.** Le déploiement envoie les fichiers encodés dans l'appel de l'outil. Recopier
`build.js` (5 300 octets) à la main à chaque déploiement a déjà produit un octet abîmé passé
inaperçu, et vient de produire un fichier tronqué.

**Choix.** `minecraft-navigateur/site/build-vercel.js` : trente lignes qui téléchargent le vrai
`build.js` depuis le dépôt et l'exécutent. C'est ce fichier qui est déployé, sous le nom
`build.js`.

**Conséquence utile.** Une correction poussée sur la branche prend effet au prochain build sans
redéployer. Le site servi est, par construction, ce qui est commité.

**Risque assumé.** Si GitHub est injoignable au moment du build, le build échoue. C'était déjà le
cas : `mod.js` et `diagnostic.html` étaient déjà récupérés depuis le dépôt.

## D9 — Le déploiement épingle un commit

**Contexte.** Un déploiement a été annoncé « prêt » en 10 secondes sans rien reconstruire, et la
page de diagnostic est restée sur sa version précédente. Cause : Vercel réutilise le résultat du
build quand les fichiers envoyés sont identiques. Or, avec l'amorce (décision D8), l'amorce est le
seul fichier envoyé et elle ne changeait jamais. Le déploiement paraissait réussi et ne déployait
rien.

**Choix.** L'amorce contient une constante `REVISION` mise à jour à chaque déploiement avec le
commit visé. Elle sert de deux façons : les fichiers envoyés diffèrent donc le build a lieu, et le
site déployé provient d'un commit précis au lieu de « l'état de la branche à cet instant ».
`mod.js` et `diagnostic.html` sont récupérés depuis la même référence, pour ne pas assembler un
site à partir de deux états du dépôt.

**Aussi.** `Cache-Control: no-cache` sur la page de diagnostic. C'est la page qu'on corrige quand
quelque chose ne va pas ; servie depuis le cache, une correction resterait invisible des heures.

**Le vrai remède reste à ta main** : relier le dépôt à Vercel, pour que chaque `git push`
reconstruise tout seul. C'est dans « Ce qui t'attend ».
