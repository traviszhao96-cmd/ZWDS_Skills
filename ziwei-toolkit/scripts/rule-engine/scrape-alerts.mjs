// scrape-alerts.mjs - extract meaningful alerts from batch results
import { readFileSync } from 'fs';
const d = JSON.parse(readFileSync('batch-results/batch-results.json','utf8'));

// Only keep hits with real severity/distinction (skip "命中"/"无" trivial hits)
const meaningful = ['高危','中危','严重','较重','中度','雷区','三重','双重','犯太岁','抵消','无忌冲','忌冲','⚠','叠加','失衡','过剩','撞球'];
const seen = new Set();
const keep = [];

for (const c of d) {
  for (const h of (c.hits || [])) {
    const txt = (h.severity || '') + (h.detail || '');
    const key = h.rule + '|' + c.name + '|' + txt.slice(0, 60);
    if (!seen.has(key) && meaningful.some(k => txt.includes(k))) {
      seen.add(key);
      keep.push({ name: c.name, rule: h.rule, detail: h.detail, severity: h.severity });
    }
  }
}

// Group by rule, show top cases
const byRule = {};
for (const k of keep) {
  byRule[k.rule] = (byRule[k.rule] || 0) + 1;
}

console.log('=== Alert counts by rule (non-trivial only) ===');
for (const [rule, cnt] of Object.entries(byRule).sort((a,b)=>b[1]-a[1])) {
  console.log('  ' + cnt + 'x  ' + rule);
}

console.log('\n=== Most notable per-rule examples ===');
const shownRules = new Set();
for (const k of keep) {
  if (shownRules.has(k.rule)) continue;
  shownRules.add(k.rule);
  console.log('[' + k.rule + ']');
  const examples = keep.filter(x => x.rule === k.rule).slice(0, 3);
  for (const e of examples) {
    console.log('  ' + e.name + ': ' + e.detail.slice(0, 140));
  }
}

// Highlight the biggest warnings
console.log('\n=== TOP WARNINGS (severe only) ===');
const severe = keep.filter(k => k.severity?.includes('高危') || k.severity?.includes('严重') || k.severity?.includes('较重'));
for (const k of severe) {
  console.log('\u26A0 [' + k.name + '] ' + k.rule + ': ' + k.detail.slice(0, 160));
}
