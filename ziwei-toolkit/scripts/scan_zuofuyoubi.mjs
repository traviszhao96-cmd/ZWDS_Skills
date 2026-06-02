// ESM version
import { readFileSync, writeFileSync } from 'node:fs';
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';

const batchFile = process.argv[2];
const outFile = process.argv[3];

const cases = JSON.parse(readFileSync(batchFile, 'utf-8'));

const SH = { lu: '禄', quan: '权', ke: '科', ji: '忌' };
const results = [];

for (const c of cases) {
  try {
    const chart = buildChart({
      date: c.birthday, timeIndex: c.birthTime || 0,
      calendar: c.birthdayType === 'lunar' ? 'lunar' : 'solar',
      gender: c.gender || 'male', isLeapMonth: false, fixLeap: true,
    });
    const s = serializeChart(chart);
    const palaces = s.palaces || [];
    const bm = s.birthMutagens || {};

    const hasStar = (p, name) =>
      [...(p.majorStars||[]), ...(p.minorStars||[]), ...(p.adjectiveStars||[])]
        .some(st => st.name === name);

    let zfPalace = '', ybPalace = '', zfBm = '', ybBm = '';
    let zfSelf = [], ybSelf = [];
    let renPalace = '', wuPalace = '';
    let guyin = false, zfInZi = false;

    for (const p of palaces) {
      if (hasStar(p, '左辅')) {
        zfPalace = p.name;
        if (p.earthlyBranch === '子') zfInZi = true;
        for (const [t, info] of Object.entries(bm)) {
          if (info.star === '左辅') zfBm = SH[t] || t;
        }
        const sm = p.selfMutaged || {};
        zfSelf = Object.entries(sm).filter(([k,v])=>v&&k in SH).map(([k])=>'自'+SH[k]);
      }
      if (hasStar(p, '右弼')) {
        ybPalace = p.name;
        if (hasStar(p, '太阴')) guyin = true;
        for (const [t, info] of Object.entries(bm)) {
          if (info.star === '右弼') ybBm = SH[t] || t;
        }
        const sm = p.selfMutaged || {};
        ybSelf = Object.entries(sm).filter(([k,v])=>v&&k in SH).map(([k])=>'自'+SH[k]);
      }
      if (p.heavenlyStem === '壬') renPalace = p.name;
      if (p.heavenlyStem === '戊') wuPalace = p.name;
    }

    const zuofu = zfPalace ? {
      palace: zfPalace + (zfInZi ? '[子宫]' : ''),
      bm: zfBm || null,
      self: zfSelf.length ? zfSelf.join(',') : null,
      ren: renPalace || '无',
      renSame: zfPalace === renPalace,
    } : null;

    const youbi = ybPalace ? {
      palace: ybPalace,
      bm: ybBm || null,
      self: ybSelf.length ? ybSelf.join(',') : null,
      wu: wuPalace || '无',
      wuSame: ybPalace === wuPalace,
    } : null;

    results.push({
      id: c.id, name: c.name, gender: c.gender, group: c.group || '',
      zuofu, youbi,
      guyin,
      zfYbSame: zfPalace && ybPalace && zfPalace === ybPalace,
    });
  } catch(e) {
    results.push({ id: c.id, name: c.name, error: e.message });
  }
}

writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf-8');
process.stdout.write(outFile + ' written: ' + results.length + ' cases');
