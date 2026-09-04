// Réseau : 4 transports avec la même interface.
//  - 'offline' : partie solo, hôte local, sauvegarde dans le navigateur
//  - 'host'    : j'héberge (WebRTC via PeerJS) ; les autres rejoignent avec un code
//  - 'join'    : je rejoins un hôte WebRTC avec son code
//  - 'ws'      : serveur Node dédié (server.js) via WebSocket
(function (MC) {
  'use strict';

  const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function makeRoomCode() { let s = ''; for (let i = 0; i < 6; i++) s += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]; return s; }
  function peerId(code) { return 'mcweb-fr-' + String(code).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  const STORAGE_PREFIX = 'mcweb_monde_';

  function loadLocalWorld(seed) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + seed);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.edits) ? parsed.edits : [];
    } catch (e) { return []; }
  }

  function saveLocalWorld(seed, edits) {
    try { localStorage.setItem(STORAGE_PREFIX + seed, JSON.stringify({ seed, edits, savedAt: Date.now() })); } catch (e) { /* quota */ }
  }

  function listLocalWorlds() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          const p = JSON.parse(localStorage.getItem(k));
          out.push({ seed: p.seed, edits: (p.edits || []).length, savedAt: p.savedAt });
        }
      }
    } catch (e) { /* ignore */ }
    return out.sort((a, b) => b.savedAt - a.savedAt);
  }

  class Net {
    constructor() {
      this.handlers = {};
      this.mode = 'offline';
      this.connected = false;
      this.myId = 0;
      this.roomCode = '';
      this._send = null;
      this._close = null;
      this.host = null;
    }

    on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); return this; }

    dispatch(msg) {
      if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
      if (!msg || !msg.t) return;
      if (msg.t === 'welcome') { this.myId = msg.id; this.connected = true; }
      const list = this.handlers[msg.t];
      if (list) list.forEach((fn) => fn(msg));
      const any = this.handlers['*'];
      if (any) any.forEach((fn) => fn(msg));
    }

    send(msg) { if (this._send) this._send(JSON.stringify(msg)); }

    close() { if (this._close) this._close(); this.connected = false; this._send = null; this._close = null; }

    // ----- Hôte local (solo + hébergement WebRTC) -----
    createLocalHost(seed, password) {
      const edits = loadLocalWorld(seed);
      let saveTimer = null;
      const host = new MC.GameHost({
        seed,
        edits,
        authorize: async (msg) => {
          if (password && msg.key !== password) return { ok: false, reason: 'Mot de passe incorrect' };
          return { ok: true, name: msg.name };
        },
        onEdit: () => {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => saveLocalWorld(seed, host.editsToArray()), 800);
        },
        log: (s) => console.log('[hôte]', s)
      });
      this.host = host;
      // boucle locale : mon propre client passe directement par l'hôte
      const id = host.addClient((s) => setTimeout(() => this.dispatch(s), 0));
      this._send = (s) => host.handle(id, s);
      this._close = () => { host.removeClient(id); saveLocalWorld(seed, host.editsToArray()); };
      return host;
    }

    connectOffline(opts) {
      this.mode = 'offline';
      this.createLocalHost(opts.seed, '');
      this.send({ t: 'join', name: opts.name });
      return Promise.resolve();
    }

    connectHost(opts) {
      this.mode = 'host';
      const host = this.createLocalHost(opts.seed, opts.password || '');
      this.roomCode = opts.roomCode || makeRoomCode();
      return new Promise((resolve, reject) => {
        if (typeof Peer === 'undefined') { reject(new Error('PeerJS indisponible')); return; }
        const peer = new Peer(peerId(this.roomCode), { debug: 1 });
        this.peer = peer;
        let opened = false;
        peer.on('open', () => {
          opened = true;
          this.send({ t: 'join', name: opts.name, key: opts.password || '' });
          resolve();
        });
        peer.on('connection', (conn) => {
          let cid = null;
          conn.on('open', () => { cid = host.addClient((s) => conn.send(s)); });
          conn.on('data', (d) => { if (cid !== null) host.handle(cid, typeof d === 'string' ? d : JSON.stringify(d)); });
          conn.on('close', () => { if (cid !== null) host.removeClient(cid); });
          conn.on('error', () => { if (cid !== null) host.removeClient(cid); });
        });
        peer.on('error', (err) => {
          console.warn('[peer]', err);
          if (!opened) {
            if (err.type === 'unavailable-id') reject(new Error('Ce code de salle est déjà utilisé, choisis-en un autre'));
            else reject(new Error('Serveur de mise en relation injoignable (' + err.type + ')'));
          } else this.dispatch({ t: 'netwarn', msg: 'Problème réseau : ' + err.type });
        });
        peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
        const prevClose = this._close;
        this._close = () => { prevClose(); try { peer.destroy(); } catch (e) { /* ignore */ } };
      });
    }

    connectJoin(opts) {
      this.mode = 'join';
      this.roomCode = String(opts.roomCode || '').toUpperCase().trim();
      return new Promise((resolve, reject) => {
        if (typeof Peer === 'undefined') { reject(new Error('PeerJS indisponible')); return; }
        const peer = new Peer({ debug: 1 });
        this.peer = peer;
        let done = false;
        const fail = (e) => { if (!done) { done = true; reject(e); } else this.dispatch({ t: 'disconnect', msg: e.message }); };
        peer.on('open', () => {
          const conn = peer.connect(peerId(this.roomCode), { reliable: true, serialization: 'json' });
          conn.on('open', () => {
            this._send = (s) => conn.send(s);
            this._close = () => { try { conn.close(); peer.destroy(); } catch (e) { /* ignore */ } };
            this.send({ t: 'join', name: opts.name, key: opts.password || '' });
            done = true;
            resolve();
          });
          conn.on('data', (d) => this.dispatch(d));
          conn.on('close', () => this.dispatch({ t: 'disconnect', msg: 'L\'hôte a fermé la partie' }));
          conn.on('error', (e) => fail(new Error('Connexion perdue : ' + e)));
        });
        peer.on('error', (err) => {
          if (err.type === 'peer-unavailable') fail(new Error('Aucune partie avec ce code (l\'hôte doit être en jeu)'));
          else fail(new Error('Réseau : ' + err.type));
        });
        setTimeout(() => { if (!done) fail(new Error('Délai dépassé : impossible de joindre l\'hôte')); }, 15000);
      });
    }

    connectWs(opts) {
      this.mode = 'ws';
      return new Promise((resolve, reject) => {
        let url = opts.url;
        if (!url) {
          const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
          url = proto + location.host + '/ws';
        }
        let ws;
        try { ws = new WebSocket(url); } catch (e) { reject(new Error('URL de serveur invalide')); return; }
        let opened = false;
        ws.onopen = () => {
          opened = true;
          this._send = (s) => { if (ws.readyState === 1) ws.send(s); };
          this._close = () => ws.close();
          this.send({ t: 'join', name: opts.name, key: opts.password || '', token: opts.token || '' });
          resolve();
        };
        ws.onmessage = (ev) => this.dispatch(ev.data);
        ws.onerror = () => { if (!opened) reject(new Error('Serveur injoignable : ' + url)); };
        ws.onclose = () => { if (opened) this.dispatch({ t: 'disconnect', msg: 'Connexion au serveur perdue' }); this.connected = false; };
      });
    }

    connect(opts) {
      switch (opts.mode) {
        case 'host': return this.connectHost(opts);
        case 'join': return this.connectJoin(opts);
        case 'ws': return this.connectWs(opts);
        default: return this.connectOffline(opts);
      }
    }
  }

  MC.Net = Net;
  MC.makeRoomCode = makeRoomCode;
  MC.listLocalWorlds = listLocalWorlds;
  MC.deleteLocalWorld = (seed) => { try { localStorage.removeItem(STORAGE_PREFIX + seed); } catch (e) { /* ignore */ } };
})(window.MC = window.MC || {});
