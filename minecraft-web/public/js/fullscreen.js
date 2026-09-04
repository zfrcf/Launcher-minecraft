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

    // Renvoie une promesse résolue quand le passage en plein écran est terminé (ou abandonné) :
    // Chrome refuse un verrouillage du pointeur pendant la transition, il faut donc l'attendre.
    enter() {
      if (!this.supported || this.busy || this.active()) return Promise.resolve();
      this.busy = true;
      const done = () => { this.busy = false; };
      try {
        const p = request.call(el, { navigationUI: 'hide' });
        if (p && p.then) return p.then(done, done);
        done();
      } catch (e) { done(); }
      return Promise.resolve();
    },

    // Ces deux verrous échouent de bien des façons selon le navigateur, parfois en levant tout de
    // suite plutôt qu'en rejetant une promesse : le try/catch est nécessaire en plus du .catch,
    // sinon l'exception empêche l'appel suivant.
    lockEscape() {
      if (!this.active() || !navigator.keyboard || !navigator.keyboard.lock) return;
      try {
        const p = navigator.keyboard.lock(['Escape']);
        if (p && p.catch) p.catch(() => { /* non supporté : Échap quitte le plein écran */ });
      } catch (e) { /* ignoré */ }
    },

    lockLandscape() {
      if (!this.active() || !(MC.Touch && MC.Touch.detect())) return;
      if (!screen.orientation || !screen.orientation.lock) return;
      try {
        const p = screen.orientation.lock('landscape');
        if (p && p.catch) p.catch(() => { /* refusé : on garde l'orientation courante */ });
      } catch (e) { /* ignoré */ }
    },

    init() {
      if (!this.supported) return;
      const ask = () => this.enter();
      // Seuls ces évènements comptent comme une activation de l'utilisateur (pointerdown tactile non).
      ['pointerup', 'touchend', 'click'].forEach((ev) => document.addEventListener(ev, ask, { capture: true, passive: true }));
      document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') ask(); }, { capture: true, passive: true });
      // WebKit n'émet que l'évènement préfixé : sans lui, le verrouillage en paysage ne se
      // déclencherait jamais sur les appareils tactiles où il sert le plus.
      const surChangement = () => { if (this.active()) { this.lockEscape(); this.lockLandscape(); } };
      document.addEventListener('fullscreenchange', surChangement);
      document.addEventListener('webkitfullscreenchange', surChangement);
    }
  };

  MC.Fullscreen = Fullscreen;
})(window.MC = window.MC || {});
