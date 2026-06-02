// tmp_zhao_lifedomain.mjs
// 赵 - 八大生活域分析报告（v2 - 正确调用 buildChart）
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';
import { writeFileSync } from 'fs';

const chart = buildChart({
  date: '1996-03-19',
  timeIndex: 1,
  calendar: 'solar',
  gender: 'male',
  isLeapMonth: false,
  fixLeap: true,
});

const s = serializeChart(chart);
const ps = s.palaces || [];
const P = (name) => ps.find(p => p.name === name) || {};

function starsOf(name) {
  const p = P(name);
  return [...(p.mainStar || []), ...(p.minorStar || [])];
}

function sihuaOf(name) {
  const p = P(name);
  const r = [];
  if (p.birthMutagen?.type) r.push({ type: '生年', star: p.birthMutagen.star, hua: p.birthMutagen.type });
  if (p.selfMutagen?.type) r.push({ type: '自化', star: p.selfMutagen.star, hua: p.selfMutagen.type, dir: p.selfMutagen.direction });
  return r;
}

// Raw dump
const raw = {
  name: '赵', gender: 'male',
  lunarBirth: s.lunarBirth,
  shengxiao: s.shengxiao,
  wuXingJu: s.wuXingJu,
  tianGan: s.tianGan,
  shenGong: s.shenGong,
  laiyin: s.laiyinGong,
  shengNian: s.birthMutagens,
  palaces: ps.map(p => ({
    name: p.name,
    dz: p.earthlyBranch,
    mainStar: p.mainStar || [],
    minorStar: p.minorStar || [],
    brightness: p.brightness,
    sihua: sihuaOf(p.name),
    daXianRange: p.daXianRange,
  })),
};

writeFileSync(new URL('./tmp_zhao_raw.json', import.meta.url), JSON.stringify(raw, null, 2), 'utf8');
console.log('Raw data written');
console.log(JSON.stringify(raw, null, 2));
