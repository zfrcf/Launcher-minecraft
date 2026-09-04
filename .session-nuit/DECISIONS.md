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
