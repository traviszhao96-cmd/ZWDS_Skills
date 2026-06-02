// tmp_run_zhao.mjs
import { analyze } from './lifedomain-analyzer.mjs';
import { writeFileSync } from 'fs';

const r = analyze({
  name: '赵',
  gender: 'male',
  birthday: '1996-03-19',
  birthTime: 1,
  birthdayType: 'solar',
  bazi: { yearPillar: '丙子', monthPillar: '辛卯', dayPillar: '乙卯', hourPillar: '丁丑' },
});

writeFileSync(new URL('./tmp_zhao_analysis.json', import.meta.url), JSON.stringify(r, null, 2), 'utf8');
console.log('Written. Basic:', JSON.stringify(r.basic));
console.log('Signals:', JSON.stringify(r.signals));
console.log('忌冲:', JSON.stringify(r.jiChong));
console.log('三八:', JSON.stringify(r.sanBa));
