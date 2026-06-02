#!/usr/bin/env node
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const CASES_PATH = 'C:\\Users\\Administrator\\Documents\\New project\\traviszhao96-cmd\\ShuShuMaser\\src\\data\\cases.generated.ts';
const OUT_PATH = 'C:\\Users\\Administrator\\.qclaw\\workspace-agent-73224230\\tmp_zuofuyoubi_scan.json';

const tsContent = readFileSync(CASES_PATH, 'utf-8');
const jsonMatch = tsContent.match(/export const caseRecords: CaseRecord\[\] = (\[[\s\S]*?\])\s+as CaseRecord\[\]/);
const cases = eval('(' + jsonMatch[1] + ')');

const SH = { lu:'禄', quan:'权', ke:'科', ji:'忌' };
const results = [];

for (const c of cases) {
  if (!c.birthday) continue;
  try {
    const chart = buildChart({
      date: c.birthday, timeIndex: c.birthTime,
      calendar: c.birthdayType === 'lunar' ? 'lunar' : 'solar',
      gender: c.gender, isLeapMonth: false, fixLeap: true,
    });
    const s = serializeChart(chart);
    const palaces = s.palaces || [];
    const bm = s.birthMutagens || {};

    const findStars = (p) => {
      const majors = (p.majorStars || []).map(st => {
        const base = st.name + (st.brightness||'');
        return st.mutagen ? base + '[' + st.mutagen + ']' : base;
      });
      const minors = (p.minorStars || []).map(st => st.name);
      const adjuncts = (p.adjectiveStars || []).map(st => st.name);
      return { majors, minors, adjuncts };
    };

    const getSelfH = (p) => {
      const sm = p.selfMutaged || {};
      return Object.entries(sm).filter(([k,v]) => v && k in SH).map(([k]) => SH[k]);
    };

    const hasStar = (p, name) => {
      return [...(p.majorStars||[]), ...(p.minorStars||[]), ...(p.adjectiveStars||[])].some(st => st.name === name);
    };

    let zfPos = null, ybPos = null, zfSelf = [], ybSelf = [];
    let zfHasBM = false, zfBMType = null, yfHasBM = false, yfBMType = null;
    let renPalace = null, wuPalace = null;
    let allStars = {};

    for (const p of palaces) {
      const stars = findStars(p);
      allStars[p.name] = stars;

      // Find zuofu/youbi
      if (hasStar(p, '左辅')) {
        zfPos = p.name;
        zfSelf = getSelfH(p);
        // Check if zuofu has birth mutagen
        for (const [t, info] of Object.entries(bm)) {
          if (info.star === '左辅' && info.palace?.name === p.name) {
            zfHasBM = true;
            zfBMType = SH[t] || t;
          }
        }
        // Check if zuofu is in 子宫
        if (p.earthlyBranch === '子') zfPos += '[子宫]';
      }

      if (hasStar(p, '右弼')) {
        ybPos = p.name;
        ybSelf = getSelfH(p);
        for (const [t, info] of Object.entries(bm)) {
          if (info.star === '右弼' && info.palace?.name === p.name) {
            yfHasBM = true;
            yfBMType = SH[t] || t;
          }
        }
      }

      // Check heavenly stems
      if (p.heavenlyStem === '壬') renPalace = p.name;
      if (p.heavenlyStem === '戊') wuPalace = p.name;
    }

    // Check 孤阴 (太阴 + 右弼)
    let guyin = false;
    if (ybPos) {
      for (const p of palaces) {
        if (p.name === ybPos && hasStar(p, '太阴')) {
          guyin = true;
        }
      }
    }

    let renLink = renPalace ? (zfPos === renPalace ? zfPos+'[壬同宫]' : zfPos+'→壬在'+renPalace) : zfPos+'→无壬';
    let wuLink = wuPalace ? (ybPos === wuPalace ? ybPos+'[戊同宫]' : ybPos+'→戊在'+wuPalace) : ybPos+'→无戊';

    results.push({
      id: c.id,
      name: c.name || c.id,
      gender: c.gender || '?',
      group: c.group || '',
      zuofu: zfPos ? { palace: zfPos, bm: zfHasBM?zfBMType:null, self: zfSelf, renLink } : null,
      youbi: ybPos ? { palace: ybPos, bm: yfHasBM?yfBMType:null, self: ybSelf, wuLink } : null,
      guyin,
      renPalace: renPalace || '无',
      wuPalace: wuPalace || '无',
    });

  } catch(e) {
    // skip
  }
}

writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
console.log('Done. ' + results.length + ' cases scanned.');
