const https = require('https');
function getJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'bluebook-probe/0.2' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}
function postJSON(host, path, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const req = https.request({ method: 'POST', host, path, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'User-Agent': 'bluebook-probe/0.2' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write(payload); req.end();
  });
}
(async () => {
  const targets = ['H100', 'H200', 'B200', 'A100', 'L40', '4090', '5090'];
  const byGpu = {};
  const types = ['on-demand', 'bid', 'reserved'];
  for (const t of types) {
    const q = encodeURIComponent(JSON.stringify({ rentable: { eq: true }, type: t }));
    const j = await getJSON('https://console.vast.ai/api/v0/bundles/?q=' + q);
    const offers = (j && j.offers) || [];
    for (const o of offers) {
      if (!o.gpu_name || !o.dph_total || !o.num_gpus) continue;
      const key = o.gpu_name + ' [' + t + ']';
      (byGpu[key] = byGpu[key] || []).push(o.dph_total / o.num_gpus);
    }
    console.log('vast.ai type=' + t + ': ' + offers.length + ' offers');
  }
  console.log('--- vast.ai depth on datacenter SKUs ---');
  const rows = Object.entries(byGpu)
    .filter(([g]) => targets.some(t => g.includes(t)))
    .map(([g, arr]) => { arr.sort((a, b) => a - b); return { gpu: g, n: arr.length, median_usd_hr: arr[Math.floor(arr.length / 2)].toFixed(3) }; })
    .sort((a, b) => b.n - a.n);
  console.table(rows);
  console.log('--- RunPod public GraphQL attempt ---');
  const rp = await postJSON('api.runpod.io', '/graphql', { query: 'query { gpuTypes { displayName memoryInGb securePrice communityPrice } }' });
  const gpus = rp && rp.data && rp.data.gpuTypes;
  if (!gpus) { console.log('RunPod: no public data returned (may require API key now) - flag for build day'); }
  else {
    console.table(gpus.filter(g => targets.some(t => (g.displayName || '').includes(t))).map(g => ({ gpu: g.displayName, secure_usd_hr: g.securePrice, community_usd_hr: g.communityPrice })));
  }
  console.log('Verdict criteria: need n>=15 per datacenter SKU across sources for a quotable median; below that, eBay sold-listings leg carries the index.');
})();
