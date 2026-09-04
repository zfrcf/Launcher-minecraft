// Logique "serveur" partagée : utilisée par server.js (Node/WebSocket) ET par le
// navigateur quand un joueur héberge une partie (WebRTC) ou joue hors ligne.
// Ne stocke aucun compte : uniquement l'état du monde et les joueurs connectés.
(function (MC) {
  'use strict';

  const MAX_BLOCK_ID = 27;

  class GameHost {
    // options: { seed, edits:[[x,y,z,id]], authorize: async (joinMsg) => {ok, name, reason}, onEdit(), log() }
    constructor(options) {
      this.seed = options.seed | 0;
      this.edits = new Map();
      (options.edits || []).forEach((e) => this.edits.set(e[0] + ',' + e[1] + ',' + e[2], e[3]));
      this.authorize = options.authorize || (async () => ({ ok: true }));
      this.onEdit = options.onEdit || (() => {});
      this.log = options.log || (() => {});
      this.clients = new Map();  // id -> { id, name, send, x,y,z,yaw,pitch, ready }
      this.nextId = 1;
      this.dayLength = 20 * 60 * 1000; // 20 minutes par cycle complet
      this.dayStart = Date.now() - 0.2 * this.dayLength; // on commence le matin
      this.maxPlayers = options.maxPlayers || 16;
    }

    timeOfDay() { return ((Date.now() - this.dayStart) % this.dayLength) / this.dayLength; }

    editsToArray() {
      const out = [];
      for (const [k, id] of this.edits) { const p = k.split(','); out.push([+p[0], +p[1], +p[2], id]); }
      return out;
    }

    addClient(send) {
      const id = this.nextId++;
      const c = { id, name: 'Joueur' + id, send, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, ready: false };
      this.clients.set(id, c);
      return id;
    }

    removeClient(id) {
      const c = this.clients.get(id);
      if (!c) return;
      this.clients.delete(id);
      if (c.ready) {
        this.broadcast({ t: 'leave', id }, id);
        this.broadcast({ t: 'chat', from: '', msg: c.name + ' a quitté la partie', sys: true });
      }
    }

    broadcast(msg, exceptId) {
      const s = JSON.stringify(msg);
      for (const c of this.clients.values()) {
        if (c.id !== exceptId && c.ready) { try { c.send(s); } catch (e) { /* client parti */ } }
      }
    }

    sendTo(c, msg) { try { c.send(JSON.stringify(msg)); } catch (e) { /* ignore */ } }

    async handle(id, raw) {
      const c = this.clients.get(id);
      if (!c) return;
      let msg;
      try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
      if (!msg || typeof msg.t !== 'string') return;

      if (msg.t === 'join') {
        if (c.ready) return;
        let readyCount = 0;
        for (const o of this.clients.values()) if (o.ready) readyCount++;
        if (readyCount >= this.maxPlayers) { this.sendTo(c, { t: 'error', msg: 'Partie pleine' }); return; }
        let auth;
        try { auth = await this.authorize(msg); } catch (e) { auth = { ok: false, reason: 'Erreur d\'authentification' }; }
        if (!auth || !auth.ok) { this.sendTo(c, { t: 'error', msg: (auth && auth.reason) || 'Accès refusé', fatal: true }); return; }
        let name = String(auth.name || msg.name || '').replace(/[^\w\- éèàùçâêîôûëïüÉÈÀ]/g, '').trim().slice(0, 16);
        if (!name) name = 'Joueur' + id;
        c.name = name;
        c.ready = true;
        this.log('connexion : ' + name + ' (#' + id + ')');
        const players = [];
        for (const o of this.clients.values()) if (o.ready && o.id !== id) players.push({ id: o.id, name: o.name, x: o.x, y: o.y, z: o.z, yaw: o.yaw, pitch: o.pitch });
        this.sendTo(c, { t: 'welcome', id, name, seed: this.seed, edits: this.editsToArray(), players, time: this.timeOfDay(), dayLength: this.dayLength });
        this.broadcast({ t: 'join', id, name, x: c.x, y: c.y, z: c.z }, id);
        this.broadcast({ t: 'chat', from: '', msg: name + ' a rejoint la partie', sys: true });
        return;
      }

      if (!c.ready) return;

      switch (msg.t) {
        case 'pos': {
          c.x = +msg.x || 0; c.y = +msg.y || 0; c.z = +msg.z || 0;
          c.yaw = +msg.yaw || 0; c.pitch = +msg.pitch || 0;
          this.broadcast({ t: 'pos', id, x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch, sneak: !!msg.sneak }, id);
          break;
        }
        case 'set': {
          const x = msg.x | 0, y = msg.y | 0, z = msg.z | 0, bid = msg.id | 0;
          if (y < 0 || y >= 96 || bid < 0 || bid > MAX_BLOCK_ID) return;
          if (Math.abs(x) > 1e6 || Math.abs(z) > 1e6) return;
          this.edits.set(x + ',' + y + ',' + z, bid);
          this.onEdit();
          this.broadcast({ t: 'set', x, y, z, id: bid, by: id }, id);
          break;
        }
        case 'chat': {
          const text = String(msg.msg || '').slice(0, 200).trim();
          if (!text) return;
          this.broadcast({ t: 'chat', from: c.name, msg: text });
          break;
        }
        case 'ping': this.sendTo(c, { t: 'pong', time: this.timeOfDay() }); break;
        default: break;
      }
    }
  }

  MC.GameHost = GameHost;
})(typeof window !== 'undefined' ? (window.MC = window.MC || {}) : (module.exports = {}));
