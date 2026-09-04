// Plein écran partout : écran d'accueil, menus et jeu, sur PC et mobile.
// - Demandé au premier geste (clic, touche, doigt) puis à chaque geste tant qu'on n'y est pas :
//   les navigateurs n'autorisent le plein écran que depuis une action de l'utilisateur.
// - En plein écran, la touche Échap est « verrouillée » (Keyboard Lock, Chrome/Edge) : elle
//   ouvre le menu du jeu au lieu de quitter le plein écran. Appui long sur Échap pour sortir.
// - Sur écran tactile, l'écran est verrouillé en paysage quand c'est possible.
// - Désactivable avec ?fullscreen=0 dans l'adresse.
(function (MC) {
  'use strict';

  const el = document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  const enabled = !/[?&]fullscreen=0/.test(location.search);

  const Fullscreen = {
    supported: !!request && enabled,
    busy: false,

    active() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },

    enter() {
      if (!this.supported || this.busy || this.active()) return;
      this.busy = true;
      const done = () => { this.busy = false; };
      try {
        const p = request.call(el, { navigationUI: 'hide' });
        if (p && p.then) p.then(done, done); else done();
      } catch (e) { done(); }
    },

    lockEscape() {
      if (!this.active() || !navigator.keyboard || !navigator.keyboard.lock) return;
      navigator.keyboard.lock(['Escape']).catch(() => { /* non supporté : Échap quitte le plein écran */ });
    },

    lockLandscape() {
      if (!this.active() || !(MC.Touch && MC.Touch.detect())) return;
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { /* refusé : on garde l'orientation courante */ });
    },

    init() {
      if (!this.supported) return;
      const ask = () => this.enter();
      // Seuls ces évènements comptent comme une activation de l'utilisateur (pointerdown tactile non).
      ['pointerup', 'touchend', 'click'].forEach((ev) => document.addEventListener(ev, ask, { capture: true, passive: true }));
      document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') ask(); }, { capture: true, passive: true });
      document.addEventListener('fullscreenchange', () => { if (this.active()) { this.lockEscape(); this.lockLandscape(); } });
    }
  };

  MC.Fullscreen = Fullscreen;
})(window.MC = window.MC || {});
