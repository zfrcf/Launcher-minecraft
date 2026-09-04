// Boucle principale : rendu Three.js, chargement des chunks, entrées, réseau, HUD.
(function (MC) {
  'use strict';

  const UI = MC.UI;
  const CW = MC.CW;
  const REACH = 5.5;

  const G = {
    config: {}, net: null, world: null, player: null,
    scene: null, camera: null, renderer: null, materials: null,
    chunkMeshes: new Map(),
    others: new Map(),
    renderDist: 5,
    creative: false,
    inv: new Array(36).fill(null),
    creativeBar: [1, 2, 3, 4, 8, 9, 10, 12, 24],
    sel: 0,
    time: 0.2, dayLength: 20 * 60 * 1000, timeSyncAt: 0, timeAtSync: 0.2,
    breaking: null, breakHeld: false, lastCreativeBreak: 0,
    started: false, touch: false, pointerLocked: false, expectUnlock: false,
    lastPosSend: 0, lastFrame: 0, fps: 0, frames: 0, fpsAt: 0,
    spawn: { x: 0.5, y: 40, z: 0.5 },
    audio: null,
    sun: null, ambient: null, selectionBox: null,
    keys: {},
    svc: null, dirty: new Set(), hit: null,
    quality: 'auto', pixelRatio: 1, maxPixelRatio: 2, qualityCheckAt: 0,
    distMin: 2, distMax: 5, lowStreak: 0, goodStreak: 0, distChangedAt: 0
  };

  // ---------- Web Worker : génération + maillage hors du thread principal ----------
  // Le code du worker est embarqué (Blob) pour fonctionner quel que soit l'hébergement des scripts.
  const WORKER_SRC = `
    'use strict';
    self.window = self;
    let world = null;
    const reply = (msg, transfer) => self.postMessage(msg, transfer || []);
    self.onmessage = (e) => {
      const m = e.data;
      try {
        switch (m.t) {
          case 'init':
            importScripts.apply(self, m.scripts);
            world = new self.MC.World(m.seed);
            world.applyEdits(m.edits || []);
            reply({ t: 'ready' });
            break;
          case 'gen': {
            const c = world.ensureChunk(m.cx, m.cz);
            const groups = self.MC.meshChunk(world, c);
            c.dirty = false;
            const data = c.data.slice(0);
            reply({ t: 'chunk', cx: m.cx, cz: m.cz, data, groups }, [data.buffer].concat(self.MC.meshTransferables(groups)));
            break;
          }
          case 'mesh': {
            const c = world.getChunk(m.cx, m.cz);
            if (!c) { reply({ t: 'nomesh', cx: m.cx, cz: m.cz }); break; }
            const groups = self.MC.meshChunk(world, c);
            c.dirty = false;
            reply({ t: 'mesh', cx: m.cx, cz: m.cz, groups }, self.MC.meshTransferables(groups));
            break;
          }
          case 'set': world.setBlock(m.x, m.y, m.z, m.id); break;
          case 'sets': world.applyEdits(m.list); break;
          case 'unload': world.unloadChunk(m.cx, m.cz); break;
          default: break;
        }
      } catch (err) { reply({ t: 'error', msg: String((err && err.message) || err) }); }
    };
  `;

  // Service de chunks : version Worker (asynchrone) ou version synchrone de repli
  function createChunkService(seed, edits) {
    const scripts = window.MC_SCRIPTS;
    const canWorker = typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && scripts && scripts.noise && scripts.blocks && scripts.world && scripts.mesher;
    const inflight = new Set();
    if (!canWorker) {
      return {
        kind: 'sync', ready: true, inflight,
        gen(cx, cz) { const c = G.world.ensureChunk(cx, cz); remeshChunk(c); },
        mesh(chunk) { remeshChunk(chunk); },
        set() {}, sets() {}, unload() {}
      };
    }
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'application/javascript' }));
    const w = new Worker(url);
    const svc = {
      kind: 'worker', ready: false, inflight, worker: w,
      gen(cx, cz) { const k = MC.World.key(cx, cz); if (inflight.has(k)) return; inflight.add(k); w.postMessage({ t: 'gen', cx, cz }); },
      mesh(chunk) { const k = MC.World.key(chunk.cx, chunk.cz); if (inflight.has(k)) return; inflight.add(k); w.postMessage({ t: 'mesh', cx: chunk.cx, cz: chunk.cz }); },
      set(x, y, z, id) { w.postMessage({ t: 'set', x, y, z, id }); },
      sets(list) { if (list.length) w.postMessage({ t: 'sets', list }); },
      unload(cx, cz) { w.postMessage({ t: 'unload', cx, cz }); }
    };
    w.onmessage = (e) => {
      const m = e.data;
      const k = m.cx !== undefined ? MC.World.key(m.cx, m.cz) : null;
      if (k) inflight.delete(k);
      switch (m.t) {
        case 'ready': svc.ready = true; break;
        case 'chunk': { if (!G.world) break; const c = G.world.addChunk(m.cx, m.cz, m.data); applyMesh(c, m.groups); break; }
        case 'mesh': { if (!G.world) break; const c = G.world.getChunk(m.cx, m.cz); if (c) applyMesh(c, m.groups); break; }
        case 'error': console.warn('[worker]', m.msg); break;
        default: break;
      }
    };
    w.onerror = (err) => { console.warn('[worker] erreur, passage en mode synchrone', err.message); svc.kind = 'sync'; svc.ready = true; svc.gen = (cx, cz) => { const c = G.world.ensureChunk(cx, cz); remeshChunk(c); }; svc.mesh = (c) => remeshChunk(c); svc.set = svc.sets = svc.unload = () => {}; inflight.clear(); };
    w.postMessage({ t: 'init', scripts: [scripts.noise, scripts.blocks, scripts.world, scripts.mesher], seed, edits });
    return svc;
  }

  // ---------- Audio minimal (sons synthétisés) ----------
  function beep(freq, dur, type, vol) {
    try {
      if (!G.audio) G.audio = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = G.audio;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.05, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) { /* audio indisponible */ }
  }

  // ---------- Inventaire ----------
  function hotbarSlots() {
    if (G.creative) return G.creativeBar.map((id) => (id ? { id, qty: 1 } : null));
    return G.inv.slice(0, 9);
  }
  function selectedBlockId() {
    if (G.creative) return G.creativeBar[G.sel] || 0;
    const it = G.inv[G.sel];
    return it ? it.id : 0;
  }
  function addItem(id, qty) {
    if (!id) return;
    for (let i = 0; i < 36 && qty > 0; i++) {
      const it = G.inv[i];
      if (it && it.id === id && it.qty < 64) { const n = Math.min(64 - it.qty, qty); it.qty += n; qty -= n; }
    }
    for (let i = 0; i < 36 && qty > 0; i++) {
      if (!G.inv[i]) { const n = Math.min(64, qty); G.inv[i] = { id, qty: n }; qty -= n; }
    }
    refreshHotbar();
  }
  function countItem(id) { let n = 0; for (const it of G.inv) if (it && it.id === id) n += it.qty; return n; }
  function removeItem(id, qty) {
    for (let i = 35; i >= 0 && qty > 0; i--) {
      const it = G.inv[i];
      if (it && it.id === id) { const n = Math.min(it.qty, qty); it.qty -= n; qty -= n; if (it.qty <= 0) G.inv[i] = null; }
    }
    refreshHotbar();
  }
  function consumeSelected() {
    const it = G.inv[G.sel];
    if (!it) return;
    it.qty--; if (it.qty <= 0) G.inv[G.sel] = null;
    refreshHotbar();
  }
  function canCraft(r) { return r.in.every((i) => countItem(i[0]) >= i[1]); }
  function refreshHotbar() { UI.renderHotbar(hotbarSlots(), G.sel, G.creative); }
  function refreshInventory() { if (UI.isInventoryOpen()) UI.renderInventory({ creative: G.creative, inv: G.inv, hotbarSel: G.sel, canCraft }); }
  function giveStarterKit() {
    G.inv.fill(null);
    addItem(8, 32); addItem(9, 32); addItem(4, 12); addItem(10, 16); addItem(24, 6); addItem(2, 32);
  }

  // ---------- Three.js ----------
  function setupThree() {
    if (G.renderer) return;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    G.maxPixelRatio = Math.min(window.devicePixelRatio || 1, G.touch ? 1.5 : 2);
    applyQuality(true);
    renderer.setPixelRatio(G.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game').appendChild(renderer.domElement);
    G.renderer = renderer;
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1000);
    G.ambient = new THREE.AmbientLight(0xffffff, 0.9);
    G.sun = new THREE.DirectionalLight(0xffffff, 0.5);
    G.sun.position.set(60, 100, 30);
    G.scene.add(G.ambient, G.sun);
    G.scene.fog = new THREE.Fog(0x87ceeb, 40, 120);

    const tex = new THREE.CanvasTexture(G.atlas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    G.materials = {
      opaque: new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }),
      cutout: new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
      water: new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.68, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ map: tex, vertexColors: true })
    };

    const box = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    G.selectionBox = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
    G.selectionBox.visible = false;
    G.scene.add(G.selectionBox);

    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      G.camera.aspect = window.innerWidth / window.innerHeight;
      G.camera.updateProjectionMatrix();
    });
  }

  // Qualité d'affichage : résolution de rendu (auto = adaptée aux FPS mesurés)
  function applyQuality(initial) {
    const q = G.quality;
    if (q === 'low') G.pixelRatio = Math.min(0.6, G.maxPixelRatio);
    else if (q === 'medium') G.pixelRatio = Math.min(1, G.maxPixelRatio);
    else if (q === 'high') G.pixelRatio = G.maxPixelRatio;
    else if (initial) G.pixelRatio = Math.min(G.touch ? 0.85 : 1, G.maxPixelRatio);
    if (G.renderer && !initial) G.renderer.setPixelRatio(G.pixelRatio);
  }
  function adaptQuality(now) {
    if (G.quality !== 'auto' || now - G.qualityCheckAt < 2000) return;
    G.qualityCheckAt = now;
    let r = G.pixelRatio;
    if (G.fps < 28) r = Math.max(0.5, r - 0.15);
    else if (G.fps > 56) r = Math.min(G.maxPixelRatio, r + 0.1);
    if (Math.abs(r - G.pixelRatio) > 0.01) { G.pixelRatio = r; G.renderer.setPixelRatio(r); }
    adaptDistance(now, r);
  }

  // Second levier, quand la résolution est déjà au plancher : la distance de rendu. Elle est relue
  // à chaque image par updateChunks et par le brouillard, donc modifiable à chaud. On descend après
  // 3 mesures basses d'affilée et on remonte après 5 mesures confortables, avec 8 s entre deux
  // changements : assez lent pour ne pas faire clignoter le paysage.
  function adaptDistance(now, ratio) {
    if (G.quality !== 'auto') return;
    const floor = ratio <= 0.51;
    if (G.fps < 25 && floor) { G.lowStreak++; G.goodStreak = 0; }
    else if (G.fps > 52) { G.goodStreak++; G.lowStreak = 0; }
    else { G.lowStreak = 0; G.goodStreak = 0; }
    if (now - G.distChangedAt < 8000) return;
    if (G.lowStreak >= 3 && G.renderDist > G.distMin) {
      G.renderDist--; G.lowStreak = 0; G.distChangedAt = now;
      UI.toast('Distance de rendu réduite à ' + G.renderDist + ' (image plus fluide)');
    } else if (G.goodStreak >= 5 && G.renderDist < G.distMax) {
      G.renderDist++; G.goodStreak = 0; G.distChangedAt = now;
    }
  }

  function buildGeometry(g) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(g.norm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(g.col, 3));
    geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
    return geo;
  }

  function disposeChunkMesh(key) {
    const entry = G.chunkMeshes.get(key);
    if (!entry) return;
    entry.meshes.forEach((m) => { G.scene.remove(m); m.geometry.dispose(); });
    G.chunkMeshes.delete(key);
  }

  function remeshChunk(chunk) {
    chunk.dirty = false;
    G.dirty.delete(chunk);
    applyMesh(chunk, MC.meshChunk(G.world, chunk));
  }

  // Construit les maillages Three.js d'un chunk à partir des tampons du mailleur
  function applyMesh(chunk, groups) {
    const key = MC.World.key(chunk.cx, chunk.cz);
    disposeChunkMesh(key);
    const meshes = [];
    for (const name of ['opaque', 'cutout', 'glow', 'water']) {
      const g = groups[name];
      if (!g.idx.length) continue;
      const mesh = new THREE.Mesh(buildGeometry(g), G.materials[name]);
      mesh.frustumCulled = true;
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = name === 'water' ? 2 : 0;
      G.scene.add(mesh);
      meshes.push(mesh);
    }
    G.chunkMeshes.set(key, { meshes });
  }

  function updateChunks() {
    const p = G.player.pos;
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
    const R = G.renderDist;
    const svc = G.svc;
    const async = svc.kind === 'worker';
    if (!svc.ready) return;
    // 1. chunks à générer (les plus proches d'abord), avec un plafond de requêtes en vol
    if (G.frames % 4 === 0 || !async) {
      const toGen = [];
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dz * dz > R * R + 1) continue;
        const cx = pcx + dx, cz = pcz + dz;
        if (!G.world.getChunk(cx, cz) && !svc.inflight.has(MC.World.key(cx, cz))) toGen.push([cx, cz, dx * dx + dz * dz]);
      }
      toGen.sort((a, b) => a[2] - b[2]);
      const max = async ? Math.max(0, 6 - svc.inflight.size) : 1;
      for (let i = 0; i < toGen.length && i < max; i++) svc.gen(toGen[i][0], toGen[i][1]);
    }
    // 2. chunks à (re)mailler : ensemble maintenu par le monde, pas de balayage complet
    if (G.dirty.size) {
      const list = [];
      for (const c of G.dirty) {
        if (!G.world.getChunk(c.cx, c.cz)) { G.dirty.delete(c); continue; }
        const dx = c.cx - pcx, dz = c.cz - pcz;
        list.push([c, dx * dx + dz * dz]);
      }
      list.sort((a, b) => a[1] - b[1]);
      const t1 = performance.now();
      let n = 0;
      for (const [c, d] of list) {
        if (d > (R + 1) * (R + 1)) break;
        if (async) {
          if (svc.inflight.has(MC.World.key(c.cx, c.cz))) continue;
          G.dirty.delete(c); c.dirty = false;
          svc.mesh(c);
          if (++n >= 4) break;
        } else {
          remeshChunk(c);
          if (++n >= 2 || performance.now() - t1 > 6) break;
        }
      }
    }
    // 3. déchargement des chunks lointains
    if (G.frames % 60 === 0) {
      for (const c of Array.from(G.world.chunks.values())) {
        const dx = c.cx - pcx, dz = c.cz - pcz;
        if (dx * dx + dz * dz > (R + 3) * (R + 3)) { disposeChunkMesh(MC.World.key(c.cx, c.cz)); G.world.unloadChunk(c.cx, c.cz); G.dirty.delete(c); svc.unload(c.cx, c.cz); }
      }
    }
  }

  // ---------- Autres joueurs ----------
  function makePlayerMesh(name) {
    const grp = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0x3b8ed0 });
    const legs = new THREE.MeshLambertMaterial({ color: 0x2f4f8f });
    const head = new THREE.MeshLambertMaterial({ color: 0xe0ac7e });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), skin); body.position.y = 1.1;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), legs); leg.position.y = 0.375;
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), head); hd.position.y = 1.72;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), skin); armL.position.set(-0.36, 1.12, 0);
    const armR = armL.clone(); armR.position.x = 0.36;
    grp.add(body, leg, hd, armL, armR);
    // Étiquette du pseudo
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 36px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sprite.scale.set(1.6, 0.4, 1); sprite.position.y = 2.25;
    grp.add(sprite);
    grp.userData.head = hd;
    return grp;
  }
  function addOther(p) {
    if (G.others.has(p.id)) return;
    const mesh = makePlayerMesh(p.name || '?');
    mesh.position.set(p.x || 0, p.y || 0, p.z || 0);
    G.scene.add(mesh);
    G.others.set(p.id, { name: p.name, mesh, target: { x: p.x || 0, y: p.y || 0, z: p.z || 0, yaw: p.yaw || 0, pitch: p.pitch || 0 } });
  }
  function removeOther(id) {
    const o = G.others.get(id);
    if (!o) return;
    G.scene.remove(o.mesh);
    G.others.delete(id);
  }
  function updateOthers(dt) {
    const k = Math.min(1, dt * 12);
    for (const o of G.others.values()) {
      const m = o.mesh, t = o.target;
      m.position.x += (t.x - m.position.x) * k;
      m.position.y += (t.y - m.position.y) * k;
      m.position.z += (t.z - m.position.z) * k;
      m.rotation.y = t.yaw;
      m.userData.head.rotation.x = -t.pitch;
    }
  }

  // ---------- Réseau ----------
  function setupNet(opts) {
    const net = new MC.Net();
    G.net = net;
    net.on('welcome', (m) => onWelcome(m, opts));
    net.on('join', (m) => addOther(m));
    net.on('leave', (m) => removeOther(m.id));
    net.on('pos', (m) => { const o = G.others.get(m.id); if (o) { o.target = { x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: m.pitch }; } else addOther(m); });
    net.on('set', (m) => {
      if (!G.world) return;
      G.world.applyEdits([[m.x, m.y, m.z, m.id]]);
      G.svc.sets([[m.x, m.y, m.z, m.id]]);
      if (m.id === 0) G.world.settleGravity(m.x, m.y, m.z);
    });
    net.on('chat', (m) => UI.addChat(m.from, m.msg, !!m.sys));
    net.on('error', (m) => { if (m.fatal || !G.started) { G.fatalError = m.msg; if (G.started) UI.showDisconnect(m.msg); } else UI.toast(m.msg, 3000); });
    net.on('disconnect', (m) => { if (G.started) UI.showDisconnect(m.msg || 'Connexion perdue'); });
    net.on('netwarn', (m) => UI.toast(m.msg, 3000));
    net.on('pong', (m) => syncTime(m.time));
    return net;
  }

  function syncTime(t) { G.timeAtSync = t; G.timeSyncAt = performance.now(); }
  function currentTime() { return (G.timeAtSync + (performance.now() - G.timeSyncAt) / G.dayLength) % 1; }

  function onWelcome(m, opts) {
    if (G.started) return;
    G.world = new MC.World(m.seed);
    G.world.applyEdits(m.edits || []);
    G.world.onChunkDirty = (c) => G.dirty.add(c);
    G.svc = createChunkService(m.seed, m.edits || []);
    G.world.onBlockSet = (x, y, z, id) => G.svc.set(x, y, z, id);
    G.dayLength = m.dayLength || G.dayLength;
    syncTime(m.time || 0.2);
    G.player = new MC.Player(G.world);
    G.player.mode = G.creative ? 'creative' : 'survival';
    G.player.autoJump = G.touch;
    G.spawn = G.world.findSpawnColumn();
    G.player.teleport(G.spawn.x, G.spawn.y, G.spawn.z);
    (m.players || []).forEach(addOther);
    G.started = true;
    UI.hideStart();
    if (G.net.mode === 'host') UI.setRoomInfo('Code de la partie : ' + G.net.roomCode + ' (toucher pour copier)');
    else if (G.net.mode === 'join') UI.setRoomInfo('Partie ' + G.net.roomCode);
    else if (G.net.mode === 'ws') UI.setRoomInfo('Serveur dédié');
    UI.addChat('', 'Bienvenue ' + m.name + ' ! Graine du monde : ' + m.seed, true);
    if (!G.creative) giveStarterKit(); else refreshHotbar();
    if (G.touch) MC.Touch.init(document.getElementById('touch-layer'), G.player, touchCallbacks());
    MC.Touch.setMode(G.player.mode);
    G.lastFrame = performance.now();
    requestAnimationFrame(loop);
    setInterval(() => G.net.send({ t: 'ping' }), 30000);
    if (G.welcomeResolve) G.welcomeResolve();
  }

  // ---------- Interactions blocs ----------
  function targetBlock() {
    if (!G.player) return null;
    return MC.raycast(G.world, G.player.eye, G.player.direction(), REACH, false);
  }

  function setBlockNet(x, y, z, id) {
    if (!G.world.setBlock(x, y, z, id)) return;
    G.net.send({ t: 'set', x, y, z, id });
  }

  function placeBlock() {
    const hit = targetBlock();
    if (!hit) return;
    const id = selectedBlockId();
    if (!id) { UI.toast('Aucun bloc sélectionné'); return; }
    const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (y < 1 || y >= MC.CH) return;
    const cur = G.world.getBlock(x, y, z);
    if (cur !== 0 && cur !== 7) return;
    if (MC.isSolid(id) && G.player.intersectsBlock(x, y, z)) return;
    for (const o of G.others.values()) {
      const p = o.mesh.position;
      if (MC.isSolid(id) && x + 1 > p.x - 0.3 && x < p.x + 0.3 && y + 1 > p.y && y < p.y + 1.8 && z + 1 > p.z - 0.3 && z < p.z + 0.3) return;
    }
    setBlockNet(x, y, z, id);
    if (!G.creative) consumeSelected();
    beep(320, 0.08, 'triangle', 0.06);
    const b = MC.BLOCKS[id];
    if (b.gravity) { const ch = G.world.settleGravity(x, y - 1, z); ch.forEach((c) => G.net.send({ t: 'set', x: c[0], y: c[1], z: c[2], id: c[3] })); }
  }

  function breakBlockAt(hit) {
    const b = MC.BLOCKS[hit.id];
    if (!b || b.hardness < 0) { UI.toast('Bloc incassable'); return; }
    setBlockNet(hit.x, hit.y, hit.z, 0);
    if (!G.creative && b.drop) addItem(b.drop, 1);
    beep(140 + Math.random() * 40, 0.12, 'square', 0.05);
    const ch = G.world.settleGravity(hit.x, hit.y, hit.z);
    ch.forEach((c) => G.net.send({ t: 'set', x: c[0], y: c[1], z: c[2], id: c[3] }));
  }

  function updateBreaking(dt) {
    if (!G.breakHeld) { G.breaking = null; UI.setBreakProgress(0); return; }
    const hit = G.hit;
    if (!hit) { G.breaking = null; UI.setBreakProgress(0); return; }
    if (G.creative) {
      const now = performance.now();
      if (now - G.lastCreativeBreak > 220) { breakBlockAt(hit); G.lastCreativeBreak = now; }
      return;
    }
    const b = MC.BLOCKS[hit.id];
    if (!G.breaking || G.breaking.x !== hit.x || G.breaking.y !== hit.y || G.breaking.z !== hit.z) G.breaking = { x: hit.x, y: hit.y, z: hit.z, p: 0 };
    if (b.hardness < 0) { UI.setBreakProgress(0); return; }
    G.breaking.p += dt / Math.max(0.15, b.hardness * (G.player.inWater ? 3 : 1));
    UI.setBreakProgress(G.breaking.p);
    if (G.breaking.p >= 1) { breakBlockAt(hit); G.breaking = null; UI.setBreakProgress(0); }
  }

  function pickBlock() {
    const hit = targetBlock();
    if (!hit || !G.creative) return;
    G.creativeBar[G.sel] = hit.id;
    refreshHotbar();
  }

  // ---------- Entrées PC ----------
  function inMenu() { return UI.isPaused() || UI.isInventoryOpen() || UI.isChatOpen() || !G.started; }

  function requestLock() {
    if (G.touch || !G.renderer) return;
    const el = G.renderer.domElement;
    if (el.requestPointerLock) el.requestPointerLock();
  }

  function setupInput() {
    const canvas = G.renderer.domElement;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (!G.started || G.touch) return;
      if (inMenu()) return;
      if (!G.pointerLocked) { requestLock(); return; }
      if (e.button === 0) { G.breakHeld = true; if (G.creative) { G.lastCreativeBreak = 0; } }
      else if (e.button === 2) placeBlock();
      else if (e.button === 1) pickBlock();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) G.breakHeld = false; });
    document.addEventListener('pointerlockchange', () => {
      G.pointerLocked = document.pointerLockElement === canvas;
      if (!G.pointerLocked) {
        G.breakHeld = false;
        if (G.expectUnlock) { G.expectUnlock = false; return; }
        if (G.started && !UI.isInventoryOpen() && !UI.isChatOpen()) openPause();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (!G.pointerLocked || !G.player || inMenu()) return;
      look(e.movementX * 0.0022, e.movementY * 0.0022);
    });
    window.addEventListener('wheel', (e) => {
      if (inMenu()) return;
      G.sel = (G.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      refreshHotbar();
    }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (!G.started) return;
      if (UI.isChatOpen()) return;
      const inp = G.player.input;
      switch (e.code) {
        case 'KeyW': case 'KeyZ': case 'ArrowUp': inp.forward = true; break;
        case 'KeyS': case 'ArrowDown': inp.back = true; break;
        case 'KeyA': case 'KeyQ': case 'ArrowLeft': inp.left = true; break;
        case 'KeyD': case 'ArrowRight': inp.right = true; break;
        case 'Space': inp.jump = true; e.preventDefault(); break;
        case 'ShiftLeft': case 'ShiftRight': inp.sneak = true; break;
        case 'ControlLeft': case 'ControlRight': inp.sprint = true; e.preventDefault(); break;
        case 'KeyE': toggleInventory(); break;
        case 'KeyT': case 'Slash': if (!inMenu()) { e.preventDefault(); openChat(e.code === 'Slash' ? '/' : ''); } break;
        case 'F3': e.preventDefault(); UI.toggleDebug(); break;
        case 'Escape': if (UI.isInventoryOpen()) closeInventory(); else if (UI.isPaused()) resume(); else if (G.touch || G.pointerLocked) openPause(); break;
        default:
          if (e.code.startsWith('Digit')) { const n = parseInt(e.code.slice(5), 10); if (n >= 1 && n <= 9) { G.sel = n - 1; refreshHotbar(); refreshInventory(); } }
      }
    });
    window.addEventListener('keyup', (e) => {
      if (!G.player) return;
      const inp = G.player.input;
      switch (e.code) {
        case 'KeyW': case 'KeyZ': case 'ArrowUp': inp.forward = false; break;
        case 'KeyS': case 'ArrowDown': inp.back = false; break;
        case 'KeyA': case 'KeyQ': case 'ArrowLeft': inp.left = false; break;
        case 'KeyD': case 'ArrowRight': inp.right = false; break;
        case 'Space': inp.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': inp.sneak = false; break;
        case 'ControlLeft': case 'ControlRight': inp.sprint = false; break;
        default: break;
      }
    });
    window.addEventListener('blur', () => { if (G.player) { const i = G.player.input; i.forward = i.back = i.left = i.right = i.jump = i.sneak = i.sprint = false; } G.breakHeld = false; });
  }

  function look(dx, dy) {
    const p = G.player;
    p.yaw -= dx;
    p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch - dy));
  }

  function touchCallbacks() {
    return {
      look: (dx, dy) => { if (!inMenu()) look(dx, dy); },
      place: () => { if (!inMenu()) placeBlock(); },
      breakStart: () => { if (!inMenu()) { G.breakHeld = true; G.lastCreativeBreak = 0; } },
      breakEnd: () => { G.breakHeld = false; },
      inventory: () => toggleInventory(),
      chat: () => { if (!inMenu()) openChat(''); },
      pause: () => { if (UI.isPaused()) resume(); else openPause(); }
    };
  }

  // ---------- Menus ----------
  function openPause() {
    if (!G.started) return;
    G.breakHeld = false;
    const modeName = G.net.mode === 'offline' ? 'Solo (sauvegardé dans ce navigateur)' : G.net.mode === 'host' ? 'Hébergement — code : ' + G.net.roomCode : G.net.mode === 'join' ? 'Partie ' + G.net.roomCode : 'Serveur dédié';
    const players = 1 + G.others.size;
    UI.showPause({ text: modeName + '\n' + players + ' joueur' + (players > 1 ? 's' : '') + ' en ligne · graine ' + G.world.seed, mode: G.player.mode, roomCode: G.net.mode === 'host' ? G.net.roomCode : '' });
    if (G.pointerLocked) { G.expectUnlock = true; document.exitPointerLock(); }
  }
  function resume() {
    UI.hidePause();
    // Chrome annule un verrouillage du pointeur demandé pendant la transition vers le plein écran :
    // sans cette attente, la souris n'est plus captée après une reprise et la visée ne répond plus.
    if (MC.Fullscreen) { const p = MC.Fullscreen.enter(); if (p && p.then) { p.then(requestLock, requestLock); return; } }
    requestLock();
  }
  function toggleInventory() {
    if (UI.isPaused()) return;
    if (UI.isInventoryOpen()) closeInventory(); else openInventory();
  }
  function openInventory() {
    G.breakHeld = false;
    UI.renderInventory({ creative: G.creative, inv: G.inv, hotbarSel: G.sel, canCraft });
    UI.openInventory();
    if (G.pointerLocked) { G.expectUnlock = true; document.exitPointerLock(); }
  }
  function closeInventory() { UI.closeInventory(); requestLock(); }
  function openChat(prefix) {
    G.breakHeld = false;
    UI.openChat();
    if (prefix) document.getElementById('chat-input').value = prefix;
    if (G.pointerLocked) { G.expectUnlock = true; document.exitPointerLock(); }
  }

  function toggleMode() {
    G.creative = !G.creative;
    G.player.mode = G.creative ? 'creative' : 'survival';
    if (!G.creative) G.player.flying = false;
    MC.Touch.setMode(G.player.mode);
    refreshHotbar();
    UI.showPause({ text: 'Mode ' + (G.creative ? 'créatif' : 'survie') + ' activé', mode: G.player.mode, roomCode: G.net.mode === 'host' ? G.net.roomCode : '' });
  }

  function handleChatCommand(text) {
    const parts = text.slice(1).split(/\s+/);
    switch (parts[0]) {
      case 'creatif': case 'creative': if (!G.creative) toggleMode(); UI.hidePause(); UI.addChat('', 'Mode créatif', true); break;
      case 'survie': case 'survival': if (G.creative) toggleMode(); UI.hidePause(); UI.addChat('', 'Mode survie', true); break;
      case 'tp': { const x = +parts[1], y = +parts[2], z = +parts[3]; if ([x, y, z].every(Number.isFinite)) G.player.teleport(x, y, z); break; }
      case 'spawn': G.player.teleport(G.spawn.x, G.spawn.y, G.spawn.z); break;
      case 'give': { const id = +parts[1] | 0, q = +(parts[2] || 1); if (MC.BLOCKS[id] && id) addItem(id, q); break; }
      case 'jour': case 'day': syncTime(0.25); break;
      case 'nuit': case 'night': syncTime(0.75); break;
      case 'aide': case 'help': UI.addChat('', 'Commandes : /creatif /survie /tp x y z /spawn /give id qté /jour /nuit', true); break;
      default: UI.addChat('', 'Commande inconnue : ' + parts[0] + ' (tape /aide)', true);
    }
  }

  // ---------- Boucle ----------
  const SKY = { night: new THREE.Color(0x070a18), day: new THREE.Color(0x87ceeb), dusk: new THREE.Color(0xe8905a), water: new THREE.Color(0x1d4a9c), tmp: new THREE.Color() };
  function updateSky() {
    const t = currentTime();
    G.time = t;
    const elev = Math.sin(t * Math.PI * 2);
    const day = Math.max(0, Math.min(1, elev * 1.6 + 0.5));
    const sky = SKY.tmp.copy(SKY.night).lerp(SKY.day, day);
    const duskAmount = Math.max(0, 1 - Math.abs(elev) * 4) * 0.6;
    sky.lerp(SKY.dusk, duskAmount);
    if (G.player.headInWater) { sky.copy(SKY.water); G.scene.fog.near = 2; G.scene.fog.far = 18; }
    else { G.scene.fog.near = G.renderDist * CW * 0.55; G.scene.fog.far = G.renderDist * CW * 0.95; }
    G.scene.fog.color.copy(sky);
    G.renderer.setClearColor(sky);
    G.ambient.intensity = 0.28 + 0.62 * day;
    G.sun.intensity = 0.55 * day;
    const a = t * Math.PI * 2;
    G.sun.position.set(Math.cos(a) * 100, Math.sin(a) * 100, 40);
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - G.lastFrame) / 1000);
    G.lastFrame = now;
    G.frames++;
    if (now - G.fpsAt > 1000) { G.fps = G.frames; G.frames = 0; G.fpsAt = now; }
    if (!G.player) return;

    if (inMenu()) { const i = G.player.input; i.forward = i.back = i.left = i.right = i.jump = i.sneak = i.sprint = false; if (!G.touch) { i.ax = 0; i.az = 0; } }
    updateChunks();
    adaptQuality(now);
    // physique uniquement si le chunk du joueur est chargé
    const pc = G.world.getChunk(Math.floor(G.player.pos.x) >> 4, Math.floor(G.player.pos.z) >> 4);
    if (pc) { const steps = Math.max(1, Math.ceil(dt / 0.034)); for (let i = 0; i < steps; i++) G.player.update(dt / steps); }
    G.hit = targetBlock();
    updateBreaking(dt);
    updateOthers(dt);

    // caméra
    const eye = G.player.eye;
    G.camera.position.set(eye.x, eye.y, eye.z);
    G.camera.rotation.set(0, 0, 0);
    G.camera.rotation.order = 'YXZ';
    G.camera.rotation.y = G.player.yaw;
    G.camera.rotation.x = G.player.pitch;

    // sélection
    const hit = G.hit;
    if (hit && !inMenu()) { G.selectionBox.visible = true; G.selectionBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); }
    else G.selectionBox.visible = false;

    // réseau : position
    if (now - G.lastPosSend > 100) {
      G.lastPosSend = now;
      const p = G.player;
      const moved = !G.lastSent || Math.abs(G.lastSent.x - p.pos.x) > 0.01 || Math.abs(G.lastSent.y - p.pos.y) > 0.01 || Math.abs(G.lastSent.z - p.pos.z) > 0.01 || Math.abs(G.lastSent.yaw - p.yaw) > 0.01 || Math.abs(G.lastSent.pitch - p.pitch) > 0.01;
      if (moved) {
        G.lastSent = { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch };
        G.net.send({ t: 'pos', x: +p.pos.x.toFixed(3), y: +p.pos.y.toFixed(3), z: +p.pos.z.toFixed(3), yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3), sneak: p.input.sneak });
      }
    }

    updateSky();
    G.renderer.render(G.scene, G.camera);

    if (G.frames % 10 === 0 && !document.getElementById('debug').hidden) {
      const p = G.player.pos;
      const h = Math.floor(G.time * 24 + 6) % 24;
      UI.setDebug('FPS ' + G.fps + '\nXYZ ' + p.x.toFixed(1) + ' / ' + p.y.toFixed(1) + ' / ' + p.z.toFixed(1) +
        '\nChunks ' + G.world.chunks.size + ' · maillés ' + G.chunkMeshes.size + '\nHeure ' + h + 'h · ' + (G.player.flying ? 'vol' : G.player.onGround ? 'sol' : 'air') + (G.player.inWater ? ' · eau' : '') +
        '\nJoueurs ' + (1 + G.others.size) + ' · mode ' + G.net.mode + '\nRendu x' + G.pixelRatio.toFixed(2) + ' · ' + (G.svc.kind === 'worker' ? 'worker' : 'sync') + ' · en vol ' + G.svc.inflight.size + (hit ? '\nVisée ' + MC.BLOCKS[hit.id].name + ' (' + hit.x + ',' + hit.y + ',' + hit.z + ')' : ''));
    }
  }

  // ---------- Démarrage ----------
  async function play(opts) {
    if (MC.Fullscreen) MC.Fullscreen.enter();
    G.creative = opts.gamemode === 'creative';
    G.renderDist = opts.dist;
    G.distMax = opts.dist;
    G.distMin = Math.min(2, opts.dist);
    G.lowStreak = 0; G.goodStreak = 0; G.distChangedAt = 0;
    G.quality = opts.quality || 'auto';
    G.touch = MC.Touch.detect();
    const auth = MC.Auth;
    if (auth.available) {
      if (!auth.account && (G.config.requireLogin || opts.mode === 'ws' && !opts.password)) throw new Error('Connecte-toi avec ton compte Microsoft pour jouer.');
      if (auth.account && !auth.isAllowed()) throw new Error('Ce compte Microsoft n\'est pas dans la liste autorisée.');
      if (auth.account && opts.mode === 'ws') { try { opts.token = await auth.getIdToken(); } catch (e) { throw new Error('Impossible d\'obtenir le jeton Microsoft : ' + e.message); } }
    }
    if (opts.mode === 'ws' && !opts.url && G.config.wsUrl) opts.url = G.config.wsUrl;
    if (opts.mode === 'ws' && !opts.url && !G.config.dedicated) throw new Error('Indique l\'adresse du serveur dédié (wss://…/ws).');
    beep(440, 0.05, 'sine', 0.02);
    setupThree();
    if (!G.inputReady) { setupInput(); G.inputReady = true; }
    const net = setupNet(opts);
    await net.connect(opts);
    await new Promise((resolve, reject) => {
      G.welcomeResolve = resolve;
      const timer = setTimeout(() => reject(new Error(G.fatalError || 'Pas de réponse de l\'hôte (délai dépassé)')), 12000);
      const check = setInterval(() => { if (G.fatalError) { clearInterval(check); clearTimeout(timer); reject(new Error(G.fatalError)); } if (G.started) { clearInterval(check); clearTimeout(timer); } }, 100);
    });
    if (!G.touch) setTimeout(requestLock, 0);   // après la transition plein écran (voir resume())
  }

  async function boot() {
    try {
      const r = await fetch('api/config', { cache: 'no-store' });
      if (r.ok) G.config = await r.json();
    } catch (e) { G.config = {}; }
    G.atlas = MC.createAtlasCanvas();
    if (MC.Fullscreen) MC.Fullscreen.init();
    UI.init(G.atlas, {
      play,
      login: async () => { try { await MC.Auth.login(); refreshAuth(); } catch (e) { UI.showStartError('Connexion Microsoft impossible : ' + (e.errorMessage || e.message)); } },
      logout: async () => { await MC.Auth.logout(); refreshAuth(); },
      defaultWsUrl: () => G.config.wsUrl || (G.config.dedicated ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws' : ''),
      selectSlot: (i) => { G.sel = i; refreshHotbar(); refreshInventory(); },
      creativePick: (id) => { G.creativeBar[G.sel] = id; refreshHotbar(); UI.toast(MC.BLOCKS[id].name); },
      invClick: (i) => {
        if (i === G.sel) return;
        const tmp = G.inv[i]; G.inv[i] = G.inv[G.sel]; G.inv[G.sel] = tmp;
        refreshHotbar(); refreshInventory();
      },
      craft: (idx) => {
        const r = MC.RECIPES[idx];
        if (!canCraft(r)) return;
        r.in.forEach((i) => removeItem(i[0], i[1]));
        addItem(r.out[0], r.out[1]);
        beep(660, 0.08, 'triangle', 0.05);
        refreshInventory();
      },
      closeInventory,
      resume, toggleMode,
      copyCode: () => { const code = G.net && G.net.roomCode; if (!code) return; navigator.clipboard && navigator.clipboard.writeText(code).then(() => UI.toast('Code copié : ' + code), () => UI.toast('Code : ' + code, 4000)); },
      respawn: () => { G.player.teleport(G.spawn.x, G.spawn.y, G.spawn.z); resume(); },
      chat: (text) => { if (text.startsWith('/')) handleChatCommand(text); else G.net.send({ t: 'chat', msg: text }); },
      chatClosed: () => { if (G.started && !G.touch) requestLock(); }
    });
    try { await MC.Auth.init(G.config); } catch (e) { console.warn('[auth]', e); }
    refreshAuth();
  }

  function refreshAuth() {
    const a = MC.Auth;
    UI.updateAuth({ available: a.available, email: a.email(), name: a.displayName(), allowed: a.isAllowed(), required: !!G.config.requireLogin });
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();
  MC.G = G;
})(window.MC = window.MC || {});
