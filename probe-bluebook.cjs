const https = require('https');
const q = encodeURIComponent(JSON.stringify({ verified: { eq: true }, rentable: { eq: true }, type: 'on-demand' }));
https.get('https://console.vast.ai/api/v0/bundles/?q=' + q, { headers: { 'User-Agent': 'bluebook-probe/0.1' } }, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    const offers = (JSON.parse(d).offers || []);
    const byGpu = {};
    for (const o of offers) {
      if (!o.gpu_name || !o.dph_total || !o.num_gpus) continue;
      const per = o.dph_total / o.num_gpus;
      (byGpu[o.gpu_name] = byGpu[o.gpu_name] || []).push(per);
    }
    const rows = Object.entries(byGpu).map(([g, arr]) => {
      arr.sort((a, b) => a - b);
      return { gpu: g, n: arr.length, median_usd_hr: arr[Math.floor(arr.length / 2)].toFixed(3) };
    }).sort((a, b) => b.n - a.n).slice(0, 15);
    console.table(rows);
    console.log('Median $/hr per GPU = the yield leg of the residual-value index.');
    console.log('Resale leg: register free eBay dev key (developer.ebay.com) and I will script the sold-listings pull.');
  });
}).on('error', e => console.error('ERR', e.message));
