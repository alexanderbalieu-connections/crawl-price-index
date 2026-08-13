const https = require('https');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'resrisk-probe/0.1' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}
function head(url) {
  return new Promise(resolve => {
    try {
      const u = new URL(url);
      const req = https.request({ method: 'HEAD', host: u.host, path: u.pathname + u.search, timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 resrisk-probe' } }, res => resolve(res.statusCode));
      req.on('error', () => resolve(0));
      req.on('timeout', () => { req.destroy(); resolve(-1); });
      req.end();
    } catch { resolve(0); }
  });
}
(async () => {
  const r = await get('https://gamma-api.polymarket.com/markets?closed=false&limit=200&order=volume&ascending=false');
  const markets = JSON.parse(r.body);
  console.log('Open markets fetched:', markets.length);
  const urlRe = /https?:\/\/[^\s")\]]+/g;
  let noSource = 0, withUrls = 0, dead = 0, checked = 0;
  for (const m of markets) {
    const desc = (m.description || '');
    const urls = desc.match(urlRe) || [];
    if (urls.length === 0) { noSource++; continue; }
    withUrls++;
    const status = await head(urls[0]);
    checked++;
    const ok = status >= 200 && status < 400;
    if (!ok) { dead++; console.log('DEAD/ERR', status, '|', (m.question || '').slice(0, 60), '|', urls[0].slice(0, 70)); }
  }
  console.log('---');
  console.log('No URL cited in description:', noSource, '/', markets.length);
  console.log('First-URL dead or erroring:', dead, '/', checked);
  console.log('If dead+missing is a meaningful share of top-volume markets, the headline exists.');
})();
