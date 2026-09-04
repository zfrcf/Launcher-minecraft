// Prépare le dossier `public/` pour Vercel à partir du dépôt GitHub.
//
// Pourquoi : l'outil de déploiement envoie les fichiers en base64 dans un seul appel, ce qui
// plafonne vite (three.js pèse à lui seul 600 Ko). Le jeu avait donc été éclaté sur six projets
// Vercel (`cubecraft-web` + `cubecraft-web-js1..5`), avec une correspondance fichier -> projet à
// maintenir à la main dans index.html. Ici, le déploiement ne contient que quatre petits fichiers
// (build.js, package.json, vercel.json, api/config.js) et le build récupère `public/` complet
// depuis le dépôt : un seul projet, aucune correspondance à maintenir, et le site servi est
// exactement ce qui est commité.
//
// En local, `public/` existe déjà : le script ne fait rien (le dossier du dépôt fait foi).
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'zfrcf/Launcher-minecraft';
const REFS = [process.env.SITE_REF || 'claude/repo-cleanup-extract-zip-9cei1x', 'main'];
const pub = path.join(__dirname, 'public');

function compte(dir) {
  let n = 0, octets = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = compte(p); n += r.n; octets += r.octets; }
    else { n++; octets += fs.statSync(p).size; }
  }
  return { n, octets };
}

if (fs.existsSync(path.join(pub, 'index.html'))) {
  const { n, octets } = compte(pub);
  console.log(`public/ déjà présent : ${n} fichiers, ${Math.round(octets / 1024)} Ko (dépôt local)`);
  process.exit(0);
}

const tmp = path.join(__dirname, '.src');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

let ok = false;
for (const ref of REFS) {
  const url = `https://codeload.github.com/${REPO}/tar.gz/refs/heads/${ref}`;
  try {
    console.log('Récupération de ' + ref);
    // --strip-components=1 retire le dossier racine « Launcher-minecraft-<ref> » de l'archive.
    execSync(`curl -fsSL "${url}" | tar -xz -C "${tmp}" --strip-components=1`, { stdio: ['ignore', 'inherit', 'inherit'], shell: '/bin/bash' });
    ok = true;
    break;
  } catch (e) { console.warn(`Branche ${ref} indisponible`); }
}
if (!ok) throw new Error(`Impossible de récupérer le dépôt (${REFS.join(', ')})`);

const src = path.join(tmp, 'minecraft-web', 'public');
if (!fs.existsSync(path.join(src, 'index.html'))) throw new Error('minecraft-web/public/index.html absent de l’archive');
fs.cpSync(src, pub, { recursive: true });
fs.rmSync(tmp, { recursive: true, force: true });

const { n, octets } = compte(pub);
console.log(`public/ prêt : ${n} fichiers, ${Math.round(octets / 1024)} Ko`);
