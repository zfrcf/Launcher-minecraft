# Plan de session autonome — nuit du 4 au 5 septembre 2026

Objectif donné : « Améliore tout pour demain aprem. Continue à travailler jusqu'à demain aprem. »
Échéance : vendredi 5 septembre 2026, 14 h (Paris) = 12 h UTC.
Branche de travail : `claude/repo-cleanup-extract-zip-9cei1x` (branche imposée par l'environnement).

## Priorité 1 — Client Minecraft navigateur (minecraft-navigateur/site) : « DonutSMP ne charge pas »
- [ ] 1.1 Page `/diagnostic` en français : relais, statut DonutSMP, WebGL/WASM, appareil, état du mod, boutons réinitialiser / mode sans risque.
- [ ] 1.2 Dans le mod : détection d'un échec de connexion (relais injoignable, version refusée…) et bandeau d'aide en français avec lien vers le diagnostic.
- [ ] 1.3 Dans le mod : si le chargement dépasse 45 s sans entrer en jeu, bandeau d'aide.
- [ ] 1.4 Vérifier la liste des relais publics disponibles et, s'il en existe d'autres, les pré-charger en secours.
- [ ] 1.5 Tests Chromium (PC + mobile) du build ; déploiement Vercel production une fois vérifié.
- [ ] 1.6 README mis à jour.

## Priorité 2 — CubeCraft Web (minecraft-web) : le jeu maison
- [ ] 2.1 Test de fumée Chromium : le jeu se lance en solo sans erreur, FPS mesurés.
- [ ] 2.2 Plein écran au menu et en jeu (même logique que le mod), sur PC et mobile.
- [ ] 2.3 Corriger les bugs trouvés ; renforcer `npm test`.
- [ ] 2.4 Préparer le redéploiement Vercel (les scripts sont éclatés sur 6 projets : documenter la commande).

## Priorité 3 — Installateur Fabric (minecraft-fabric)
- [ ] 3.1 Test réel de `installer.sh` dans un dossier temporaire (Java présent sur la machine).
- [ ] 3.2 Robustesse : messages d'erreur clairs, option `--version latest`, vérification des téléchargements.
- [ ] 3.3 Relecture de `installer.ps1` (pas de PowerShell ici : relecture statique uniquement).

## Priorité 4 — Dépôt
- [ ] 4.1 README racine en français décrivant les 5 parties du projet.
- [ ] 4.2 Page racine « Fitness Park Manager » : test de chargement Chromium, correction des seules erreurs JS évidentes, sans toucher aux données ni au métier.

## Priorité 5 — Si tout est terminé
- Relecture, cas limites, documentation, liste des améliorations non réalisées.

## Rythme
Travail par blocs, réveils programmés (`send_later`) toutes les 1 à 2 h pour continuer, rapport final avant 12 h UTC le 5 septembre.
