// Interface : écran d'accueil, barre d'outils, inventaire/craft, chat, menus.
(function (MC) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const PREFS_KEY = 'mcweb_prefs';

  const UI = {
    atlas: null,
    cb: {},
    iconCache: new Map(),
    chatTimers: [],

    init(atlas, callbacks) {
      this.atlas = atlas;
      this.cb = callbacks;
      this.loadPrefs();
      document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => this.refreshModeFields()));
      this.refreshModeFields();
      $('btn-seed').addEventListener('click', () => { $('in-seed').value = String((Math.random() * 2147483647) | 0); });
      $('btn-play').addEventListener('click', () => this.play());
      $('in-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.play(); });
      $('btn-login').addEventListener('click', () => this.cb.login());
      $('btn-logout').addEventListener('click', () => this.cb.logout());
      $('btn-inv-close').addEventListener('click', () => this.cb.closeInventory());
      $('btn-resume').addEventListener('click', () => this.cb.resume());
      $('btn-mode').addEventListener('click', () => this.cb.toggleMode());
      $('btn-copy').addEventListener('click', () => this.cb.copyCode());
      $('btn-respawn').addEventListener('click', () => this.cb.respawn());
      $('btn-quit').addEventListener('click', () => location.reload());
      $('btn-back').addEventListener('click', () => location.reload());
      $('chat-input').addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { const t = $('chat-input').value.trim(); $('chat-input').value = ''; if (t) this.cb.chat(t); this.closeChat(); }
        else if (e.key === 'Escape') { this.closeChat(); }
      });
      $('room-info').addEventListener('click', () => this.cb.copyCode());
    },

    // ----- Préférences (pas de compte : juste des réglages locaux) -----
    loadPrefs() {
      let p = {};
      try { p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (e) { /* ignore */ }
      if (p.name) $('in-name').value = p.name;
      if (p.mode) { const r = document.querySelector('input[name=mode][value=' + p.mode + ']'); if (r) r.checked = true; }
      if (p.gamemode) $('in-gamemode').value = p.gamemode;
      $('in-dist').value = p.dist || (MC.Touch.detect() ? '3' : '5');
      if (p.wsurl) $('in-wsurl').value = p.wsurl;
      if (p.quality) $('in-quality').value = p.quality;
      if (p.seed) $('in-seed').value = p.seed;
    },
    savePrefs(opts) {
      try { localStorage.setItem(PREFS_KEY, JSON.stringify({ name: opts.name, mode: opts.mode, gamemode: opts.gamemode, dist: String(opts.dist), quality: opts.quality, wsurl: opts.url || '', seed: opts.seedText || '' })); } catch (e) { /* ignore */ }
    },

    currentMode() { const r = document.querySelector('input[name=mode]:checked'); return r ? r.value : 'offline'; },

    refreshModeFields() {
      const m = this.currentMode();
      $('opt-seed').hidden = !(m === 'offline' || m === 'host');
      $('opt-room').hidden = m !== 'join';
      $('opt-pass').hidden = m === 'offline';
      $('opt-ws').hidden = m !== 'ws';
      $('in-pass').placeholder = m === 'host' ? '(optionnel) protège ta partie' : m === 'ws' ? 'mot de passe du serveur (GAME_KEY)' : '(si demandé)';
      $('in-gamemode').parentElement.hidden = m === 'join';
      this.renderWorlds();
      if (m === 'ws' && this.cb.defaultWsUrl && !$('in-wsurl').value) $('in-wsurl').value = this.cb.defaultWsUrl();
    },

    renderWorlds() {
      const box = $('worlds-list');
      const m = this.currentMode();
      const worlds = (m === 'offline' || m === 'host') ? MC.listLocalWorlds() : [];
      box.hidden = worlds.length === 0;
      box.innerHTML = '';
      if (!worlds.length) return;
      const title = document.createElement('div');
      title.textContent = 'Mondes sauvegardés dans ce navigateur :';
      box.appendChild(title);
      worlds.slice(0, 6).forEach((w) => {
        const line = document.createElement('div');
        const b = document.createElement('button');
        b.className = 'btn small';
        b.textContent = 'Graine ' + w.seed + ' · ' + w.edits + ' blocs · ' + new Date(w.savedAt).toLocaleDateString('fr-FR');
        b.addEventListener('click', () => { $('in-seed').value = String(w.seed); });
        const d = document.createElement('button');
        d.className = 'btn small ghost';
        d.textContent = 'Supprimer';
        d.addEventListener('click', () => { if (confirm('Supprimer le monde ' + w.seed + ' ?')) { MC.deleteLocalWorld(w.seed); this.renderWorlds(); } });
        line.appendChild(b); line.appendChild(d);
        box.appendChild(line);
      });
    },

    play() {
      const mode = this.currentMode();
      const name = $('in-name').value.trim() || 'Joueur';
      const seedText = $('in-seed').value.trim();
      let seed;
      if (seedText === '') seed = (Math.random() * 2147483647) | 0;
      else if (/^-?\d+$/.test(seedText)) seed = parseInt(seedText, 10) | 0;
      else { let h = 0; for (const ch of seedText) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0; seed = h; }
      const opts = {
        mode, name, seed, seedText,
        roomCode: $('in-room').value.trim().toUpperCase(),
        password: $('in-pass').value,
        url: $('in-wsurl').value.trim(),
        gamemode: $('in-gamemode').value,
        quality: $('in-quality').value,
        dist: parseInt($('in-dist').value, 10)
      };
      if (mode === 'join' && opts.roomCode.length < 4) { this.showStartError('Indique le code de la partie à rejoindre.'); return; }
      this.savePrefs(opts);
      this.showStartError('');
      $('btn-play').disabled = true;
      $('btn-play').textContent = 'Connexion…';
      this.cb.play(opts).catch((e) => this.showStartError(e.message || String(e))).finally(() => {
        $('btn-play').disabled = false; $('btn-play').textContent = 'Jouer';
      });
    },

    showStartError(msg) { const el = $('start-error'); el.hidden = !msg; el.textContent = msg; },
    hideStart() { $('start-screen').hidden = true; $('hud').hidden = false; },

    updateAuth(state) {
      // state: { available, email, name, allowed, required }
      $('auth-box').hidden = !state.available;
      if (!state.available) return;
      if (state.email) {
        $('auth-status').textContent = 'Connecté : ' + (state.name || '') + ' <' + state.email + '>' + (state.allowed ? '' : ' — compte NON autorisé');
        $('btn-login').hidden = true; $('btn-logout').hidden = false;
        if (state.name && !$('in-name').value) $('in-name').value = state.name.split(' ')[0].slice(0, 16);
      } else {
        $('auth-status').textContent = state.required ? 'Connexion Microsoft requise pour jouer' : 'Non connecté (connexion Microsoft facultative)';
        $('btn-login').hidden = false; $('btn-logout').hidden = true;
      }
    },

    // ----- Icônes -----
    icon(id, size) {
      const key = id + ':' + size;
      let src = this.iconCache.get(key);
      if (!src) { src = MC.blockIcon(this.atlas, id, size); this.iconCache.set(key, src); }
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      c.getContext('2d').drawImage(src, 0, 0);
      return c;
    },

    slotEl(item, selected, creative) {
      const d = document.createElement('div');
      d.className = 'slot' + (selected ? ' sel' : '');
      if (item && item.id) {
        d.appendChild(this.icon(item.id, 40));
        if (!creative && item.qty > 1) { const q = document.createElement('span'); q.className = 'qty'; q.textContent = item.qty; d.appendChild(q); }
        d.title = MC.BLOCKS[item.id].name;
      }
      return d;
    },

    renderHotbar(slots, sel, creative) {
      const bar = $('hotbar');
      bar.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const el = this.slotEl(slots[i], i === sel, creative);
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.cb.selectSlot(i); });
        bar.appendChild(el);
      }
    },

    // ----- Inventaire & craft -----
    openInventory() { $('inventory').hidden = false; },
    closeInventory() { $('inventory').hidden = true; },
    isInventoryOpen() { return !$('inventory').hidden; },

    renderInventory(state) {
      // state: { creative, inv (36), hotbarSel, canCraft(recipe) }
      $('inv-title').textContent = state.creative ? 'Blocs (créatif) — clique pour mettre dans la case sélectionnée' : 'Inventaire — clique pour échanger avec la case sélectionnée';
      const grid = $('inv-grid');
      grid.innerHTML = '';
      if (state.creative) {
        MC.CREATIVE_LIST.forEach((id) => {
          const el = this.slotEl({ id, qty: 1 }, false, true);
          el.addEventListener('click', () => this.cb.creativePick(id));
          grid.appendChild(el);
        });
      } else {
        for (let i = 0; i < 36; i++) {
          const el = this.slotEl(state.inv[i], i === state.hotbarSel, false);
          if (i === 9) el.style.gridColumnStart = '1';
          el.addEventListener('click', () => this.cb.invClick(i));
          grid.appendChild(el);
        }
      }
      $('craft-box').hidden = state.creative;
      if (!state.creative) {
        const list = $('craft-list');
        list.innerHTML = '';
        MC.RECIPES.forEach((r, idx) => {
          const ok = state.canCraft(r);
          const row = document.createElement('div');
          row.className = 'recipe' + (ok ? '' : ' off');
          row.appendChild(this.icon(r.out[0], 28));
          const label = document.createElement('span');
          label.textContent = r.name + ' ×' + r.out[1];
          const ing = document.createElement('span');
          ing.className = 'ing';
          ing.textContent = '← ' + r.in.map((i) => i[1] + ' ' + MC.BLOCKS[i[0]].name).join(' + ');
          const btn = document.createElement('button');
          btn.className = 'btn small';
          btn.textContent = 'Fabriquer';
          btn.disabled = !ok;
          btn.addEventListener('click', () => this.cb.craft(idx));
          row.appendChild(label); row.appendChild(ing); row.appendChild(btn);
          list.appendChild(row);
        });
      }
    },

    // ----- Chat -----
    openChat() { $('chat').classList.add('open'); $('chat-input').hidden = false; $('chat-input').focus(); },
    closeChat() { $('chat').classList.remove('open'); $('chat-input').hidden = true; $('chat-input').blur(); this.cb.chatClosed && this.cb.chatClosed(); },
    isChatOpen() { return !$('chat-input').hidden; },
    addChat(from, msg, sys) {
      const log = $('chat-log');
      const d = document.createElement('div');
      if (sys) d.className = 'sys';
      d.textContent = sys ? msg : '<' + from + '> ' + msg;
      log.appendChild(d);
      while (log.children.length > 12) log.removeChild(log.firstChild);
      setTimeout(() => d.classList.add('old'), 9000);
    },

    toast(text, ms) {
      const t = $('toast');
      t.textContent = text; t.hidden = false;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { t.hidden = true; }, ms || 1500);
    },

    setDebug(text) { $('debug').textContent = text; },
    toggleDebug() { $('debug').hidden = !$('debug').hidden; },
    setRoomInfo(text) { $('room-info').hidden = !text; $('room-info').textContent = text; },
    setBreakProgress(p) { const el = $('break-progress'); el.hidden = p <= 0; el.firstElementChild.style.width = Math.round(p * 100) + '%'; },

    showPause(info) {
      $('pause').hidden = false;
      $('pause-info').textContent = info.text || '';
      $('btn-mode').textContent = info.mode === 'creative' ? 'Passer en survie' : 'Passer en créatif';
      $('btn-copy').hidden = !info.roomCode;
    },
    hidePause() { $('pause').hidden = true; },
    isPaused() { return !$('pause').hidden; },
    showDisconnect(msg) { $('disconnect').hidden = false; $('disconnect-msg').textContent = msg || ''; $('hud').hidden = true; $('touch-buttons').hidden = true; $('touch-layer').hidden = true; }
  };

  MC.UI = UI;
})(window.MC = window.MC || {});
