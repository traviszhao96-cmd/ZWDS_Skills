import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';
const c = buildChart({ date: '1948-05-20', timeIndex: 11, calendar: 'solar', gender: 'female', isLeapMonth: false, fixLeap: true });
const s = serializeChart(c);
for (const p of s.palaces) {
  const opp = s.palaces.find(pp => pp.index === p.oppositePalace);
  console.log(p.name + ' (' + p.index + ') <-> ' + (opp ? opp.name : '?') + ' (' + p.oppositePalace + ')');
}
