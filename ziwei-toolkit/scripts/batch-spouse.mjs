#!/usr/bin/env node
/** Batch v6: 
 *  三八为朋破(冲>坐):
 *    交友宫飞忌 → 落官禄(夫妻对宫) → 冲夫妻
 *    夫妻宫飞忌 → 落兄弟(交友对宫) → 冲交友
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';

const tsContent = readFileSync('C:\\Users\\Administrator\\Documents\\New project\\traviszhao96-cmd\\ShuShuMaser\\src\\data\\cases.generated.ts', 'utf-8');
const jm = tsContent.match(/export const caseRecords: CaseRecord\[\] = (\[[\s\S]*?\])\s+as CaseRecord\[\]/);
const cases = eval('(' + jm[1] + ')');
const BATCH = parseInt(process.argv[2] || '0');
const BS = 10;
const OUT = 'C:\\Users\\Administrator\\.qclaw\\workspace-agent-73224230\\tmp_spouse_results.json';

const SH = { lu: '禄', quan: '权', ke: '科', ji: '忌' };
const DRIVE = {0:'自我驱动',1:'关系驱动(兄弟)',2:'关系驱动(夫妻)',3:'关系驱动(子女)',7:'关系驱动(交友)',8:'环境驱动(官禄)',9:'环境驱动(田宅)',11:'环境驱动(父母)',10:'先天驱动(福德)',6:'先天驱动(迁移)',5:'身体驱动(疾厄)'};
const P_NAMES = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','仆役','官禄','田宅','福德','父母'];

const targetCases = cases.filter(c => c.birthday && c.group !== '评测');
const start = BATCH * BS, end = Math.min(start + BS, targetCases.length);

const results = [];
for (let i = start; i < end; i++) {
  const c = targetCases[i];
  try {
    const chart = buildChart({ date: c.birthday, timeIndex: c.birthTime, calendar: c.birthdayType === 'lunar' ? 'lunar' : 'solar', gender: c.gender, isLeapMonth: false, fixLeap: true });
    const s = serializeChart(chart);
    const ps = s.palaces || [];
    const P = (name) => ps.find(p => p.name === name) || {};

    const BM = (name) => {
      const r = [];
      for (const [t, info] of Object.entries(s.birthMutagens || {})) {
        const pn = ps.find(pp => pp.index === info.palace?.index)?.name;
        if (pn === name) r.push({ type: SH[t] || t, star: info.star });
      }
      return r;
    };

    const SM = (p) => Object.entries(p.selfMutaged || {}).filter(([k,v]) => v && k in SH).map(([k]) => SH[k]);
    const SS = (p) => ({
      majors: (p.majorStars || []).map(s => { let n = s.name; if (s.brightness) n += `(${s.brightness})`; if (s.mutagen) n += `[生年${s.mutagen}]`; return n; }),
      minors: (p.minorStars || []).map(s => s.name),
      adj: (p.adjectiveStars || []).map(s => s.name),
    });

    const sp = P('夫妻'), ca = P('官禄');
    const fr = ps.find(p => p.name === '仆役' || p.name === '交友') || {};
    const origP = ps.find(p => p.isOriginalPalace) || {};
    const bodyP = ps.find(p => p.isBodyPalace) || {};

    const sjm = BM('夫妻'), cam = BM('官禄'), frm = BM(fr.name);
    const hom = BM('田宅'), chm = BM('子女'), mom = BM('财帛'), spm2 = BM('福德');

    // === CORRECTED v2: 冲 > 坐 ===
    // 交友宫飞忌 → 落官禄宫 → 冲夫妻宫 (官禄是夫妻对宫)
    const friendJiTarget = fr.mutagedPlaces?.忌;
    const friendJiToCareer = friendJiTarget && friendJiTarget.name === '官禄';
    // 夫妻宫飞忌 → 落兄弟宫 → 冲交友宫 (兄弟是仆役对宫)
    const spouseJiTarget = sp.mutagedPlaces?.忌;
    const spouseJiToBrother = spouseJiTarget && spouseJiTarget.name === '兄弟';

    const isOriginSpouse = origP.name === '夫妻';
    const sanbaBroken = friendJiToCareer || spouseJiToBrother;

    let detail = '';
    if (friendJiToCareer) detail = '交友飞忌→官禄→冲夫妻';
    if (spouseJiToBrother) detail = '夫妻飞忌→兄弟→冲交友';

    const oidx = P_NAMES.indexOf(origP.name);
    const zt = origP.name === '夫妻' && chm.some(m => m.type === '忌');

    results.push({
      id: c.id, name: c.name, gender: c.gender, birthday: c.birthday, birthTime: c.birthTime,
      originPalace: origP.name || '?', driveType: DRIVE[oidx] || '未知',
      originMuts: BM(origP.name || '').map(m => `${m.type}(${m.star})`),
      spouse: { stem: sp.heavenlyStem || '?', branch: sp.earthlyBranch || '?', stars: SS(sp), birthMuts: sjm.map(m => `${m.type}(${m.star})`), selfMuts: SM(sp), changsheng: sp.changsheng12 || '', isBody: sp.isBodyPalace || false, isOrig: sp.isOriginalPalace || false },
      career: { stem: ca.heavenlyStem || '?', branch: ca.earthlyBranch || '?', stars: SS(ca), birthMuts: cam.map(m => `${m.type}(${m.star})`), selfMuts: SM(ca) },
      sanba: {
        broken: sanbaBroken,
        isOriginSpouse,
        detail,
        spouseJiTarget: spouseJiTarget?.name || '',
        friendJiTarget: friendJiTarget?.name || '',
      },
      home: { stem: P('田宅').heavenlyStem || '?', birthMuts: hom.map(m => `${m.type}(${m.star})`), selfMuts: SM(P('田宅')) },
      ziTianTrigger: zt, childMuts: chm.map(m => `${m.type}(${m.star})`),
      money: { birthMuts: mom.map(m => `${m.type}(${m.star})`) },
      spirit: { birthMuts: spm2.map(m => `${m.type}(${m.star})`) },
      bodyPalace: bodyP.name || '未知', bodyInSpouse: sp.isBodyPalace || false,
    });
  } catch (e) {}
}

let existing = [];
try { existing = JSON.parse(readFileSync(OUT, 'utf-8')); } catch {}
const newMap = {};
for (const r of existing) newMap[r.id] = r;
for (const r of results) newMap[r.id] = r;
const merged = Object.values(newMap).sort((a, b) => (a.id || '').localeCompare(b.id));
writeFileSync(OUT, JSON.stringify(merged, null, 2), 'utf-8');
console.log(`Batch ${BATCH}: ${results.length} updated, ${merged.length} total`);
