// Commandes tactiles (mobile / tablette) : joystick virtuel, regard au doigt,
// appui court = poser, appui long = casser, boutons d'action.
(function (MC) {
  'use strict';

  const Touch = {
    enabled: false,
    joystick: { pointerId: null, cx: 0, cy: 0 },
    look: { pointerId: null, lx: 0, ly: 0, sx: 0, sy: 0, start: 0, moved: false, holdTimer: null, holding: false },
    sensitivity: 0.0045,

    detect() {
      return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
    },

    init(layer, player, cb) {
      this.enabled = true;
      this.player = player;
      this.cb = cb;
      this.layer = layer;
      layer.hidden = false;
      layer.style.touchAction = 'none';
      this.base = document.getElementById('joy-base');
      this.knob = document.getElementById('joy-knob');

      layer.addEventListener('pointerdown', (e) => this.onDown(e));
      layer.addEventListener('pointermove', (e) => this.onMove(e));
      layer.addEventListener('pointerup', (e) => this.onUp(e));
      layer.addEventListener('pointercancel', (e) => this.onUp(e));
      layer.addEventListener('contextmenu', (e) => e.preventDefault());

      const bind = (id, down, up) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); down(e); });
        if (up) {
          el.addEventListener('pointerup', (e) => { e.preventDefault(); up(e); });
          el.addEventListener('pointercancel', (e) => up(e));
          el.addEventListener('pointerleave', (e) => up(e));
        }
        el.addEventListener('contextmenu', (e) => e.preventDefault());
      };
      bind('tb-jump', () => { player.input.jump = true; }, () => { player.input.jump = false; });
      bind('tb-sneak', () => { player.input.sneak = true; }, () => { player.input.sneak = false; });
      bind('tb-inv', () => cb.inventory());
      bind('tb-chat', () => cb.chat());
      bind('tb-pause', () => cb.pause());
      bind('tb-fly', () => { if (player.mode === 'creative') { player.flying = !player.flying; player.vel.y = 0; } });
      bind('tb-place', () => cb.place());
      bind('tb-break', () => cb.breakStart(), () => cb.breakEnd());
      document.getElementById('touch-buttons').hidden = false;
    },

    onDown(e) {
      const w = window.innerWidth;
      if (e.clientX < w * 0.42 && this.joystick.pointerId === null) {
        this.joystick.pointerId = e.pointerId;
        this.joystick.cx = e.clientX; this.joystick.cy = e.clientY;
        this.base.style.left = e.clientX + 'px'; this.base.style.top = e.clientY + 'px';
        this.knob.style.left = e.clientX + 'px'; this.knob.style.top = e.clientY + 'px';
        this.base.hidden = false; this.knob.hidden = false;
      } else if (this.look.pointerId === null) {
        const l = this.look;
        l.pointerId = e.pointerId; l.lx = l.sx = e.clientX; l.ly = l.sy = e.clientY;
        l.start = performance.now(); l.moved = false; l.holding = false;
        clearTimeout(l.holdTimer);
        l.holdTimer = setTimeout(() => { if (!l.moved && l.pointerId !== null) { l.holding = true; this.cb.breakStart(); } }, 380);
      }
      try { this.layer.setPointerCapture(e.pointerId); } catch (err) { /* pointeur synthétique */ }
    },

    onMove(e) {
      if (e.pointerId === this.joystick.pointerId) {
        const R = 55;
        let dx = e.clientX - this.joystick.cx, dy = e.clientY - this.joystick.cy;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        this.knob.style.left = (this.joystick.cx + dx) + 'px';
        this.knob.style.top = (this.joystick.cy + dy) + 'px';
        const inp = this.player.input;
        inp.ax = Math.abs(dx / R) < 0.15 ? 0 : dx / R;
        inp.az = Math.abs(dy / R) < 0.15 ? 0 : dy / R;
        inp.sprint = d > R * 0.92 && dy < -R * 0.5;
      } else if (e.pointerId === this.look.pointerId) {
        const l = this.look;
        const dx = e.clientX - l.lx, dy = e.clientY - l.ly;
        l.lx = e.clientX; l.ly = e.clientY;
        if (Math.hypot(e.clientX - l.sx, e.clientY - l.sy) > 12) { l.moved = true; if (!l.holding) clearTimeout(l.holdTimer); }
        this.cb.look(dx * this.sensitivity, dy * this.sensitivity);
      }
    },

    onUp(e) {
      if (e.pointerId === this.joystick.pointerId) {
        this.joystick.pointerId = null;
        this.base.hidden = true; this.knob.hidden = true;
        const inp = this.player.input; inp.ax = 0; inp.az = 0; inp.sprint = false;
      } else if (e.pointerId === this.look.pointerId) {
        const l = this.look;
        clearTimeout(l.holdTimer);
        if (l.holding) { this.cb.breakEnd(); }
        else if (!l.moved && performance.now() - l.start < 260) { this.cb.place(); }
        l.pointerId = null; l.holding = false;
      }
    },

    setMode(mode) {
      const fly = document.getElementById('tb-fly');
      if (fly) fly.hidden = mode !== 'creative';
    }
  };

  MC.Touch = Touch;
})(window.MC = window.MC || {});
