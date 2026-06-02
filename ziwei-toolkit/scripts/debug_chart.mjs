import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';
const c = buildChart({ date: '1989-10-05', timeIndex: 4, calendar: 'solar', gender: 'female', isLeapMonth: false, fixLeap: true });
const s = serializeChart(c);
console.log('top keys:', Object.keys(s).join(','));
const ps = s.palaces || [];
const p0 = ps.find(p => p.index === 0);
console.log('p0 keys:', Object.keys(p0).join(','));
const origP = ps.find(p => p.isOriginalPalace === true);
console.log('orig palace:', origP?.index, origP?.name);
const bodyP = ps.find(p => p.isBodyPalace === true);
console.log('body palace:', bodyP?.index, bodyP?.name);
const bm = s.birthMutagens || {};
console.log('bm keys:', Object.keys(bm).join(','));
for (const [k,v] of Object.entries(bm)) {
  console.log(' ', k, 'palace', v?.palace?.index, 'star', v?.star);
}
