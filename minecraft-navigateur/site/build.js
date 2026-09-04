// Récupère la version compilée officielle du client web Minecraft (open source, MIT)
// publiée par son intégration continue, et la prépare pour Vercel (dossier dist/).
// Aucune compilation lourde : un simple clone + copie, sans les fichiers de debug (.map).
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

// Page d'accueil francisée : titre de l'onglet
const indexPath = path.join(dist, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/, '<title>Minecraft — DonutSMP</title>');
// Pré-configure le client dans le navigateur du joueur (rien n'est stocké côté site) :
//  - DonutSMP en 1.21.11 avec le COMPTE MICROSOFT obligatoire (le serveur refuse les comptes
//    hors ligne : sans ce réglage il coupe la connexion juste après « encryption_begin ») ;
//  - un profil performance adapté à l'appareil (équivalent des mods FPS côté client officiel) ;
//  - plein écran permanent sur téléphone et tablette, y compris dans les menus.
// SEED_VERSION est incrémenté quand ces réglages changent : les entrées existantes sont alors
// corrigées au lieu d'être ignorées.
const seed = `<script>(function(){
  var SEED_VERSION = 4, MARK = 'mwcSeedVersion';
  var isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;

  function read(k){ try { var raw = localStorage.getItem(k); if (!raw) return null; var p = JSON.parse(raw); return (p && !Array.isArray(p) && p.data !== undefined) ? p.data : p; } catch (e) { return null; } }
  function write(k, v){ try { localStorage.setItem(k, JSON.stringify({ data: v, timestamp: Date.now() })); } catch (e) {} }

  try {
    var applied = Number(localStorage.getItem(MARK) || 0);
    var reset = /[?&]reset=1/.test(location.search);
    if (applied < SEED_VERSION || reset) {
      // ---- Serveur : DonutSMP avec compte Microsoft ----
      var list = read('serversList');
      if (!Array.isArray(list)) list = [];
      var entry = null;
      for (var i = 0; i < list.length; i++) { if (list[i] && String(list[i].ip).indexOf('donutsmp.net') === 0) { entry = list[i]; break; } }
      if (!entry) { entry = { ip: 'donutsmp.net' }; list.unshift(entry); }
      entry.name = 'DonutSMP';
      entry.versionOverride = '1.21.11';
      entry.authenticatedAccountOverride = true;   // compte Microsoft obligatoire
      delete entry.usernameOverride;               // un pseudo forcé garderait le mode hors ligne
      entry.lastJoined = Date.now();
      write('serversList', list);

      // ---- Profil performance (équivalents navigateur des mods FPS) ----
      var settings = read('changedSettings');
      if (!settings || typeof settings !== 'object') settings = {};
      settings.rendererMesher = 'wasm';                  // géométrie compilée : le plus rapide
      settings.rendererWorldPerformance = 'maximum';     // maximum de threads pour les chunks
      settings.backgroundRendering = '5fps';             // bride le rendu en arrière-plan
      settings.keepChunksDistance = 0;                   // libère la mémoire des chunks lointains
      settings.menuBackgroundMode = 'classic';           // pas de scène 3D dans les menus
      settings.starfieldRendering = false;
      settings.newVersionsLighting = false;
      settings.dayCycleAndLighting = false;
      settings.smoothLighting = false;
      settings.disableBlockEntityTextures = true;        // panneaux, bannières, têtes
      settings.renderEars = false;
      settings.viewBobbing = false;
      settings.vrSupport = false;
      settings.displayBossBars = false;
      settings.preventBackgroundTimeoutKick = true;      // pas d'expulsion en arrière-plan
      settings.renderDistance = isTouch ? 3 : 6;
      settings.fov = isTouch ? 70 : 75;
      if (isTouch) {
        settings.autoDisplayRotation = true;             // paysage automatique en portrait
        settings.showHand = false;
        settings.guiScale = 3;
      } else {
        settings.autoFullScreen = true;                  // ordinateur : plein écran en jeu seulement
      }
      write('changedSettings', settings);

      localStorage.setItem(MARK, String(SEED_VERSION));
    }

    // ---- Plein écran permanent sur écran tactile, menus compris ----
    // Les navigateurs exigent un geste de l'utilisateur : on le demande au premier contact,
    // puis à chaque fois qu'on en sort. Rien n'est fait sur ordinateur.
    if (isTouch) {
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
      if (req) {
        var last = 0;
        var ask = function () {
          if (document.fullscreenElement || document.webkitFullscreenElement) return;
          var now = Date.now();
          if (now - last < 1000) return;   // un seul appel par geste (3 évènements se suivent)
          last = now;
          try { var r = req.call(el, { navigationUI: 'hide' }); if (r && r.catch) r.catch(function () {}); } catch (e) {}
        };
        ['pointerdown', 'touchend', 'click'].forEach(function (ev) {
          document.addEventListener(ev, ask, { capture: true, passive: true });
        });
        document.addEventListener('fullscreenchange', function () {
          if (!document.fullscreenElement) setTimeout(ask, 400);
        });
      }
    }
  } catch (e) {}
})();</script>`;
html = html.replace('<head>', '<head>' + seed);
fs.writeFileSync(indexPath, html);

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
console.log(`dist/ prêt : ${files} fichiers copiés, ${skipped} ignorés, build ${commit}`);
