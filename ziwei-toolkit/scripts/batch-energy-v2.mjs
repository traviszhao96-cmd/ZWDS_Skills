#!/usr/bin/env node
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';
import { readFileSync } from 'node:fs';

const CASES_PATH = 'C:\\Users\\Administrator\\Documents\\New project\\traviszhao96-cmd\\ShuShuMaser\\src\\data\\cases.generated.ts';
const tsContent = readFileSync(CASES_PATH, 'utf-8');
const jsonMatch = tsContent.match(/export const caseRecords: CaseRecord\[\] = (\[[\s\S]*?\])\s+as CaseRecord\[\]/);
const cases = eval('(' + jsonMatch[1] + ')');

const brightMap = { '庙': 3, '旺': 2.5, '得': 2, '平': 1.5, '不': 1, '陷': 0.5 };
const sihuaMap = { lu: '禄', quan: '权', ke: '科', ji: '忌' };
const caseScores = {}; // id -> [{palace, score, ...}]

let processed = 0;
for (const c of cases) {
  if (!c.birthday || c.group === '评测') continue;
  try {
    const chart = buildChart({
      date: c.birthday, timeIndex: c.birthTime,
      calendar: c.birthdayType === 'lunar' ? 'lunar' : 'solar',
      gender: c.gender, isLeapMonth: false, fixLeap: true,
    });
    const s = serializeChart(chart);

    // Collect birth mutations by palace index
    const bm = s.birthMutagens || {};
    const bmByPalace = {};
    for (const [type, info] of Object.entries(bm)) {
      const pi = info.palace?.index;
      if (pi !== undefined) {
        if (!bmByPalace[pi]) bmByPalace[pi] = [];
        bmByPalace[pi].push(type);
      }
    }

    const palaces = s.palaces || [];
    const scores = [];

    for (const p of palaces) {
      const majors = p.majorStars || [];
      let bright = 0;
      const starNames = [];
      for (const st of majors) {
        bright += (brightMap[st.brightness] || 1.5);
        const name = st.name + (st.brightness || '');
        if (st.mutagen) starNames.push(name + st.mutagen);
        else starNames.push(name);
      }

      const bmList = bmByPalace[p.index] || [];
      const sm = p.selfMutaged || {};
      const smList = [];
      for (const [k, v] of Object.entries(sm)) {
        if (v === true && k !== 'any') smList.push(sihuaMap[k] || k);
      }

      const totalMut = bmList.length + smList.length;
      const energy = bright + majors.length * 1.5 + totalMut * 2;
      const mutStr = [...bmList, ...smList.map(s => '自' + s)].join('+');

      scores.push({
        palace: p.name,
        score: energy,
        stars: starNames.join(','),
        mut: mutStr || '-',
        body: p.isBodyPalace ? '身' : '',
        origin: p.isOriginalPalace ? '来因' : '',
      });
    }

    // Output per-case immediately, don't accumulate
    scores.sort((a, b) => b.score - a.score);
    const top = scores[0];
    const bottom = scores[scores.length - 1];
    const avg = scores.reduce((s, p) => s + p.score, 0) / 12;
    const ratio = top.score / avg;

    // Only print interesting cases
    if (ratio > 2.2 || top.score > 9 || top.mut.includes('忌') && top.mut.includes('+') || scores.filter(s => s.score > 7).length >= 2) {
      console.log(`\n--- ${c.name} (${c.birthday}, ${c.gender}) ratio=${ratio.toFixed(2)}x ---`);
      for (const sc of scores) {
        if (sc.score > 4 || sc.mut !== '-') {
          const tag = [sc.body, sc.origin].filter(Boolean).join('');
          console.log(`  ${sc.score.toFixed(1).padStart(5)} | ${sc.palace}${tag} | ${sc.stars || '(空)'} | ${sc.mut}`);
        }
      }
      console.log(`  avg=${avg.toFixed(1)} top=${top.palace}(${top.score.toFixed(1)}) bottom=${bottom.palace}(${bottom.score.toFixed(1)})`);
    }

    processed++;
    if (processed % 5 === 0) console.error(`Processed ${processed}...`);
  } catch (e) {
    console.error(`[${c.id}] ${c.name}: ${e.message}`);
  }
}
console.error(`\nDone! ${processed} cases`);
