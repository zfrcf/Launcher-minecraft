// Vérifications de la page de planning (index.html), sans navigateur : `node test-planning.js`.
// Elles portent sur ce qui casse silencieusement : une feuille de repli mal recopiée, un garde de
// saisie disparu, un nom affiché sans échappement.
'use strict';
const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let echecs = 0, total = 0;
function verifie(nom, ok, detail) {
  total++;
  if (ok) { console.log('  ok   ' + nom); return; }
  echecs++;
  console.log('  ÉCHEC ' + nom + (detail ? ' — ' + detail : ''));
}

console.log('Vérifications de la page de planning');

// ---- Feuille de repli : c'est ici qu'un défaut est déjà passé une fois.
const m = page.match(/<style id="repliTailwind" media="not all">([\s\S]*?)<\/style>/);
verifie('la feuille de repli est présente', !!m);
if (m) {
  const css = m[1];
  const ouvrantes = (css.match(/{/g) || []).length;
  const fermantes = (css.match(/}/g) || []).length;
  verifie('les accolades de la feuille de repli sont équilibrées', ouvrantes === fermantes,
    ouvrantes + ' ouvrantes contre ' + fermantes + ' fermantes');
  verifie('aucune règle d’impression n’a fui dans le repli',
    !css.includes('@page') && !css.includes('@media print'),
    'des règles destinées à l’imprimante s’appliqueraient à l’écran');
  verifie('le repli contient bien les classes de mise en forme',
    ['.bg-gray-800', '.hidden', '.flex', '.rounded'].every((c) => css.includes(c)));
  verifie('le repli ne recopie pas la feuille de la page', !css.includes('--fp-dark'));
}
verifie('le repli est en veille par défaut', page.includes('id="repliTailwind" media="not all"'));
verifie('le repli attend le style de Tailwind, pas seulement sa variable', page.includes('cssTailwindPose'));

// ---- Gardes de saisie
verifie('un shift sans collaborateur est refusé', page.includes("Choisis d'abord un collaborateur"));
verifie('une pause plus longue que le shift est refusée', page.includes('La pause est aussi longue'));
verifie('les champs manquants d’un employé sont nommés',
  page.includes('Indique le nom du collaborateur') && page.includes("heures du contrat"));

// ---- Échappement des textes saisis
verifie('la fonction d’échappement existe', /function esc\(/.test(page));
const brut = page.match(/\$\{(?:e|emp)\.(?:name|role)\}/g) || [];
verifie('aucun nom ni rôle inséré sans échappement', brut.length === 0,
  brut.length ? brut.length + ' insertion(s) brute(s) restante(s)' : '');

console.log('\n' + (echecs === 0 ? 'OK : ' + total + ' vérifications passent' : echecs + ' échec(s) sur ' + total));
process.exit(echecs === 0 ? 0 : 1);
