const https = require('https');
// Example: did wind gusts exceed 100 km/h at Luxembourg-Findel around storm dates? Adjust lat/lon/dates freely.
const url = 'https://archive-api.open-meteo.com/v1/archive?latitude=49.626&longitude=6.211&start_date=2024-12-01&end_date=2024-12-31&daily=wind_gusts_10m_max&timezone=UTC';
https.get(url, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    const days = j.daily.time, gusts = j.daily.wind_gusts_10m_max;
    const THRESHOLD = 100; let fired = [];
    days.forEach((day, i) => { if (gusts[i] >= THRESHOLD) fired.push(day + ': ' + gusts[i] + ' km/h'); });
    console.log('Trigger: max daily wind gust >= ' + THRESHOLD + ' km/h, Findel area, Dec 2024');
    console.log(fired.length ? 'FIRED on:' : 'NOT FIRED');
    fired.forEach(f => console.log(' ', f));
    console.log('---');
    console.log('Deterministic verdict from archived data. Production swaps in official station records (DWD/NOAA) + Ed25519 signature.');
  });
}).on('error', e => console.error('ERR', e.message));
