#!/usr/bin/env node
/**
 * Batch: 全部五组河图太极飞忌冲扫描
 * 规则: A飞忌→B的对宫 → 冲B → 破
 * 河图宫非对宫，只有飞宫忌能造成破
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';

const tsContent = readFileSync('C:\\Users\\Administrator\\Documents\\New project\\traviszhao96-cmd\\ShuShuMaser\\src\\data\\cases.generated.ts', 'utf-8');
const jm = tsContent.match(/export const caseRecords: CaseRecord\[\] = (\[[\s\S]*?\])\s+as CaseRecord\[\]/);
const cases = eval('(' + jm[1] + ')');
const targetCases = cases.filter(c => c.birthday && c.group !== '评测');
const OUT = 'C:\\Users\\Administrator\\.qclaw\\workspace-agent-73224230\\tmp_hetu_scan.json';

/**
 * 对宫映射: 每个宫名字 → 其对宫名字
 */
const OPPOSITE = {
  '命宫': '迁移', '迁移': '命宫',
  '兄弟': '仆役', '仆役': '兄弟', '交友': '兄弟',
  '夫妻': '官禄', '官禄': '夫妻',
  '子女': '田宅', '田宅': '子女',
  '财帛': '福德', '福德': '财帛',
  '父母': '疾厄', '疾厄': '父母',
};

/**
 * 五组河图太极定义: { name, pairs:[[主宫,辅宫],...], desc }
 * 每组内的每一对都要检查
 */
const HETU_GROUPS = [
  {
    name: '一六共宗',
    members: ['命宫', '疾厄', '福德'],
    primary: ['命宫', '疾厄'],
    desc: '论自己(性格/精神/身体)',
  },
  {
    name: '二七同道',
    members: ['兄弟', '父母', '迁移'],
    primary: ['兄弟', '父母'],
    desc: '论六亲/平辈/长辈',
  },
  {
    name: '三八为朋',
    members: ['夫妻', '仆役'],
    primary: ['夫妻'],
    desc: '论婚姻感情',
  },
  {
    name: '四九为友',
    members: ['子女', '官禄'],
    primary: ['官禄'],
    desc: '论事业/下属/创作',
  },
  {
    name: '五十同途',
    members: ['财帛', '田宅'],
    primary: ['田宅'],
    desc: '论财富/家庭',
  },
];

/**
 * Check if palace A's flying 忌 lands at the OPPOSITE of palace B
 * i.e., A飞忌→B的对宫 → 冲B → 破
 */
function checkFlyJiClash(palaceA, palaceB) {
  const jiTarget = palaceA.mutagedPlaces?.忌;
  if (!jiTarget) return null;
  const targetName = jiTarget.name;
  // For 仆役/交友 normalization
  const aName = palaceA.name === '交友' ? '仆役' : palaceA.name;
  const bName = palaceB.name === '交友' ? '仆役' : palaceB.name;
  const bOpposite = OPPOSITE[bName];
  if (targetName === bOpposite || (bOpposite === '仆役' && targetName === '交友') || (bOpposite === '交友' && targetName === '仆役')) {
    return `${aName} 飞忌→${targetName}(=${bName}的对宫)→冲${bName}`;
  }
  return null;
}

const allResults = [];

for (const c of targetCases) {
  try {
    const chart = buildChart({ date: c.birthday, timeIndex: c.birthTime, calendar: c.birthdayType === 'lunar' ? 'lunar' : 'solar', gender: c.gender, isLeapMonth: false, fixLeap: true });
    const s = serializeChart(chart);
    const ps = s.palaces || [];

    const P = (name) => {
      let p = ps.find(p => p.name === name);
      if (!p && name === '仆役') p = ps.find(p => p.name === '交友');
      if (!p && name === '交友') p = ps.find(p => p.name === '仆役');
      return p || {};
    };

    const groupResults = {};

    for (const group of HETU_GROUPS) {
      const breaks = [];
      const members = group.members;

      // Check all pairs within the group
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const pa = P(members[i]);
          const pb = P(members[j]);

          // A 冲 B
          const clash1 = checkFlyJiClash(pa, pb);
          if (clash1) {
            const sevA = group.primary.includes(members[i]) ? '主冲辅' : group.primary.includes(members[j]) ? '辅冲主' : '';
            breaks.push({ direction: clash1, severity: sevA });
          }

          // B 冲 A
          const clash2 = checkFlyJiClash(pb, pa);
          if (clash2) {
            const sevB = group.primary.includes(members[j]) ? '主冲辅' : group.primary.includes(members[i]) ? '辅冲主' : '';
            breaks.push({ direction: clash2, severity: sevB });
          }
        }
      }

      if (breaks.length > 0) {
        groupResults[group.name] = {
          desc: group.desc,
          primary: group.primary,
          breaks,
        };
      }
    }

    if (Object.keys(groupResults).length > 0) {
      const origP = ps.find(p => p.isOriginalPalace) || {};
      const bodyP = ps.find(p => p.isBodyPalace) || {};
      allResults.push({
        id: c.id,
        name: c.name,
        originPalace: origP.name,
        bodyPalace: bodyP.name,
        hetuBroken: groupResults,
      });
    }
  } catch (e) {
    // skip
  }
}

// Sort and write
allResults.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
writeFileSync(OUT, JSON.stringify(allResults, null, 2), 'utf-8');

// Summary
const groupCounts = {};
for (const r of allResults) {
  for (const g of Object.keys(r.hetuBroken)) {
    groupCounts[g] = (groupCounts[g] || 0) + 1;
  }
}
console.log(`Total with any hetu break: ${allResults.length}/${targetCases.length}`);
for (const [g, n] of Object.entries(groupCounts)) {
  console.log(`  ${g}: ${n}人`);
}

// Print details
console.log('\n=== DETAIL ===');
for (const r of allResults) {
  console.log(`\n[${r.name}] 来因:${r.originPalace} 身:${r.bodyPalace}`);
  for (const [g, info] of Object.entries(r.hetuBroken)) {
    for (const b of info.breaks) {
      const sev = b.severity ? ` ${b.severity}` : '';
      console.log(`  ${g}${sev}: ${b.direction}`);
    }
  }
}
