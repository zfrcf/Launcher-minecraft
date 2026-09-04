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

// Le build doit refuser de produire un site dont la version imposée n'est pas affichable par le
// client récupéré ce jour-là. Exiger la version dans une seule liste ne suffit pas : 1.21.11 figure
// dans la liste du protocole et passerait.
const buildjs = fs.readFileSync(path.join(site, 'build.js'), 'utf8');
verifie('build.js refuse une version que le client n’affiche pas',
  buildjs.includes('listesJava') && buildjs.includes('Corrige VERSION_CLIENT'));
verifie('ce contrôle exige la version dans toutes les listes Java, pas une seule',
  buildjs.includes('manquantes') && buildjs.includes("indexOf('1.21.4')"));

// Le chien de garde « connecté mais rien à l'écran » doit lire l'indicateur d'affichage du client,
// pas le nombre de morceaux reçus par le réseau : ceux-là arrivent, même quand rien ne s'affiche.
verifie('mod.js surveille « connecté mais le monde ne s’affiche pas »',
  mod.includes('surveillerMondeVide') && mod.includes('monde ne s’affiche pas'));
verifie('ce chien de garde lit l’indicateur d’affichage, pas les chunks reçus',
  mod.includes("indexOf('Loading world chunks')") && !/surveillerMondeVide[\s\S]{0,900}getColumns/.test(mod));

// L'écran « You have been disconnected » du client ne passe pas par le statut de chargement :
// sans surveillance dédiée, le joueur reste devant un message anglais suivi d'octets bruts.
verifie('mod.js explique l’écran de déconnexion du client',
  mod.includes('have been disconnected') && mod.includes('surveillerEcranDeconnexion'));
verifie('mod.js surveille cet écran sans dépendre du régulateur de FPS',
  /setInterval\(function \(\)[\s\S]{0,200}surveillerEcranDeconnexion/.test(mod));
// innerText force un recalcul de mise en page à chaque lecture : un mod de performance ne peut pas
// se le permettre en boucle. textContent sert de pré-filtre.
verifie('la surveillance ne lit pas innerText à chaque tour',
  mod.includes('function texteBrut') && mod.includes('document.body.textContent'));
verifie('le bandeau d’aide porte un repère stable', mod.includes("setAttribute('data-mod-aide'"));

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

// Une partie solo n'utilise ni réseau, ni relais, ni compte : c'est le seul moyen simple de
// séparer « mon appareil ne va pas » de « le serveur me refuse ».
verifie('diagnostic.html propose un essai en solo',
  diag.includes('singleplayer=1') && diag.includes('Essayer une partie solo'));

verifie('diagnostic.html permet de tester et mémoriser un relais personnel',
  ["id=\"relaisTester\"", "id=\"relaisUtiliser\"", "id=\"relaisPublic\"", "proxiesData"].every((t) => diag.includes(t)));

const vercel = JSON.parse(fs.readFileSync(path.join(site, 'vercel.json'), 'utf8'));
// La page de diagnostic est celle qu'on met à jour quand quelque chose ne va pas : servie depuis
// le cache, une correction resterait invisible pendant des heures. Constaté pour de vrai.
verifie('vercel.json interdit la mise en cache de la page de diagnostic',
  /diagnostic\.html[\s\S]{0,120}no-cache/.test(JSON.stringify(vercel)));

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
