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
// La branche de travail d'abord tant qu'elle n'est pas fusionnée dans main : servir main
// aujourd'hui déploierait une version antérieure.
const REFS = [process.env.SITE_REF, 'claude/repo-cleanup-extract-zip-9cei1x', 'main'].filter(Boolean);
const REF_VALIDE = /^[\w.\-\/]+$/;

let source = null;
for (const ref of REFS) {
  if (!REF_VALIDE.test(ref)) { console.warn('Référence ignorée (caractères inattendus) : ' + ref); continue; }
  const url = BRUT + '/' + ref + '/minecraft-navigateur/site/build.js';
  try {
    source = execFileSync('curl', ['-fsSL', url], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    console.log('build.js récupéré depuis ' + ref);
    break;
  } catch (e) { console.warn('build.js introuvable sur ' + ref); }
}
if (!source) throw new Error('build.js introuvable sur GitHub (' + REFS.join(', ') + ')');

// Écrit à côté de l'amorce : le vrai build.js se sert de __dirname pour trouver dist/ et les
// fichiers du site, et doit donc s'exécuter depuis le même dossier.
const cible = path.join(__dirname, 'build-depot.js');
fs.writeFileSync(cible, source);
require(cible);
