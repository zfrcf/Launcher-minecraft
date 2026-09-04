// Fonction serverless Vercel : expose la configuration publique du jeu
// depuis les variables d'environnement du projet Vercel.
// Aucune donnée de compte n'est stockée : uniquement des réglages.
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).end(JSON.stringify({
    msClientId: process.env.MS_CLIENT_ID || '',
    msTenant: process.env.MS_TENANT || 'consumers',
    allowedEmails: (process.env.ALLOWED_EMAILS || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    wsUrl: process.env.WS_URL || '',
    requireLogin: process.env.REQUIRE_LOGIN === '1'
  }));
};
