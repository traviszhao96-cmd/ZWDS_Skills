#!/usr/bin/env node
// Batch runner: apply all 16 ZWDS rules to all real cases (exclude test cases)
// Output: per-case rule results + summary statistics
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { runAllRules, ALL_RULES } from './rule-engine/index.mjs';

const CASES_PATH = 'C:\\Users\\Administrator\\Documents\\New project\\traviszhao96-cmd\\ShuShuMaser\\src\\data\\cases.generated.ts';
const OUT_DIR = 'C:\\Users\\Administrator\\Documents\\New project\\traviszhao96-cmd\\ZWDS_Skills\\ziwei-toolkit\\scripts\\rule-engine\\batch-results';

// Load cases
const tsContent = readFileSync(CASES_PATH, 'utf-8');
const jsonMatch = tsContent.match(/export const caseRecords: CaseRecord\[\] = (\[[\s\S]*?\])\s+as CaseRecord\[\]/);
if (!jsonMatch) {
  console.error('Failed to parse cases.generated.ts');
  process.exit(1);
}
const allCases = eval('(' + jsonMatch[1] + ')');

// Filter: exclude test cases (评测)
const realCases = allCases.filter(c => c.group !== '评测' && c.birthday);
console.log(`Total: ${allCases.length} cases, Real: ${realCases.length}, Test: ${allCases.length - realCases.length}`);

// Process each case
const allResults = [];
const ruleStats = {}; // ruleId → { hitCount, total }
for (const r of ALL_RULES) {
  ruleStats[r.id] = { id: r.id, name: r.name, layer: r.layer, hitCount: 0, total: 0 };
}

let processed = 0;
let errors = 0;

for (const c of realCases) {
  const label = `${c.id} ${c.name}`;
  try {
    const chart = buildChart({
      date: c.birthday,
      timeIndex: c.birthTime,
      calendar: c.birthdayType === 'lunar' ? 'lunar' : 'solar',
      gender: c.gender,
      isLeapMonth: false,
      fixLeap: true,
    });
    const s = serializeChart(chart);
    const result = await runAllRules(s, c);

    // Update stats
    for (let i = 1; i <= 16; i++) {
      if (result.results[i]) {
        ruleStats[i].total++;
        if (result.results[i].hit) ruleStats[i].hitCount++;
      }
    }

    allResults.push(result);
    processed++;
    if (processed % 10 === 0) console.log(`  Progress: ${processed}/${realCases.length}`);
  } catch (err) {
    errors++;
    console.error(`  ERROR ${label}: ${err.message}`);
    allResults.push({
      caseId: c.id, name: c.name, group: c.group,
      error: err.message,
      results: {},
      summary: { totalRules: 16, hitCount: 0, alerts: [] },
    });
  }
}

// Per-rule summary
const ruleSummary = Object.values(ruleStats).map(rs => ({
  ...rs,
  rate: rs.total > 0 ? ((rs.hitCount / rs.total) * 100).toFixed(1) + '%' : '0%',
}));

// Overall summary
const totalHits = allResults.reduce((s, r) => s + r.summary.hitCount, 0);
const totalPossible = processed * 16;

console.log(`\n=== BATCH COMPLETE ===`);
console.log(`Cases: ${processed} processed, ${errors} errors`);
console.log(`Rule hits: ${totalHits}/${totalPossible} (${(totalHits / totalPossible * 100).toFixed(1)}%)`);
console.log(`\nPer-rule hit rates:`);
ruleSummary.sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));
for (const rs of ruleSummary) {
  console.log(`  ${rs.id.toString().padStart(2)}. ${rs.name.padEnd(18)} [${rs.layer.padEnd(8)}] ${rs.hitCount}/${rs.total} (${rs.rate})`);
}

// Save results
import { mkdirSync } from 'node:fs';
mkdirSync(OUT_DIR, { recursive: true });

const summaryPath = OUT_DIR + '\\batch-summary.json';
writeFileSync(summaryPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  totalCases: allCases.length,
  realCases: realCases.length,
  processed,
  errors,
  totalHits,
  totalPossible,
  hitRate: (totalHits / totalPossible * 100).toFixed(1) + '%',
  perRule: ruleSummary,
}, null, 2), 'utf-8');
console.log(`\nSummary saved: ${summaryPath}`);

// Save per-case results (compact)
const resultsPath = OUT_DIR + '\\batch-results.json';
const compactResults = allResults.map(r => ({
  caseId: r.caseId,
  name: r.name,
  group: r.group,
  error: r.error,
  hits: Object.entries(r.results || {})
    .filter(([, v]) => v.hit)
    .map(([id, v]) => ({
      rule: ALL_RULES[id - 1]?.name,
      detail: v.details,
      severity: v.maxSeverity || v.overallRisk || (v.warning ? '有警告' : '命中'),
    })),
  alerts: r.summary?.alerts || [],
}));
writeFileSync(resultsPath, JSON.stringify(compactResults, null, 2), 'utf-8');
console.log(`Results saved: ${resultsPath}`);

// Print top alerts across all cases
console.log(`\n=== TOP ALERTS ===`);
const allAlerts = compactResults.flatMap(r => r.alerts.map(a => ({ ...a, case: r.name })));
allAlerts.slice(0, 10).forEach(a => {
  console.log(`  [${a.case}] ${a.rule}: ${a.detail}`);
});
