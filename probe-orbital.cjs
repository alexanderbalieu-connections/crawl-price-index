const https = require('https');
https.get('https://celestrak.org/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=json', { headers: { 'User-Agent': 'orbital-probe/0.1' } }, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    const objs = JSON.parse(d);
    console.log('Objects launched in last 30 days:', objs.length);
    objs.slice(0, 10).forEach(o => console.log(' ', o.OBJECT_NAME, '| NORAD', o.NORAD_CAT_ID, '| epoch', o.EPOCH));
    console.log('---');
    console.log('Full conjunction (CDM) data: free Space-Track.org account. This proves the keyless pipeline leg.');
  });
}).on('error', e => console.error('ERR', e.message));
