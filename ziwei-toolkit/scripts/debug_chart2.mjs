import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';
const c = buildChart({ date: '1989-10-05', timeIndex: 4, calendar: 'solar', gender: 'female', isLeapMonth: false, fixLeap: true });
const s = serializeChart(c);
const ps = s.palaces || [];
console.log('\nPalaces by index:');
for (let i = 0; i < 12; i++) {
  const p = ps.find(p => p.index === i);
  console.log(`  idx ${i}: ${p?.name || 'NOT_FOUND'} | isOrig:${p?.isOriginalPalace} | isBody:${p?.isBodyPalace} | stem:${p?.heavenlyStem}${p?.earthlyBranch}`);
}
console.log('\nPalaces by position in array:');
ps.forEach((p, i) => {
  console.log(`  [${i}] idx:${p.index} name:${p.name} | isOrig:${p.isOriginalPalace} | isBody:${p.isBodyPalace}`);
});
