// Capture le CSS que Tailwind génère réellement pour la page de planning, après avoir exercé
// l'interface (création d'employé, de shift, ouverture des fenêtres) pour que les classes
// ajoutées dynamiquement soient elles aussi générées.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join('/home/user/Launcher-minecraft', p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/html' }); fs.createReadStream(f).pipe(res);
}).listen(4202);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await page.route('https://cdn.tailwindcss.com**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(__dirname + '/tailwind-cdn.js') }));
  await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto('http://localhost:4202/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // Exercer l'interface pour déclencher les classes ajoutées par le JavaScript.
  // Avec le vrai Tailwind, les fenêtres sont réellement masquées : il faut les ouvrir.
  await page.click('button:has-text("GÉRER")'); await page.waitForTimeout(900);
  await page.fill('#newEmpName', 'Marie Test'); await page.fill('#newEmpRole', 'Coach'); await page.fill('#newEmpHours', '35');
  await page.click('button:has-text("AJOUTER")'); await page.waitForTimeout(1200);
  await page.fill('#newEmpName', 'Paul Test'); await page.fill('#newEmpRole', 'Accueil'); await page.fill('#newEmpHours', '25');
  await page.click('button:has-text("AJOUTER")'); await page.waitForTimeout(1200);
  await page.click('#empModal button:has-text("Fermer"), button:has-text("Fermer")').catch(() => {});
  await page.waitForTimeout(700);
  await page.click('button:has-text("Shift")'); await page.waitForTimeout(1000);
  await page.selectOption('#shiftEmpSelect', { index: 0 }).catch(() => {});
  await page.fill('#shiftStart', '09:00'); await page.fill('#shiftEnd', '17:00');
  await page.click('button:has-text("Valider")'); await page.waitForTimeout(1500);
  // Statuts et vues : chaque état a ses couleurs
  for (const st of ['absent', 'conge', 'maladie', 'present']) {
    await page.click('button:has-text("Shift")').catch(() => {}); await page.waitForTimeout(500);
    await page.selectOption('#shiftEmpSelect', { index: 0 }).catch(() => {});
    await page.selectOption('#shiftStatus', st).catch(() => {});
    await page.fill('#shiftStart', '10:00'); await page.fill('#shiftEnd', '14:00');
    await page.click('button:has-text("Valider")').catch(() => {}); await page.waitForTimeout(900);
  }
  await page.click('button:has-text("Jour")').catch(() => {}); await page.waitForTimeout(900);
  await page.click('button:has-text("Semaine")').catch(() => {}); await page.waitForTimeout(900);
  await page.click('button:has-text("GÉRER")').catch(() => {}); await page.waitForTimeout(900);
  await page.click('button:has-text("Fermer")').catch(() => {}); await page.waitForTimeout(600);
  await page.click('button:has-text("Config. Impression")').catch(() => {}); await page.waitForTimeout(900);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(1500);

  // Récupère uniquement la feuille générée par Tailwind. On l'identifie à coup sûr par ses
  // variables internes (--tw-…) : la page a aussi une balise <style> sans id, qu'il ne faut surtout
  // pas recopier — elle contient notamment le bloc @media print, qui s'appliquerait alors à l'écran.
  const css = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      const noeud = sheet.ownerNode;
      if (!noeud || noeud.tagName !== 'STYLE' || noeud.id) continue;
      const texte = noeud.textContent || '';
      if (!texte.includes('--tw-')) continue;          // ce n'est pas la feuille de Tailwind
      return [...rules].map((r) => r.cssText).join('\n');
    }
    throw new Error('feuille Tailwind introuvable : le CDN a-t-il bien répondu ?');
  });
  fs.writeFileSync(__dirname + '/tailwind-genere.css', css);
  console.log('CSS capturé :', Math.round(css.length / 1024), 'Ko,', css.split('\n').length, 'règles');
  console.log('extrait :', css.slice(0, 200).replace(/\n/g, ' '));
  await page.screenshot({ path: 'fp-avec-tailwind.png' });
  await browser.close(); srv.close();
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
