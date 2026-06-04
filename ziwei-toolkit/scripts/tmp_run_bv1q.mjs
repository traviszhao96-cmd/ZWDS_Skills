// tmp_run_bv1q.mjs
import { analyze } from './lifedomain-analyzer.mjs';
import { writeFileSync } from 'fs';

const r = analyze({
  name: '1997-12-09 亥时 女',
  gender: 'female',
  birthday: '1997-12-09',
  birthTime: 11,
  birthdayType: 'solar',
  bazi: { yearPillar: '丁丑', monthPillar: '壬子', dayPillar: '乙酉', hourPillar: '丁亥' },
});

writeFileSync(new URL('./tmp_bv1q_analysis.json', import.meta.url), JSON.stringify(r, null, 2), 'utf8');
console.log(JSON.stringify({ basic: r.basic, signals: r.signals }));
console.log('学业:', JSON.stringify(r.recommendations?.studyFields));
console.log('事业:', JSON.stringify(r.recommendations?.careers));
