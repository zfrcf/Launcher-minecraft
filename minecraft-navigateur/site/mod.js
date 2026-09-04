// Mod d'optimisation pour le client Minecraft navigateur (injecté dans <head> par build.js).
// Il joue, côté navigateur, le rôle des mods FPS du jeu officiel (Sodium, Entity Culling,
// Dynamic FPS…) qui ne peuvent pas s'exécuter ici : ce sont des mods Java.
//
// Blocs :
//  0. STOCKAGE INDISPONIBLE : si le navigateur refuse d'enregistrer des données (navigation privée
//     stricte, cookies bloqués), le client s'arrête sur une page vide sans un mot ; on affiche à la
//     place un écran qui explique quoi changer.
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
// Diagnostic : ?safe=1 retire tous les réglages du mod (retour aux valeurs par défaut du
// client), sans plein écran ni FPS adaptatif pour ce chargement. Le mod se réapplique au
// chargement normal suivant. Si DonutSMP charge en ?safe=1 et pas sans, le mod est en cause.
//
// Rien n'est envoyé nulle part : tout reste dans le navigateur du joueur.
(function () {
  'use strict';
  var TAG = '[mod-optimisation]';
  // Numéro des réglages. À incrémenter dès qu'un réglage change de valeur, sinon les joueurs qui
  // ont déjà chargé le site gardent l'ancien profil : la condition ci-dessous ne réapplique rien
  // tant que le numéro n'a pas bougé.
  // v7 : la détection d'écran tactile ne classe plus un PC à dalle tactile comme un téléphone.
  var SEED_VERSION = 8;
  // Dernière version pour laquelle ce client possède les données de blocs (et donc sait afficher
  // le monde) : 1.21.1, 1.21.3, 1.21.4, 1.21.5, 1.21.6, 1.21.8. Au-delà il se connecte mais
  // n'affiche rien. Voir le commentaire sur versionOverride plus bas.
  var VERSION_CLIENT = '1.21.8';
  var MARK = 'mwcSeedVersion';
  var q = location.search;
  // Un PC à dalle tactile a maxTouchPoints > 0 tout en ayant une souris : le prendre pour un
  // téléphone lui imposerait une distance de rendu deux fois plus courte et une interface géante.
  // On considère « tactile » un appareil sans survol possible et à pointeur grossier.
  function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }
  var isTouch = navigator.maxTouchPoints > 0 && mq('(pointer: coarse)') && !mq('(hover: hover)');
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

  // Toutes les clés de réglage que le mod touche (pour ?safe=1 et le nettoyage entre versions).
  var KEYS = ['gpuPreference', 'rendererMesher', 'rendererWorldPerformance', 'neighborChunkUpdates', 'keepChunksDistance',
    'renderDistance', 'smoothLighting', 'newVersionsLighting', 'dayCycleAndLighting', 'starfieldRendering', 'defaultSkybox',
    'disableBlockEntityTextures', 'loadPlayerSkins', 'renderEars', 'viewBobbing', 'vrSupport', 'displayBossBars', 'showMinimap',
    'renderDebug', 'fov', 'menuBackgroundMode', 'displayLoadingMessages', 'enableMusic', 'errorReporting', 'backgroundRendering',
    'preventBackgroundTimeoutKick', 'preventSleep', 'autoFullScreen', 'autoExitFullscreen', 'autoDisplayRotation', 'showHand', 'guiScale'];

  // Le client se sert du stockage local sans filet : si le navigateur le refuse (navigation privée
  // stricte, cookies et données de site bloqués), il s'arrête sur une page vide, sans un mot. On
  // teste d'abord, et on explique au joueur ce qu'il doit changer.
  function stockageUtilisable() {
    try { var t = '__test_mod__'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return true; }
    catch (e) { return false; }
  }

  function read(k) { try { var raw = localStorage.getItem(k); if (!raw) return null; var p = JSON.parse(raw); return (p && !Array.isArray(p) && p.data !== undefined) ? p.data : p; } catch (e) { return null; } }
  // Le client peut aussi stocker ces clés en cookie (prioritaire sur le stockage local quand il existe).
  // On efface le cookie du même nom pour que le stockage local fasse foi et qu'aucun « conflit de
  // stockage » ne soit signalé au joueur.
  function dropCookie(k) {
    try {
      var exp = '=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = k + exp;                       // cookie posé sur l'hôte lui-même
      // Puis chaque domaine parent : « a.b.vercel.app » donne « b.vercel.app », etc. Le navigateur
      // ignore ceux qu'il refuse (suffixes publics), il n'y a rien à deviner.
      var parts = location.hostname.split('.');
      for (var i = 1; i < parts.length - 1; i++) {
        document.cookie = k + exp + '; Domain=.' + parts.slice(i).join('.');
      }
    } catch (e) {}
  }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify({ data: v, timestamp: Date.now() })); dropCookie(k); } catch (e) {} }

  // ------------------------------------------------------------------ 0. STOCKAGE INDISPONIBLE
  if (!stockageUtilisable()) {
    console.warn(TAG, 'stockage local refusé par le navigateur : le client ne peut pas démarrer');
    var direBloque = function () {
      var b = document.createElement('div');
      b.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#0f1115;color:#e6e6e6;font:15px/1.55 system-ui,sans-serif;padding:28px 22px;overflow:auto');
      var h = document.createElement('h2'); h.textContent = 'Le jeu ne peut pas démarrer sur ce navigateur';
      h.setAttribute('style', 'margin:0 0 10px;font-size:20px');
      var p1 = document.createElement('p');
      p1.textContent = "Le navigateur refuse d'enregistrer des données pour ce site. Le jeu en a besoin pour retenir tes réglages et ta connexion : sans cela, il s'arrête sur une page vide.";
      var p2 = document.createElement('p'); p2.textContent = 'Que faire :';
      var ul = document.createElement('ul');
      ['Quitter la navigation privée et rouvrir le site dans une fenêtre normale.',
       'Autoriser les cookies et les données de site pour ce site (icône à gauche de l’adresse).',
       'Désactiver, pour ce site seulement, une extension qui bloque le stockage.'].forEach(function (t) {
        var li = document.createElement('li'); li.textContent = t; ul.appendChild(li);
      });
      var a = document.createElement('a'); a.href = './diagnostic'; a.textContent = 'Lancer le diagnostic';
      a.setAttribute('style', 'display:inline-block;margin-top:10px;padding:9px 14px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none');
      b.appendChild(h); b.appendChild(p1); b.appendChild(p2); b.appendChild(ul); b.appendChild(a);
      document.body.appendChild(b);
    };
    if (document.body) direBloque();
    else document.addEventListener('DOMContentLoaded', direBloque);
    return;
  }

  // ------------------------------------------------------------------ 0 bis. MODE SANS RISQUE
  if (/[?&]safe=1/.test(q)) {
    try {
      var clean = read('changedSettings') || {};
      KEYS.forEach(function (k) { delete clean[k]; });
      write('changedSettings', clean);
      // Le mode sans risque retire les RÉGLAGES du mod (ceux qui pourraient gêner l'affichage),
      // mais garde ce qui rend la connexion possible : la version et le compte Microsoft.
      //
      // Il effaçait les deux, au départ. Mesuré : sans version imposée, le client négocie avec le
      // serveur et retient la plus récente qu'il sait parler. Contre un serveur récent, il retient
      // 1.21.11 — qu'il ne sait pas afficher. Le mode « sans risque » provoquait donc lui-même
      // l'écran vide qu'il sert à écarter. Il force maintenant une version affichable.
      var l = read('serversList');
      if (Array.isArray(l)) {
        for (var j = 0; j < l.length; j++) {
          if (l[j] && String(l[j].ip).indexOf('donutsmp.net') === 0) {
            l[j].versionOverride = VERSION_CLIENT;
            l[j].authenticatedAccountOverride = true;
          }
        }
        write('serversList', l);
      }
      localStorage.removeItem(MARK);
      console.info(TAG, 'mode sans risque : réglages de performance retirés, plein écran et FPS adaptatif désactivés ; connexion maintenue en ' + VERSION_CLIENT);
    } catch (e) {}
    return;
  }

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
      // 1.21.8 et non 1.21.11 : ce client sait PARLER le protocole 1.21.11, mais il n'embarque
      // pas les données de blocs de cette version. Résultat mesuré sur un serveur local : la
      // connexion aboutit, puis l'écran reste bloqué sur « Loading world chunks 0 % » et rien ne
      // s'affiche jamais. Le même serveur en 1.21.8 charge 81 colonnes de chunks et affiche le
      // monde. DonutSMP annonce accepter de 1.7.2 à la dernière version, donc 1.21.8 passe.
      entry.versionOverride = VERSION_CLIENT;
      entry.authenticatedAccountOverride = true;
      delete entry.usernameOverride;
      entry.lastJoined = Date.now();
      write('serversList', list);

      var s = read('changedSettings');
      if (!s || typeof s !== 'object') s = {};
      // Moteur
      if (isTouch) delete s.gpuPreference;         // sur mobile : un seul GPU, on laisse le navigateur choisir
      else s.gpuPreference = 'high-performance';   // PC : carte graphique dédiée si l'appareil en a une
      s.rendererMesher = 'wasm';                   // géométrie compilée : le plus rapide
      s.rendererWorldPerformance = 'maximum';      // tous les threads pour les chunks
      delete s.neighborChunkUpdates;               // retiré en v6 : touche la génération des chunks
      s.keepChunksDistance = 0;                    // libère la mémoire des chunks lointains
      s.renderDistance = RD_START;
      // Rendu
      s.smoothLighting = false;
      s.newVersionsLighting = false;
      s.dayCycleAndLighting = false;
      s.starfieldRendering = false;
      delete s.defaultSkybox;                      // retiré en v6 : effet non prouvé
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
      delete s.displayLoadingMessages;             // les messages de chargement restent visibles : ils disent où ça bloque
      s.enableMusic = false;
      s.errorReporting = false;                    // pas de télémétrie en arrière-plan
      // Arrière-plan et veille
      s.backgroundRendering = '5fps';
      s.preventBackgroundTimeoutKick = true;
      delete s.preventSleep;                       // retiré en v6 : demande un verrou de veille pendant la connexion
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
    // La vraie fonction est conservée : ?fullscreen=0 la rétablit, et un dépannage reste possible
    // depuis la console avec document.__sortiePleinEcranReelle.call(document).
    var vraieSortie = document.exitFullscreen || document.webkitExitFullscreen;
    if (vraieSortie) document.__sortiePleinEcranReelle = vraieSortie;
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
    // Pas de verrou d'orientation ici : le client gère déjà la rotation (autoDisplayRotation).
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
  var hudDemande = /[?&]hud=1/.test(q);

  function governor() {
    var opts = window.options;
    if (!opts) return;
    var frames = 0, t0 = performance.now(), lastChange = 0, goodStreak = 0;
    var el = null;
    if (hudDemande && document.body) {
      el = document.createElement('div');
      el.setAttribute('style', 'position:fixed;top:4px;left:4px;z-index:2147483646;background:rgba(0,0,0,.55);color:#0f0;font:12px monospace;padding:2px 6px;border-radius:4px;pointer-events:none');
      document.body.appendChild(el);
    }
    function tick(now) {
      requestAnimationFrame(tick);   // replanifié d'abord : une erreur ci-dessous ne doit pas
                                     // arrêter la boucle pour le reste de la partie
      try {
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
        if (inGame) dejaEnJeu = true;
        surveillerCoupure();
        if (el) el.textContent = fps + ' FPS · rendu ' + (opts.renderDistance) + ' · ' + tier;
      }
      } catch (e) { if (!tick.__prevenu) { tick.__prevenu = true; console.warn(TAG, 'réglage automatique en difficulté :', e); } }
    }
    requestAnimationFrame(tick);
    console.info(TAG, 'FPS adaptatif actif : rendu entre', RD_MIN, 'et', RD_MAX);
  }

  // ------------------------------------------------------------------ 4. AIDE EN CAS D'ÉCHEC
  // Le client affiche ses erreurs en anglais et sans piste de solution. On intercepte son écran de
  // statut : sur une erreur, ou si le chargement dépasse 45 s, un bandeau en français propose la
  // marche à suivre et un lien vers /diagnostic (relais, serveur, carte graphique, état du mod).
  var LOADING_LIMIT_MS = 45000;
  var helpEl = null;
  function explain(msg, enJeu) {
    var m = String(msg || '');
    // Une fermeture de connexion AVANT d'être entré en jeu n'est pas une coupure réseau : c'est un
    // refus. Sur DonutSMP, la cause de loin la plus fréquente est le compte. Le message brut du
    // client (« WebSocket connection closed with unknown reason ») ne le dit pas.
    if (enJeu === false && /socket|closed|ECONN|refused|reset|unknown reason/i.test(m)) {
      return ['Le serveur a refusé la connexion.',
        'Tu n’es jamais entré en jeu : ce n’est pas une coupure réseau. Les trois causes, dans l’ordre : ton compte Microsoft n’est pas connecté ou n’a pas Minecraft ; le serveur refuse les connexions passant par un relais public ; le serveur est en maintenance ou saturé. Reconnecte ton compte, puis lance le diagnostic.'];
    }
    if (/proxy server|Connection setup error|most likely is down/i.test(m)) return ['Le relais public ne répond pas.', 'Le navigateur passe par un relais (proxy.mcraft.fun) pour joindre DonutSMP. Il est en panne, saturé ou bloqué par ton réseau. Réessaie dans quelques minutes, ou héberge ton propre relais (dossier minecraft-navigateur, gratuit sur Render).'];
    if (/encryption|auth|Microsoft|login|account|profile/i.test(m)) return ['Problème de compte Microsoft.', 'DonutSMP exige un compte Microsoft avec Minecraft. Reconnecte-toi (bouton compte dans la liste des serveurs), puis relance. Si tu as plusieurs comptes, vérifie que c’est le bon.'];
    if (/outdated|version|unsupported|protocol/i.test(m)) return ['Version refusée par le serveur.', 'Le client se connecte en ' + VERSION_CLIENT + '. Dans la liste des serveurs, modifie l’entrée DonutSMP et choisis une autre version acceptée par le serveur.'];
    if (/ProtocolError|Failed to load|socket|WebSocket|ECONNRESET/i.test(m)) return ['La connexion a été coupée en cours de partie.', 'Le lien avec le relais s’est interrompu : relais tombé, wifi ou 4G qui a lâché, ou mise en veille du téléphone. Reconnecte-toi ; si ça se répète, teste ton relais dans le diagnostic.'];
    if (/timed? ?out|ECONNREFUSED|ENOTFOUND|Failed to connect|Disconnected|closed|kick/i.test(m)) return ['Connexion au serveur interrompue.', 'DonutSMP est très chargé : file d’attente, anticheat qui coupe les connexions via relais, ou serveur en maintenance. Réessaie, puis lance le diagnostic si ça persiste.'];
    return ['Le jeu a rencontré une erreur.', m.slice(0, 200)];
  }
  function showHelp(title, detail, soft) {
    if (!document.body) return;
    if (helpEl) helpEl.remove();
    helpEl = document.createElement('div');
    helpEl.setAttribute('data-mod-aide', '1');
    helpEl.setAttribute('style', 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:' + (soft ? '#1f2937' : '#7f1d1d') + ';color:#fff;font:14px/1.45 system-ui,sans-serif;padding:12px 14px;border-radius:10px;box-shadow:0 2px 14px rgba(0,0,0,.6)');
    var b = document.createElement('b'); b.textContent = title;
    var p = document.createElement('div'); p.textContent = detail; p.style.margin = '4px 0 8px';
    var row = document.createElement('div');
    function btn(label, href) { var a = document.createElement('a'); a.textContent = label; a.href = href; a.setAttribute('style', 'display:inline-block;margin:0 8px 4px 0;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,.15);color:#fff;text-decoration:none'); return a; }
    row.appendChild(btn('Diagnostic', './diagnostic'));
    row.appendChild(btn('Réessayer', './?modal=serversList'));
    row.appendChild(btn('Mode sans risque', './?safe=1&modal=serversList'));
    var x = document.createElement('span'); x.textContent = '✕'; x.setAttribute('style', 'position:absolute;top:8px;right:12px;cursor:pointer;padding:0 4px');
    x.addEventListener('click', function () { helpEl.remove(); helpEl = null; });
    helpEl.appendChild(x); helpEl.appendChild(b); helpEl.appendChild(p); helpEl.appendChild(row);
    document.body.appendChild(helpEl);
  }
  function ressembleAUneErreur(m) {
    return /error|failed|exception|refused|timed? ?out|disconnect|kick|ECONN|ENOTFOUND/i.test(String(m || ''));
  }
  function inGameNow() { return !!(window.miscUiState && window.miscUiState.gameLoaded); }
  var loadTimer = null;

  // Coupure en cours de partie (relais qui tombe, wifi perdu, téléphone mis en veille).
  // Le client ne passe pas par l'écran de statut dans ce cas : il émet une fin de connexion sur son
  // objet de jeu, avec une raison. Constaté en test réel contre un serveur Minecraft : « socketClosed ».
  // Une déconnexion volontaire n'a pas cette raison : on ne dit donc rien dans ce cas.
  var botSurveille = null;
  function surveillerCoupure() {
    var bot = window.bot;
    if (!bot || bot === botSurveille || typeof bot.on !== 'function') return;
    botSurveille = bot;
    try {
      bot.on('end', function (raison) {
        var r = String(raison || '');
        if (!/socket|ECONN|closed|timeout|network/i.test(r)) return;   // départ volontaire : rien à signaler
        console.warn(TAG, 'connexion terminée :', r);
        showHelp('La connexion a été coupée en cours de partie.',
          'Le lien avec le relais s’est interrompu : relais tombé, wifi ou 4G qui a lâché, ou téléphone mis en veille. Reconnecte-toi ; si ça se répète, teste ton relais dans le diagnostic.', false);
      });
    } catch (e) {}
  }
  // Le client remplace toute la page par un écran « You have been disconnected from the server »,
  // en anglais, suivi de l'octet brut du dernier paquet reçu. Ce n'est pas un statut de chargement :
  // rien ne passait par hookStatus(), et le joueur restait devant un mur de texte incompréhensible.
  // Constaté en test réel contre un serveur exigeant un compte Microsoft.
  var ecranVu = false;
  // textContent ne force aucun recalcul de mise en page, contrairement à innerText. On s'en sert
  // comme pré-filtre : innerText n'est lu que dans les rares instants où la page contient
  // effectivement l'un des deux textes surveillés.
  function texteBrut() {
    try { return (document.body && document.body.textContent) || ''; } catch (e) { return ''; }
  }
  function surveillerEcranDeconnexion(brut) {
    if (ecranVu || !document.body) return;
    if (brut.indexOf('have been disconnected') === -1) return;
    var t = document.body.innerText || '';
    if (t.indexOf('have been disconnected') === -1) return;
    ecranVu = true;
    var raison = '';
    var m = t.match(/End reason:\s*([^]*?)(?:Last Server Packet|Last status|$)/);
    if (m) raison = m[1].replace(/\s+/g, ' ').trim().slice(0, 160);
    console.warn(TAG, 'écran de déconnexion du client :', raison);
    var ex = explain(raison, dejaEnJeu);
    showHelp(ex[0], ex[1] + (raison ? ' (message du client : ' + raison + ')' : ''), false);
  }
  // Mémorise si on est entré en jeu au moins une fois : c'est ce qui sépare « refusé à l'entrée »
  // de « coupé en cours de partie », et l'écran de déconnexion efface l'état du jeu.
  var dejaEnJeu = false;

  function hookStatus() {
    var orig = globalThis.setLoadingScreenStatus;
    if (typeof orig !== 'function' || orig.__mod) return false;
    var wrapped = function (status, isError) {
      try {
        if (typeof status === 'string' && status && (isError || ressembleAUneErreur(status))) {
          if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
          var ex = explain(status, inGameNow());
          console.warn(TAG, 'erreur du client :', status);
          showHelp(ex[0], ex[1], false);
        } else if (typeof status === 'string' && status && !inGameNow()) {
          if (helpEl && helpEl.__soft) { helpEl.remove(); helpEl = null; }
          if (!loadTimer) loadTimer = setTimeout(function () {
            loadTimer = null;
            if (!inGameNow() && !helpEl) { showHelp('Le chargement prend plus de 45 secondes.', 'Le relais public ou DonutSMP répond lentement à cet instant. Tu peux patienter, réessayer, ou lancer le diagnostic pour voir ce qui bloque.', true); if (helpEl) helpEl.__soft = true; }
          }, LOADING_LIMIT_MS);
        } else if (status === undefined && loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__mod = true;
    globalThis.setLoadingScreenStatus = wrapped;
    return true;
  }

  // Connecté, mais le monde ne s'affiche jamais. C'est la panne qui a coûté le plus cher : le jeu
  // se déclare chargé, le pseudo et le chat fonctionnent, et l'écran reste sur « Loading world
  // chunks 0 % » indéfiniment, sans le moindre message. Cause constatée : une version que le client
  // sait négocier mais dont il n'a pas les données de blocs. Le joueur n'a aucun moyen de le
  // deviner, donc on le lui dit.
  // Le bon signal est celui que le joueur a sous les yeux : l'indicateur « Loading world chunks »
  // du client, qui affiche le nombre de morceaux AFFICHÉS sur le nombre reçu. En 1.21.11 il reste
  // sur « 0 % (0 / 169) » : les morceaux arrivent bien par le réseau, c'est l'affichage qui ne sait
  // pas les construire. Compter les morceaux reçus côté réseau induirait en erreur — ils arrivent.
  var MONDE_VIDE_MS = 40000;    // au-delà, un écran encore vide n'est plus un chargement normal
  var GRACE_MS = 15000;         // avant, l'indicateur du client peut n'être pas encore apparu
  var depuisCharge = 0, mondeVu = false, mondeSignale = false;
  function indicateurChunks(brut) {
    if (brut.indexOf('Loading world chunks') === -1) return null;
    var t = document.body.innerText || '';
    var i = t.indexOf('Loading world chunks');
    if (i === -1) return null;
    var m = t.slice(i, i + 80).match(/(\d+)\s*%/);
    return m ? Number(m[1]) : null;
  }
  function surveillerMondeVide(brut) {
    if (mondeVu || mondeSignale) return;
    if (!inGameNow()) { depuisCharge = 0; return; }
    var maintenant = Date.now();
    if (!depuisCharge) { depuisCharge = maintenant; return; }
    var pct = indicateurChunks(brut);
    // Pas d'indicateur : le monde est affiché — mais seulement une fois passé le délai de grâce.
    // Conclure tout de suite laisserait passer un indicateur qui apparaît une seconde plus tard.
    if (pct === null) { if (maintenant - depuisCharge > GRACE_MS) mondeVu = true; return; }
    if (pct > 0) { mondeVu = true; return; }
    if (maintenant - depuisCharge < MONDE_VIDE_MS) return;
    mondeSignale = true;
    console.warn(TAG, 'en jeu depuis ' + Math.round((maintenant - depuisCharge) / 1000) + ' s, aucun morceau de terrain affiché');
    showHelp('Tu es connecté, mais le monde ne s’affiche pas.',
      'Le serveur t’accepte et le chat fonctionne, mais aucun morceau de terrain n’arrive. C’est presque toujours la version : ce client ne sait afficher que 1.21.1, 1.21.3, 1.21.4, 1.21.5, 1.21.6 et 1.21.8. Dans la liste des serveurs, mets l’entrée en ' + VERSION_CLIENT + ', ou clique « Réappliquer le mod ».', false);
  }

  // Surveillance indépendante de l'écran de déconnexion : elle ne dépend ni de window.options ni
  // de la boucle du régulateur, qui peuvent ne jamais démarrer si l'échec survient tôt. Un test de
  // chaîne toutes les 1,5 s est négligeable, et la surveillance s'arrête dès qu'elle a servi.
  var veille = setInterval(function () {
    var brut = texteBrut();
    try { surveillerEcranDeconnexion(brut); } catch (e) {}
    try { surveillerMondeVide(brut); } catch (e) {}
    if (ecranVu) clearInterval(veille);
  }, 1500);

  // window.options et setLoadingScreenStatus sont créés par l'application après ce script : on attend.
  var tries = 0, gotOptions = false, gotStatus = false;
  var wait = setInterval(function () {
    if (!gotOptions && window.options) { gotOptions = true; governor(); }
    // hookStatus() se remet en place tout seul si le client remplace la fonction entre-temps.
    hookStatus();
    if (++tries > 600) clearInterval(wait);   // 60 s : au-delà, le client ne se chargera plus
  }, 100);
})();
