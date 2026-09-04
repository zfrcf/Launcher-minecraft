// Amorce déployée sur Vercel, sous le nom build.js.
//
// Pourquoi une amorce plutôt que le vrai build.js : l'outil de déploiement envoie les fichiers
// encodés dans l'appel, et un fichier de plusieurs kilo-octets recopié à la main est une source
// d'erreurs (un octet abîmé est passé inaperçu une fois déjà). Ici le déploiement ne contient que
// ces quelques lignes ; le vrai build.js, mod.js et diagnostic.html viennent tous du dépôt, donc
// le site servi est exactement ce qui est commité — et une correction poussée sur la branche prend
// effet au prochain build sans redéployer quoi que ce soit.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BRUT = 'https://raw.githubusercontent.com/zfrcf/Launcher-minecraft';

// Commit visé par ce déploiement. Il sert deux buts, et les deux comptent :
//
// 1. Vercel réutilise le résultat du build précédent quand les fichiers envoyés sont identiques.
//    Comme cette amorce est le seul fichier qui bouge, un déploiement sans ce numéro ne
//    reconstruisait rien : le site restait figé sur la version précédente alors que tout semblait
//    s'être bien passé. Constaté pour de vrai (build en 10 secondes, page inchangée).
// 2. Le site déployé est celui d'un commit précis, pas « ce qu'il y a sur la branche à cet
//    instant ». Le déploiement devient reproductible et vérifiable.
//
// À mettre à jour à chaque déploiement : `git rev-parse HEAD`.
const REVISION = '7089457f1965621ec5445d49bba18e06f011b8b0';

// La branche de travail après le commit, comme filet si le commit n'est pas encore visible sur
// GitHub ; main en dernier, tant que ce travail n'y est pas fusionné.
const REFS = [process.env.SITE_REF, REVISION, 'claude/repo-cleanup-extract-zip-9cei1x', 'main']
  .filter(Boolean).filter((r) => r !== 'REVISION_A_REMPLACER');
const REF_VALIDE = /^[\w.\-\/]+$/;

let source = null;
let refRetenue = null;
for (const ref of REFS) {
  if (!REF_VALIDE.test(ref)) { console.warn('Référence ignorée (caractères inattendus) : ' + ref); continue; }
  const url = BRUT + '/' + ref + '/minecraft-navigateur/site/build.js';
  try {
    source = execFileSync('curl', ['-fsSL', url], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    refRetenue = ref;
    console.log('build.js récupéré depuis ' + ref);
    break;
  } catch (e) { console.warn('build.js introuvable sur ' + ref); }
}
if (!source) throw new Error('build.js introuvable sur GitHub (' + REFS.join(', ') + ')');

// mod.js et diagnostic.html doivent venir de la MÊME référence que build.js, sinon on assemblerait
// un site à partir de deux états différents du dépôt.
process.env.SITE_REF = refRetenue;

// Écrit à côté de l'amorce : le vrai build.js se sert de __dirname pour trouver dist/ et les
// fichiers du site, et doit donc s'exécuter depuis le même dossier.
const cible = path.join(__dirname, 'build-depot.js');
fs.writeFileSync(cible, source);
require(cible);
