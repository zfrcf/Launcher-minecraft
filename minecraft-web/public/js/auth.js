// Connexion avec un compte Microsoft (MSAL, flux PKCE, 100 % côté navigateur).
// Rien n'est stocké côté serveur : le jeton reste en sessionStorage le temps de la session.
(function (MC) {
  'use strict';

  const SCOPES = ['openid', 'profile', 'email'];

  const Auth = {
    app: null,
    account: null,
    config: null,
    available: false,

    async init(config) {
      this.config = config || {};
      if (!this.config.msClientId || typeof msal === 'undefined') return false;
      const tenant = this.config.msTenant || 'consumers';
      this.app = new msal.PublicClientApplication({
        auth: {
          clientId: this.config.msClientId,
          authority: 'https://login.microsoftonline.com/' + tenant,
          redirectUri: location.origin + location.pathname,
          navigateToLoginRequestUrl: false
        },
        cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false }
      });
      try {
        const res = await this.app.handleRedirectPromise();
        if (res && res.account) this.account = res.account;
      } catch (e) { console.warn('[auth] redirection', e); }
      if (!this.account) {
        const accounts = this.app.getAllAccounts();
        if (accounts.length) this.account = accounts[0];
      }
      this.available = true;
      return true;
    },

    isMobile() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); },

    async login() {
      if (!this.app) throw new Error('Connexion Microsoft non configurée');
      const req = { scopes: SCOPES, prompt: 'select_account' };
      if (this.isMobile()) { await this.app.loginRedirect(req); return null; }
      const res = await this.app.loginPopup(req);
      this.account = res.account;
      return this.account;
    },

    async getIdToken() {
      if (!this.app || !this.account) return '';
      try {
        const res = await this.app.acquireTokenSilent({ scopes: SCOPES, account: this.account });
        return res.idToken;
      } catch (e) {
        const res = await this.app.acquireTokenPopup({ scopes: SCOPES, account: this.account });
        return res.idToken;
      }
    },

    async logout() {
      if (!this.app) return;
      const account = this.account;
      this.account = null;
      try {
        if (this.isMobile()) await this.app.logoutRedirect({ account });
        else await this.app.logoutPopup({ account });
      } catch (e) { /* ignore */ }
    },

    email() { return this.account && this.account.username ? this.account.username.toLowerCase() : ''; },
    displayName() { return this.account ? (this.account.name || this.account.username || '') : ''; },

    isAllowed() {
      const list = (this.config && this.config.allowedEmails) || [];
      if (!list.length) return true;
      return list.includes(this.email());
    }
  };

  MC.Auth = Auth;
})(window.MC = window.MC || {});
