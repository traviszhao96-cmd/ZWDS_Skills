import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';
const c = buildChart({ date: '1948-05-20', timeIndex: 11, calendar: 'solar', gender: 'female', isLeapMonth: false, fixLeap: true });
const s = serializeChart(c);
const ps = s.palaces || [];
const fp = ps.find(p => p.name === '仆役' || p.name === '交友');
console.log('friend keys:', Object.keys(fp).join(','));
console.log('mutagedPlaces:', JSON.stringify(fp.mutagedPlaces));
console.log('selfMutaged:', JSON.stringify(fp.selfMutaged));

for (const p of ps) {
  if (p.mutagedPlaces && typeof p.mutagedPlaces === 'object' && Object.keys(p.mutagedPlaces).length > 0) {
    console.log(p.name, 'mutaged:', JSON.stringify(p.mutagedPlaces));
  }
}
