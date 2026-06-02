#!/usr/bin/env node
/**
 * Batch: scan ALL palaces for energy concentration across all cases
 * Focus: find palaces with stacked 四化, high brightness, multiple major stars
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';

const CASES_PATH = 'C:\\Users\\Administrator\\Documents\\New project\\traviszhao96-cmd\\ShuShuMaser\\src\\data\\cases.generated.ts';
const OUT_PATH = 'C:\\Users\\Administrator\\.qclaw\\workspace-agent-73224230\\tmp_energy_scan.json';

const tsContent = readFileSync(CASES_PATH, 'utf-8');
const jsonMatch = tsContent.match(/export const caseRecords: CaseRecord\[\] = (\[[\s\S]*?\])\s+as CaseRecord\[\]/);
if (!jsonMatch) { console.error('Cannot parse cases'); process.exit(1); }
const cases = eval('(' + jsonMatch[1] + ')');

const results = [];

for (const c of cases) {
  if (!c.birthday || c.group === '评测') continue;
  try {
    const chart = buildChart({
      date: c.birthday, timeIndex: c.birthTime,
      calendar: c.birthdayType === 'lunar' ? 'lunar' : 'solar',
      gender: c.gender, isLeapMonth: false, fixLeap: true,
    });
    const s = serializeChart(chart);
    const palaces = s.palaces || [];

    // Collect birth mutations by target palace index
    const birthMutByPalace = {};
    const bm = s.birthMutagens || {};
    for (const [type, info] of Object.entries(bm)) {
      const pi = info.palace?.index;
      if (pi !== undefined) {
        if (!birthMutByPalace[pi]) birthMutByPalace[pi] = [];
        birthMutByPalace[pi].push({ type, star: info.star });
      }
    }

    for (const p of palaces) {
      const idx = p.index;
      const name = p.name;

      // Major stars
      const majors = (p.majorStars || []).map(st => {
        const parts = [st.name, st.brightness];
        if (st.mutagen) parts.push(st.mutagen);
        return parts.join('');
      });

      // Brightness score
      const brightMap = { '庙': 3, '旺': 2.5, '得': 2, '平': 1.5, '不': 1, '陷': 0.5 };
      let brightScore = 0;
      for (const st of (p.majorStars || [])) {
        brightScore += (brightMap[st.brightness] || 1.5);
      }

      // Birth mutations hitting this palace
      const bmList = birthMutByPalace[idx] || [];
      const bmCount = bmList.length;

      // Self mutations
      const sm = p.selfMutaged || {};
      const smList = [];
      const sihuaMap = { lu: '禄', quan: '权', ke: '科', ji: '忌' };
      for (const [k, v] of Object.entries(sm)) {
        if (v === true && k !== 'any') smList.push(sihuaMap[k] || k);
      }
      const smCount = smList.length;

      // Total energy: major stars count + brightness + mutations
      const majorCount = majors.length;
      const totalMutations = bmCount + smCount;
      const energyScore = brightScore + majorCount * 1.5 + totalMutations * 2;

      // Flags
      const isBody = p.isBodyPalace || false;
      const isOrigin = p.isOriginalPalace || false;
      const hasJi = bmList.some(m => m.type === 'ji') || smList.includes('忌');
      const hasDoubleJi = bmList.filter(m => m.type === 'ji').length + smList.filter(m => m === '忌').length >= 2;
      const hasLu = bmList.some(m => m.type === 'lu') || smList.includes('禄');
      const hasQuan = bmList.some(m => m.type === 'quan') || smList.includes('权');
      const hasKe = bmList.some(m => m.type === 'ke') || smList.includes('科');
      const hasAllSihua = hasLu && hasQuan && hasKe && hasJi;

      results.push({
        id: c.id, name: c.name, group: c.group,
        birthday: c.birthday, gender: c.gender,
        palace: name, palaceIndex: idx,
        heavenlyStem: p.heavenlyStem, earthlyBranch: p.earthlyBranch,
        majorStars: majors,
        minorStars: (p.minorStars || []).map(s => s.name),
        adjStars: (p.adjectiveStars || []).map(s => s.name),
        brightnessScore: brightScore,
        birthMutations: bmList.map(m => m.type + (m.star ? '(' + m.star + ')' : '')),
        selfMutations: smList,
        totalMutations,
        energyScore: Math.round(energyScore * 10) / 10,
        isBody, isOrigin,
        hasJi, hasDoubleJi, hasLu, hasQuan, hasKe, hasAllSihua,
      });
    }
  } catch (e) {
    console.error(`[${c.id}] ${c.name}: ERROR - ${e.message}`);
  }
}

// Sort by energy score descending, show top 30
results.sort((a, b) => b.energyScore - a.energyScore);

// Also group by case to find cases with extreme palaces
const casePalaces = {};
for (const r of results) {
  if (!casePalaces[r.id]) casePalaces[r.id] = { name: r.name, palaces: [] };
  casePalaces[r.id].palaces.push(r);
}

// Find cases where one palace's energy is extremely high relative to others
const extremes = [];
for (const [id, data] of Object.entries(casePalaces)) {
  const scores = data.palaces.map(p => ({ name: p.palace, score: p.energyScore, ...p }));
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const avg = scores.reduce((s, p) => s + p.score, 0) / scores.length;
  const ratio = top.score / avg;
  if (ratio > 2.5 || top.energyScore > 10 || top.hasAllSihua || top.hasDoubleJi) {
    extremes.push({ id, name: data.name, topPalace: top.palace, topScore: top.score, avg: Math.round(avg * 10) / 10, ratio: Math.round(ratio * 100) / 100 });
  }
}
extremes.sort((a, b) => b.ratio - a.ratio);

writeFileSync(OUT_PATH, JSON.stringify({ topEnergy: results.slice(0, 40), extremes }, null, 2), 'utf-8');

console.log('=== TOP 30 by energy score ===');
for (const r of results.slice(0, 30)) {
  const tag = r.isBody ? '[身]' : r.isOrigin ? '[来因]' : '';
  const mut = [...r.birthMutations, ...r.selfMutations.map(s => '自化' + s)].join('+');
  console.log(`${r.energyScore.toFixed(1)} | ${r.name} ${r.palace}${tag} | ${r.majorStars.join(',')} | ${mut || '-'}`);
}

console.log('\n=== EXTREME cases (top/avg ratio > 2.5 or score > 10 or all-sihua or double-ji) ===');
for (const e of extremes) {
  console.log(`${e.ratio.toFixed(2)}x | ${e.name}: ${e.topPalace}=${e.topScore.toFixed(1)} (avg=${e.avg})`);
}

console.log(`\nDone! ${results.length} palace entries, ${extremes.length} extreme cases`);
