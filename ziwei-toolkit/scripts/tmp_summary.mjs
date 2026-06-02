// tmp_summary.mjs
import {buildChart} from './lib/kinship.mjs';
import {serializeChart} from './lib/chart-output.mjs';
import {writeFileSync} from 'fs';

const c = buildChart({date:'1996-03-19',timeIndex:1,calendar:'solar',gender:'male',isLeapMonth:false,fixLeap:true});
const s = serializeChart(c);
const ps = s.palaces;

let out = '';

for (const p of ps) {
  const ms = (p.majorStars||[]).map(s=>s.name+(s.mutagen?s.mutagen:'')+'('+s.brightness+')').join(' ');
  const ns = (p.minorStars||[]).map(s=>s.name+(s.mutagen?s.mutagen:'')+'('+s.brightness+')').join(' ');
  const selfs = p.selfMutaged?.any ? Object.entries(p.selfMutaged).filter(([k,v])=>k!=='any'&&v).map(([k])=>'自'+k).join('/') : '-';
  const muts = Object.entries(p.mutagedPlaces||{}).map(([k,v])=>v.name+':'+k).join(' ');
  out += p.name + ' ' + p.heavenlyStem + '|' + (ms||'-') + '|' + (ns||'-') + '|' + selfs + '|' + muts + '\n';
}

out += '\n---\n';
out += '生年四化: ';
for (const t of ['禄','权','科','忌']) {
  const m = s.birthMutagens[t];
  if (m) out += m.star + t + '@' + m.palace.name + ' ';
}
out += '\n';
out += '身宫: ' + s.body + ' | 来因: ' + s.soul + ' | 五行局: ' + s.fiveElementsClass + '\n';

console.log(out);
