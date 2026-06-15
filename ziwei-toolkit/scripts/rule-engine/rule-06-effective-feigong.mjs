// Rule 6: 有效飞宫的判断 — "飞宫遇生年"法则 + 撞球理论
import { getFeigong, getBirthMutagens, getPalace, MUTAGEN_TYPES, isClash } from './helpers.mjs';

/**
 * Check 有效飞宫判断
 * A feigong is "effective" (有力量) only when its destination hits a birth mutagen
 * Six major ji (六大忌) are always effective
 * 撞球理论: when feigong and birth mutagen hit the same palace
 */
export function checkEffectiveFeigong(chart) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);
  const bmMap = {}; // palaceIndex → [{type, star}]
  for (const m of bm) bmMap[m.palaceIndex] = [...(bmMap[m.palaceIndex] || []), m];

  const allFeigong = [];
  const effective = [];
  const ineffective = [];
  const collisions = [];
  const majorJi = [];

  for (const p of palaces) {
    const fg = getFeigong(p);
    for (const f of fg) {
      allFeigong.push(f);
      const hit = bmMap[f.toIndex] || [];

      // 六大忌: birth ji at destination = major impact
      const hitJi = hit.some(h => h.type === '忌');
      if (hitJi) {
        majorJi.push({ feigong: f, birthJi: hit.find(h => h.type === '忌') });
      }

      // 撞球: feigong type matches hit type at destination
      const exactHit = hit.filter(h => h.type === f.type);
      if (exactHit.length > 0) {
        collisions.push({ feigong: f, hit: exactHit });
      }

      if (hit.length > 0) {
        effective.push({ feigong: f, hits: hit });
      } else {
        ineffective.push(f);
      }
    }
  }

  return {
    hit: effective.length > 0,
    details: `${allFeigong.length}条飞宫中，${effective.length}条有效(遇生年)，${majorJi.length}条为六大忌，${collisions.length}条撞球`
      + (ineffective.length > 0 ? `；${ineffective.length}条无效飞宫(无生年承接)` : ''),
    summary: {
      total: allFeigong.length,
      effective: effective.length,
      ineffective: ineffective.length,
      majorJi: majorJi.length,
      collisions: collisions.length,
    },
    effectiveFeigong: effective.map(e => ({
      from: `${e.feigong.fromPalace}→${e.feigong.toPalace}`,
      type: e.feigong.type,
      hits: e.hits.map(h => `生年${h.star}化${h.type}在${h.palaceName}`),
    })),
    majorJi: majorJi.map(mj => ({
      path: `${mj.feigong.fromPalace}化忌→${mj.feigong.toPalace}`,
      birthJi: `生年${mj.birthJi.star}化忌`,
      severity: '重大',
    })),
    collisions: collisions.map(c => ({
      path: `${c.feigong.fromPalace}化${c.feigong.type}→${c.feigong.toPalace}`,
      match: `${c.hit[0].type}撞${c.hit[0].type}（撞球）`,
    })),
  };
}
