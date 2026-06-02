import { readFileSync, writeFileSync } from 'node:fs';
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';

const chart = buildChart({
  date: '1998-11-29', timeIndex: 0,
  calendar: 'solar', gender: 'male',
  isLeapMonth: false, fixLeap: true,
});

const s = serializeChart(chart);
const ps = s.palaces || [];

const orig = ps.find(p => p.isOriginalPalace);
const body = ps.find(p => p.isBodyPalace);

const report = {
  name: 'james',
  birth: '1998-11-29 子时 男',
  yearStem: chart.birthYearStem,
  yearBranch: chart.birthYearBranch,
  originPalace: orig ? { name: orig.name, stem: orig.heavenlyStem, branch: orig.earthlyBranch } : null,
  bodyPalace: body ? { name: body.name, stem: body.heavenlyStem, branch: body.earthlyBranch } : null,
  limits: (chart.limits || []).map(l => ({
    ageRange: l.ageRange,
    palaceName: l.palace ? l.palace.name : '?',
  })),
};

writeFileSync('C:\\Users\\Administrator\\.qclaw\\workspace-agent-73224230\\tmp_james_meta.json', JSON.stringify(report, null, 2), 'utf-8');
process.stdout.write(JSON.stringify(report));
