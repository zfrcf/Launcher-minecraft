// Tests rapides côté Node : génération de terrain, modifications, maillage, gravité.
global.window = { MC: {} };
const path = require('path');
['noise', 'blocks', 'world', 'mesher'].forEach((f) => require(path.join(__dirname, '..', 'public', 'js', f + '.js')));
const MC = global.window.MC;
const assert = require('assert');

const w = new MC.World(12345);
const t0 = Date.now();
for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) w.ensureChunk(cx, cz);
console.log('25 chunks générés en', Date.now() - t0, 'ms');

// déterminisme
const w2 = new MC.World(12345);
w2.ensureChunk(0, 0);
assert.deepStrictEqual(Buffer.from(w.getChunk(0, 0).data), Buffer.from(w2.getChunk(0, 0).data), 'génération non déterministe');

// blocs cohérents
const counts = {};
for (const c of w.chunks.values()) for (const id of c.data) counts[id] = (counts[id] || 0) + 1;
console.log('répartition des blocs :', counts);
assert(counts[1] > 0 || counts[6] > 0, 'aucune surface');
assert(counts[3] > 0, 'aucune pierre');

// setBlock + edits
const sy = w.surfaceY(3, 3);
assert([0, 7].includes(w.getBlock(3, sy, 3)), 'surfaceY doit renvoyer un bloc vide ou eau');
w.setBlock(3, sy, 3, 12);
assert.strictEqual(w.getBlock(3, sy, 3), 12);
assert.strictEqual(w.edits.size, 1);
const arr = w.editsToArray();
assert.deepStrictEqual(arr[0], [3, sy, 3, 12]);

// les edits sont réappliqués sur un nouveau monde
const w3 = new MC.World(12345);
w3.applyEdits(arr);
w3.ensureChunk(0, 0);
assert.strictEqual(w3.getBlock(3, sy, 3), 12, 'edit non réappliqué à la génération');

// gravité : sable au-dessus d'un trou
w.setBlock(5, sy, 5, 6); w.setBlock(5, sy + 1, 5, 6);
w.setBlock(5, sy - 1, 5, 0);
const ch = w.settleGravity(5, sy - 1, 5);
assert(ch.length >= 2, 'le sable doit tomber');
assert.strictEqual(w.getBlock(5, sy - 1, 5), 6);

// maillage
const t1 = Date.now();
let faces = 0;
for (const c of w.chunks.values()) {
  const g = MC.meshChunk(w, c);
  for (const k of Object.keys(g)) {
    assert.strictEqual(g[k].pos.length / 3 * 1.5, g[k].idx.length, 'index/positions incohérents ' + k);
    assert.strictEqual(g[k].pos.length / 3 * 2, g[k].uv.length);
    faces += g[k].idx.length / 6;
  }
}
console.log('maillage de 25 chunks :', Date.now() - t1, 'ms,', faces, 'faces');
assert(faces > 1000);

// ---- Cohérence du site : ce qui casse silencieusement quand on ajoute un fichier ----
// (un script ajouté dans public/js mais oublié dans la liste de index.html ne serait jamais chargé)
const fs = require('fs');
const vm = require('vm');
const pub = path.join(__dirname, '..', 'public');
const index = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');

const listes = index.match(/var names = \[([^\]]*)\]/);
assert(listes, 'liste des scripts introuvable dans index.html');
const declares = listes[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
const presents = fs.readdirSync(path.join(pub, 'js')).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''));

for (const f of presents) assert(declares.includes(f), 'public/js/' + f + '.js existe mais n\'est chargé nulle part dans index.html');
for (const d of declares) assert(presents.includes(d), 'index.html charge js/' + d + '.js qui n\'existe pas');

for (const f of presents) {
  const code = fs.readFileSync(path.join(pub, 'js', f + '.js'), 'utf8');
  try { new vm.Script(code); } catch (e) { assert.fail('public/js/' + f + '.js : JavaScript invalide — ' + e.message); }
}
console.log('site :', declares.length, 'scripts déclarés et présents, tous syntaxiquement valides');

// Le plein écran doit rester branché : sans cet appel, le module est chargé mais jamais démarré.
const main = fs.readFileSync(path.join(pub, 'js', 'main.js'), 'utf8');
assert(main.includes('MC.Fullscreen.init()'), 'main.js ne démarre plus le plein écran');
assert(main.includes('adaptDistance'), 'main.js ne règle plus la distance de rendu selon les FPS');

console.log('OK : tous les tests passent');
