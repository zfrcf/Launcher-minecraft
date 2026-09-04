// Mod d'optimisation pour le client Minecraft navigateur (injecté dans <head> par build.js).
// Il joue, côté navigateur, le rôle des mods FPS du jeu officiel (Sodium, Entity Culling,
// Dynamic FPS…) qui ne peuvent pas s'exécuter ici : ce sont des mods Java.
//
// Trois blocs :
//  1. PROFIL PERFORMANCE : tous les réglages du client poussés au maximum, adaptés à la
//     puissance de l'appareil (cœurs CPU, mémoire, écran tactile). Réappliqué quand
//     SEED_VERSION change, ou avec ?reset=1.
//  2. PLEIN ÉCRAN PARTOUT : menus compris, sur PC comme sur téléphone/tablette. Le client
//     ne peut plus quitter le plein écran par lui-même ; seule la touche Échap du navigateur
//     le peut, et on y revient au geste suivant. Désactivable avec ?fullscreen=0.
//  3. FPS ADAPTATIF : en jeu, la distance de rendu baisse toute seule quand les FPS chutent
//     (spawn de DonutSMP, foule de joueurs) et remonte quand ça respire. ?hud=1 affiche
//     un petit compteur FPS / distance.
//
// Rien n'est envoyé nulle part : tout reste dans le navigateur du joueur.
(function () {
  'use strict';
  var TAG = '[mod-optimisation]';
  var SEED_VERSION = 5;
  var MARK = 'mwcSeedVersion';
  var q = location.search;
  var isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var cores = navigator.hardwareConcurrency || 4;
  var memory = navigator.deviceMemory || 4;

  // Palier de puissance -> distance de rendu de départ, minimale et maximale (en chunks).
  // Le bloc 3 ajuste ensuite en direct entre min et max.
  var tier = (cores >= 8 && memory >= 8) ? 'haut' : (cores <= 4 || memory <= 4) ? 'bas' : 'moyen';
  var RD = isTouch
    ? { bas: [2, 2, 3], moyen: [3, 2, 4], haut: [3, 2, 5] }[tier]
    : { bas: [4, 2, 6], moyen: [6, 3, 8], haut: [8, 4, 10] }[tier];
  var RD_START = RD[0], RD_MIN = RD[1], RD_MAX = RD[2];

  function read(k) { try { var raw = localStorage.getItem(k); if (!raw) return null; var p = JSON.parse(raw); return (p && !Array.isArray(p) && p.data !== undefined) ? p.data : p; } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify({ data: v, timestamp: Date.now() })); } catch (e) {} }

  // ------------------------------------------------------------------ 1. PROFIL PERFORMANCE
  try {
    var applied = Number(localStorage.getItem(MARK) || 0);
    if (applied < SEED_VERSION || /[?&]reset=1/.test(q)) {
      // Serveur DonutSMP avec compte Microsoft obligatoire (le serveur refuse le mode hors ligne).
      var list = read('serversList');
      if (!Array.isArray(list)) list = [];
      var entry = null;
      for (var i = 0; i < list.length; i++) { if (list[i] && String(list[i].ip).indexOf('donutsmp.net') === 0) { entry = list[i]; break; } }
      if (!entry) { entry = { ip: 'donutsmp.net' }; list.unshift(entry); }
      entry.name = 'DonutSMP';
      entry.versionOverride = '1.21.11';
      entry.authenticatedAccountOverride = true;
      delete entry.usernameOverride;
      entry.lastJoined = Date.now();
      write('serversList', list);

      var s = read('changedSettings');
      if (!s || typeof s !== 'object') s = {};
      // Moteur
      s.gpuPreference = 'high-performance';        // carte graphique dédiée si l'appareil en a une
      s.rendererMesher = 'wasm';                   // géométrie compilée : le plus rapide
      s.rendererWorldPerformance = 'maximum';      // tous les threads pour les chunks
      s.neighborChunkUpdates = false;              // moins de recalculs de géométrie
      s.keepChunksDistance = 0;                    // libère la mémoire des chunks lointains
      s.renderDistance = RD_START;
      // Rendu
      s.smoothLighting = false;
      s.newVersionsLighting = false;
      s.dayCycleAndLighting = false;
      s.starfieldRendering = false;
      s.defaultSkybox = false;
      s.disableBlockEntityTextures = true;         // panneaux, bannières, têtes
      s.loadPlayerSkins = false;                   // des centaines de skins à charger sur DonutSMP
      s.renderEars = false;
      s.viewBobbing = false;
      s.vrSupport = false;
      s.displayBossBars = false;
      s.showMinimap = 'never';
      s.renderDebug = 'none';
      s.fov = isTouch ? 70 : 75;
      // Interface et menus
      s.menuBackgroundMode = 'classic';            // pas de scène 3D dans les menus
      s.displayLoadingMessages = false;
      s.enableMusic = false;
      s.errorReporting = false;                    // pas de télémétrie en arrière-plan
      // Arrière-plan et veille
      s.backgroundRendering = '5fps';
      s.preventBackgroundTimeoutKick = true;
      s.preventSleep = true;                       // l'écran ne s'éteint pas en jeu
      // Plein écran géré par le bloc 2 ; on empêche le client de le quitter tout seul
      s.autoFullScreen = true;
      s.autoExitFullscreen = false;
      if (isTouch) { s.autoDisplayRotation = true; s.showHand = false; s.guiScale = 3; }
      write('changedSettings', s);
      localStorage.setItem(MARK, String(SEED_VERSION));
      console.info(TAG, 'profil', tier, 'appliqué (v' + SEED_VERSION + '), distance de rendu', RD_START);
    }
  } catch (e) { console.warn(TAG, 'profil non appliqué', e); }

  // ------------------------------------------------------------------ 2. PLEIN ÉCRAN PARTOUT
  var fsEnabled = !/[?&]fullscreen=0/.test(q);
  var docEl = document.documentElement;
  var reqFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.webkitRequestFullScreen;
  function inFS() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

  if (fsEnabled && reqFS) {
    // Le client ne doit plus pouvoir sortir du plein écran (il le fait dans certains menus).
    var noop = function () { return Promise.resolve(); };
    try { document.exitFullscreen = noop; } catch (e) {}
    try { document.webkitExitFullscreen = noop; } catch (e) {}

    var busy = false;
    function askFS() {
      if (busy || inFS()) return;
      busy = true;
      var done = function () { busy = false; };
      try {
        var r = reqFS.call(docEl, { navigationUI: 'hide' });
        if (r && r.then) { r.then(done, done); } else { done(); }
      } catch (e) { done(); }
    }
    // Seuls ces évènements donnent le droit d'ouvrir le plein écran (activation utilisateur).
    // pointerdown tactile n'en fait pas partie : c'était le bug de la version précédente.
    ['pointerup', 'touchend', 'click'].forEach(function (ev) {
      document.addEventListener(ev, askFS, { capture: true, passive: true });
    });
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') askFS(); }, { capture: true, passive: true });
    // Sortie forcée par le navigateur (Échap) : on repropose au geste suivant, rien d'autre à faire.
    document.addEventListener('fullscreenchange', function () {
      if (inFS() && isTouch && screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(function () {});
      }
    });
  }

  // iPhone / iPad : pas d'API plein écran dans Safari. Le seul vrai plein écran est
  // l'application installée sur l'écran d'accueil (manifest en mode fullscreen).
  if (fsEnabled && isIOS && !reqFS) {
    var standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches);
    var hidden = false;
    try { hidden = localStorage.getItem('modIosHintHidden') === '1'; } catch (e) {}
    if (!standalone && !hidden) {
      document.addEventListener('DOMContentLoaded', function () {
        var b = document.createElement('div');
        b.setAttribute('style', 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:#111;color:#fff;font:14px/1.4 system-ui,sans-serif;padding:10px 12px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.5)');
        b.innerHTML = 'Plein écran sur iPhone/iPad : bouton <b>Partager</b> puis <b>Sur l’écran d’accueil</b>, et lance le jeu depuis l’icône. <span style="float:right;cursor:pointer;padding:0 6px">✕</span>';
        b.lastChild.addEventListener('click', function () { b.remove(); try { localStorage.setItem('modIosHintHidden', '1'); } catch (e) {} });
        document.body.appendChild(b);
      });
    }
  }

  // ------------------------------------------------------------------ 3. FPS ADAPTATIF
  // Distance de rendu ajustée en direct via window.options (proxy réactif du client).
  var FPS_LOW = 24, FPS_HIGH = 50, WINDOW_MS = 4000, COOLDOWN_MS = 10000;
  var hud = /[?&]hud=1/.test(q) ? null : false;

  function governor() {
    var opts = window.options;
    if (!opts) return;
    var frames = 0, t0 = performance.now(), lastChange = 0, goodStreak = 0;
    var el = null;
    if (hud === null) {
      el = document.createElement('div');
      el.setAttribute('style', 'position:fixed;top:4px;left:4px;z-index:2147483646;background:rgba(0,0,0,.55);color:#0f0;font:12px monospace;padding:2px 6px;border-radius:4px;pointer-events:none');
      document.body.appendChild(el);
    }
    function tick(now) {
      frames++;
      var dt = now - t0;
      if (dt >= WINDOW_MS) {
        var fps = Math.round(frames * 1000 / dt);
        frames = 0; t0 = now;
        var rd = Number(opts.renderDistance) || RD_START;
        var inGame = !!(window.miscUiState && window.miscUiState.gameLoaded) && !document.hidden;
        if (inGame && now - lastChange > COOLDOWN_MS) {
          if (fps < FPS_LOW && rd > RD_MIN) {
            opts.renderDistance = rd - 1; lastChange = now; goodStreak = 0;
            console.info(TAG, fps + ' FPS : distance de rendu ->', rd - 1);
          } else if (fps > FPS_HIGH && rd < RD_MAX) {
            if (++goodStreak >= 3) {
              opts.renderDistance = rd + 1; lastChange = now; goodStreak = 0;
              console.info(TAG, fps + ' FPS : distance de rendu ->', rd + 1);
            }
          } else { goodStreak = 0; }
        }
        if (el) el.textContent = fps + ' FPS · rendu ' + (opts.renderDistance) + ' · ' + tier;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    console.info(TAG, 'FPS adaptatif actif : rendu entre', RD_MIN, 'et', RD_MAX);
  }

  // window.options est créé par l'application après ce script : on attend qu'il existe.
  var tries = 0;
  var wait = setInterval(function () {
    if (window.options) { clearInterval(wait); governor(); }
    else if (++tries > 600) { clearInterval(wait); }   // 60 s : client non chargé
  }, 100);
})();
