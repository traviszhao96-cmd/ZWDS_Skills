import { readFileSync, writeFileSync } from 'node:fs';
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';

const chart = buildChart({
  date: '1998-11-29', timeIndex: 0,
  calendar: 'solar', gender: 'male',
  isLeapMonth: false, fixLeap: true,
});

const s = serializeChart(chart);
const full = {
  birthYearStem: chart.birthYearStem,
  birthYearBranch: chart.birthYearBranch,
  palaces: (s.palaces||[]).map(p => ({
    name: p.name,
    index: p.index,
    heavenlyStem: p.heavenlyStem,
    earthlyBranch: p.earthlyBranch,
    majors: (p.majorStars||[]).map(st => ({
      name: st.name,
      brightness: st.brightness,
      mutagen: st.mutagen || null,
    })),
    minors: (p.minorStars||[]).map(st => st.name),
    adjuncts: (p.adjectiveStars||[]).map(st => st.name),
    selfMutaged: p.selfMutaged || {},
  })),
  birthMutagens: s.birthMutagens || {},
};

writeFileSync('C:\\Users\\Administrator\\.qclaw\\workspace-agent-73224230\\tmp_james_chart.json', JSON.stringify(full, null, 2), 'utf-8');
process.stdout.write('Done');
