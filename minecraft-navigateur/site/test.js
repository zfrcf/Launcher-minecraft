// Vérifications du site (sans navigateur) : `npm test` dans minecraft-navigateur/site.
// À lancer après `npm run build`. Elles portent sur ce qui casse silencieusement en production :
// mod absent de la page, JavaScript invalide, page de diagnostic manquante, réécriture d'URL
// oubliée. Le rendu et le jeu eux-mêmes se testent dans un navigateur, pas ici.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const site = __dirname;
const dist = path.join(site, 'dist');
let echecs = 0, total = 0;

function verifie(nom, condition, detail) {
  total++;
  if (condition) { console.log('  ok   ' + nom); return; }
  echecs++;
  console.log('  ÉCHEC ' + nom + (detail ? ' — ' + detail : ''));
}

console.log('Vérifications du site minecraft-navigateur');

// ---- Sources
const mod = fs.readFileSync(path.join(site, 'mod.js'), 'utf8');
verifie('mod.js est du JavaScript valide', (() => {
  try { new vm.Script(mod); return true; } catch (e) { return 'erreur : ' + e.message; }
})() === true);
verifie("mod.js ne contient pas </script> (il est injecté dans une balise script)", !mod.includes('</script>'));
verifie('mod.js protège chaque accès au stockage', mod.includes('stockageUtilisable'));

// La version imposée est le réglage le plus dangereux du mod : une version que le client sait
// négocier mais pas afficher donne une connexion réussie et un écran vide pour toujours. Ces trois
// contrôles empêchent que cela revienne par inadvertance.
const AFFICHABLES = ['1.21.1', '1.21.3', '1.21.4', '1.21.5', '1.21.6', '1.21.8'];
const versionMod = (mod.match(/VERSION_CLIENT = '([^']+)'/) || [])[1];
verifie('mod.js impose une version que le client sait afficher',
  AFFICHABLES.indexOf(versionMod) !== -1, 'version trouvée : ' + versionMod);
verifie('mod.js n’impose plus 1.21.11 (le monde ne s’y affiche jamais)', !/versionOverride\s*=\s*'1\.21\.11'/.test(mod));

verifie('mod.js expose les quatre options d’URL documentées',
  ['safe=1', 'reset=1', 'fullscreen=0', 'hud=1'].every((o) => mod.includes(o)));

const diag = fs.readFileSync(path.join(site, 'diagnostic.html'), 'utf8');
verifie('diagnostic.html teste les huit points annoncés',
  ["add('web'", "add('relay'", "add('server'", "add('gl'", "add('wasm'", "add('device'", "add('mod'", "add('fs'"]
    .every((t) => diag.includes(t)));
verifie('diagnostic.html propose le retour au jeu et le mode sans risque',
  diag.includes('./?modal=serversList') && diag.includes('safe=1'));

const versionDiag = (diag.match(/CLIENT_VERSION = '([^']+)'/) || [])[1];
verifie('diagnostic.html annonce la même version que mod.js', versionDiag === versionMod,
  'diagnostic : ' + versionDiag + ', mod : ' + versionMod);
verifie('diagnostic.html signale une version que le client ne sait pas afficher',
  diag.includes('VERSIONS_AFFICHABLES') && diag.includes('n’est pas affichable'));

verifie('diagnostic.html permet de tester et mémoriser un relais personnel',
  ["id=\"relaisTester\"", "id=\"relaisUtiliser\"", "id=\"relaisPublic\"", "proxiesData"].every((t) => diag.includes(t)));

const vercel = JSON.parse(fs.readFileSync(path.join(site, 'vercel.json'), 'utf8'));
verifie('vercel.json réécrit /diagnostic vers la page',
  (vercel.rewrites || []).some((r) => r.source === '/diagnostic' && r.destination === '/diagnostic.html'));
verifie('vercel.json envoie la racine vers la liste des serveurs',
  (vercel.redirects || []).some((r) => r.source === '/' && r.destination === '/?modal=serversList'));

// ---- Résultat du build (si présent)
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.log('\n  (dist/ absent : lance `npm run build` pour vérifier aussi le résultat du build)');
} else {
  const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  verifie('le mod est injecté dans dist/index.html', index.includes('[mod-optimisation]'));
  // Le build peut légitimement prendre le mod depuis GitHub (déploiement sans fichiers locaux) :
  // on compare alors seulement les repères, pas le contenu octet pour octet.
  const memeMod = index.includes(mod);
  verifie(memeMod ? 'le mod injecté est identique au fichier local'
                  : 'le mod injecté vient du dépôt (build sans fichiers locaux)',
    memeMod || ['stockageUtilisable', 'FPS adaptatif', 'surveillerCoupure'].every((r) => index.includes(r)));
  verifie('le titre de l’onglet est en français', index.includes('<title>Minecraft — DonutSMP</title>'));
  verifie('dist/diagnostic.html est produit', fs.existsSync(path.join(dist, 'diagnostic.html')));
  verifie('dist/diagnostic.html est identique à la source',
    fs.existsSync(path.join(dist, 'diagnostic.html')) && fs.readFileSync(path.join(dist, 'diagnostic.html'), 'utf8') === diag);

  const manifestPath = path.join(dist, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    verifie('le manifeste est en français et en plein écran',
      m.lang === 'fr-FR' && m.display === 'fullscreen', JSON.stringify({ lang: m.lang, display: m.display }));
  }
  verifie('la provenance du client est enregistrée', fs.existsSync(path.join(dist, 'source.txt')));
}

console.log('\n' + (echecs === 0 ? 'OK : ' + total + ' vérifications passent' : echecs + ' échec(s) sur ' + total));
process.exit(echecs === 0 ? 0 : 1);
