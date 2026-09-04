// Récupère la version compilée officielle du client web Minecraft (open source, MIT)
// publiée par son intégration continue, et la prépare pour Vercel (dossier dist/).
// Aucune compilation lourde : un simple clone + copie, sans les fichiers de debug (.map).
// Le mod d'optimisation (mod.js) est injecté en tête de index.html, avant le client.
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC_REPO = 'https://github.com/zardoy/mwc-mcraft-pages';
const tmp = path.join(__dirname, '.mwc-src');
const dist = path.join(__dirname, 'dist');

fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(dist, { recursive: true, force: true });
console.log('Clone de ' + SRC_REPO);
execSync(`git clone --depth 1 ${SRC_REPO} "${tmp}"`, { stdio: 'inherit', env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });

const docs = path.join(tmp, 'docs');
let files = 0, skipped = 0;
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name), dst = path.join(to, entry.name);
    if (entry.isDirectory()) { copyDir(src, dst); continue; }
    if (entry.name.endsWith('.map') || entry.name === 'CNAME') { skipped++; continue; }
    fs.copyFileSync(src, dst); files++;
  }
}
copyDir(docs, dist);

// Page d'accueil : titre de l'onglet + mod d'optimisation injecté avant le client.
const indexPath = path.join(dist, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('<head>')) throw new Error('index.html du client : balise <head> introuvable');
html = html.replace(/<title>[^<]*<\/title>/, () => '<title>Minecraft — DonutSMP</title>');
const mod = fs.readFileSync(path.join(__dirname, 'mod.js'), 'utf8');
if (mod.includes('</script>')) throw new Error('mod.js ne doit pas contenir </script>');
// Remplacement par fonction : un "$" dans le code du mod ne doit pas être interprété par replace().
html = html.replace('<head>', () => '<head><script>' + mod + '</script>');
fs.writeFileSync(indexPath, html);

// Page de diagnostic (relais, serveur, WebGL, état du mod) : /diagnostic
fs.copyFileSync(path.join(__dirname, 'diagnostic.html'), path.join(dist, 'diagnostic.html'));

// Application installable sur l'écran d'accueil du téléphone (PWA) : nom en français
const manifestPath = path.join(dist, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.name = 'Minecraft — DonutSMP';
  manifest.short_name = 'Minecraft';
  manifest.lang = 'fr-FR';
  manifest.display = 'fullscreen';       // plein écran quand l'app est installée sur le téléphone
  manifest.display_override = ['fullscreen', 'standalone'];
  manifest.start_url = './?modal=serversList';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

const commit = execSync('git rev-parse --short HEAD', { cwd: tmp }).toString().trim();
fs.writeFileSync(path.join(dist, 'source.txt'), 'zardoy/mwc-mcraft-pages@' + commit + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`dist/ prêt : ${files} fichiers copiés, ${skipped} ignorés, build ${commit}, mod ${mod.length} octets`);
