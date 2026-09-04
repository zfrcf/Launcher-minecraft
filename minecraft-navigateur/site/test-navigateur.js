// Vérification du profil choisi selon l'appareil, dans un vrai navigateur.
//
//   npm run build && node test-navigateur.js
//
// Nécessite Playwright et un Chromium (variable PLAYWRIGHT_BROWSERS_PATH ou installation par
// défaut). Ce test existe parce qu'un PC à dalle tactile avait été classé comme téléphone :
// distance de rendu divisée par deux, interface géante, carte graphique dédiée refusée.
// Les valeurs de chaque cas sont celles que renvoie réellement le navigateur sur ces appareils.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const chemin = { executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' };
const dist = path.join(__dirname, 'dist');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.ttf': 'font/ttf' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(dist, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(4218);

// Les trois appareils réels, avec les valeurs que leur navigateur renvoie vraiment
const cas = [
  { nom: 'PC sans écran tactile', touchPoints: 0, coarse: false, hover: true, attendu: 'PC' },
  { nom: 'PC à dalle tactile',    touchPoints: 10, coarse: false, hover: true, attendu: 'PC' },
  { nom: 'Téléphone Android',     touchPoints: 5, coarse: true,  hover: false, attendu: 'tactile' },
  { nom: 'iPad',                  touchPoints: 5, coarse: true,  hover: false, attendu: 'tactile' },
];
let echecs = 0;
(async () => {
  const browser = await chromium.launch({ ...chemin, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const c of cas) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await ctx.addInitScript(({ touchPoints, coarse, hover }) => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => touchPoints });
      const vrai = window.matchMedia.bind(window);
      window.matchMedia = (q) => {
        if (q === '(pointer: coarse)') return { matches: coarse, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
        if (q === '(hover: hover)') return { matches: hover, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
        return vrai(q);
      };
      localStorage.clear();
    }, c);
    const page = await ctx.newPage();
    await page.goto('http://localhost:4218/?modal=serversList', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.options, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({ rendu: window.options.renderDistance, gpu: window.options.gpuPreference, gui: window.options.guiScale, main: window.options.showHand }));
    const vu = (r.gpu === 'high-performance' && r.rendu >= 4) ? 'PC' : 'tactile';
    const ok = vu === c.attendu;
    if (!ok) echecs++;
    console.log(c.nom.padEnd(24), JSON.stringify(r), '-> vu comme', vu, ok ? 'ok' : 'ÉCHEC, attendu ' + c.attendu);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(echecs === 0 ? '\nOK : les ' + cas.length + ' profils d’appareil sont bien reconnus' : '\n' + echecs + ' profil(s) mal reconnu(s)');
  process.exit(echecs === 0 ? 0 : 1);
})().catch(e => { console.error(e.message); srv.close(); process.exit(1); });
