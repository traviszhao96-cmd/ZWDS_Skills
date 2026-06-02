#!/usr/bin/env node
/**
 * Batch: generate migration palace (迁移宫) summary for ALL cases
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';

// Load cases from ShuShuMaser
const CASES_PATH = 'C:\\Users\\Administrator\\Documents\\New project\\traviszhao96-cmd\\ShuShuMaser\\src\\data\\cases.generated.ts';
const OUT_PATH = 'C:\\Users\\Administrator\\.qclaw\\workspace-agent-73224230\\tmp_migration_summary.json';

// Quick read of cases (avoid TS parsing - extract JSON array)
import { readFileSync } from 'node:fs';
const tsContent = readFileSync(CASES_PATH, 'utf-8');
const jsonMatch = tsContent.match(/export const caseRecords: CaseRecord\[\] = (\[[\s\S]*?\])\s+as CaseRecord\[\]/);
if (!jsonMatch) {
  console.error('Could not parse cases');
  process.exit(1);
}

// Convert the TS JSON array to proper JSON
const rawJson = jsonMatch[1]
  .replace(/"([^"]+)"/g, (m, key) => {
    // Convert TS-style unquoted keys to JSON keys
    return m;
  });

// Use Function constructor to evaluate the array
const cases = eval('(' + rawJson + ')');

const results = [];

const PALACE_NAMES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];

for (const c of cases) {
  // Skip evaluation cases (45-54)
  if (!c.birthday || c.group === '评测') continue;
  
  try {
    const chart = buildChart({
      date: c.birthday,
      timeIndex: c.birthTime,
      calendar: c.birthdayType === 'lunar' ? 'lunar' : 'solar',
      gender: c.gender,
      isLeapMonth: false,
      fixLeap: true,
    });
    
    const serialized = serializeChart(chart);
    const palaces = serialized.palaces || [];
    
    // Find migration palace (index 6)
    const migP = palaces.find(p => p.name === '迁移' || p.index === 6);
    if (!migP) continue;
    
    // Find birth mutations hitting migration
    const birthMutations = serialized.birthMutagens || {};
    const mutations_hitting_migration = [];
    for (const [type, info] of Object.entries(birthMutations)) {
      if (info.palace && info.palace.index === 6) {
        mutations_hitting_migration.push({ type, star: info.star });
      }
    }
    
    // Self mutations
    const selfMut = migP.selfMutaged || {};
    const self_mutations = [];
    const sihuaMap = { lu: '禄', quan: '权', ke: '科', ji: '忌' };
    for (const [k, v] of Object.entries(selfMut)) {
      if (v === true && k !== 'any') self_mutations.push(sihuaMap[k] || k);
    }
    
    // Stars
    const majorStars = (migP.majorStars || []).map(s => {
      const parts = [s.name];
      if (s.brightness) parts.push(s.brightness);
      if (s.mutagen) parts.push('生年' + s.mutagen);
      return parts.join('');
    });
    
    const adjStars = (migP.adjectiveStars || []).map(s => s.name);
    const minorStars = (migP.minorStars || []).map(s => s.name);
    
    // Decadal info
    const decadal = migP.decadal || {};
    
    results.push({
      id: c.id,
      name: c.name,
      group: c.group,
      birthday: c.birthday,
      gender: c.gender,
      birthTime: c.birthTime,
      birthTimeText: c.birthTimeText,
      migration: {
        heavenlyStem: migP.heavenlyStem,
        earthlyBranch: migP.earthlyBranch,
        isOriginalPalace: migP.isOriginalPalace || false,
        isBodyPalace: migP.isBodyPalace || false,
        majorStars,
        minorStars,
        adjStars,
        birthMutations: mutations_hitting_migration,
        selfMutations: self_mutations,
        changsheng12: migP.changsheng12 || '',
        decadal: decadal.range ? `${decadal.range[0]}-${decadal.range[1]}` : '',
      }
    });
    
    console.log(`[${c.id}] ${c.name}: ${majorStars.join(',')} | 生年:${mutations_hitting_migration.map(m=>m.type).join(',')} | 自化:${self_mutations.join(',')} | 来因:${migP.isOriginalPalace}`);
    
  } catch (e) {
    console.error(`[${c.id}] ${c.name}: ERROR - ${e.message}`);
  }
}

writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
console.log(`\nDone! ${results.length} cases written to ${OUT_PATH}`);
