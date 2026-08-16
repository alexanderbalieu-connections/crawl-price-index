const https = require('https');
https.get('https://api.energy-charts.info/price?bzn=DE-LU', { headers: { 'User-Agent': 'power-probe/0.1' } }, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    const prices = j.price || [];
    const neg = prices.filter(p => p < 0).length;
    const min = Math.min(...prices);
    console.log('DE-LU day-ahead hours in feed:', prices.length);
    console.log('Negative-price hours:', neg, '| lowest:', min, 'EUR/MWh');
    console.log('Every negative hour is a free-power alert someone with a battery or flexible load would pay to receive.');
  });
}).on('error', e => console.error('ERR', e.message));
