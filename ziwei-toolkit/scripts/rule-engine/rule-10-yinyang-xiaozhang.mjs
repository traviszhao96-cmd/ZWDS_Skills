// Rule 10: 阴阳消长 — Energy add/subtract: feigong + birth mutagen
// 同组相消（禄忌抵消/权科抵消），不同组相加（权忌/禄权等累积）
import { getFeigong, getBirthMutagens, getPalace, MUTAGEN_TYPES } from './helpers.mjs';

// Same group: 禄〈 = mutual cancellation
const SAME_GROUP = new Map([
  ['禄', '忌'], ['忌', '禄'],
  ['权', '科'], ['科', '权'],
]);

/**
 * Check 阴阳消长
 * For each palace with both birth mutagen and feigong destination,
 * apply same-group cancellation / different-group addition
 */
export function checkYinYangXiaoZhang(chart) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);
  const interactions = [];

  for (const p of palaces) {
    // Birth mutagens in this palace
    const bmHere = bm.filter(m => m.palaceIndex === p.index);

    // Feigong that land here
    const fgHere = [];
    for (const src of palaces) {
      const fg = getFeigong(src);
      for (const f of fg) {
        if (f.toIndex === p.index) {
          fgHere.push(f);
        }
      }
    }

    if (bmHere.length === 0 || fgHere.length === 0) continue;

    for (const b of bmHere) {
      for (const f of fgHere) {
        const cancelPartner = SAME_GROUP.get(b.type);
        const isCancel = f.type === cancelPartner;
        const isSame = f.type === b.type;
        const isAdd = !isCancel && !isSame;

        const effect = isCancel ? `消长(抵消)：生年${b.type}+飞宫${f.type}→${b.type === '禄' ? '禄被忌消' : b.type === '忌' ? '忌被禄解' : b.type === '权' ? '权被科化' : '科被权破'}`
                      : isSame ? `叠加(增强)：生年${b.type}+飞宫${b.type}→同象加倍`
                      : `相加(混合)：生年${b.type}+飞宫${f.type}→${b.type}+${f.type}复合`;

        interactions.push({
          palace: p.name,
          birth: `${b.star}化${b.type}`,
          feigong: `${f.fromPalace}化${f.type}入`,
          isCancel,
          isAdd,
          isSame,
          effect,
        });
      }
    }
  }

  const cancels = interactions.filter(i => i.isCancel);
  const adds = interactions.filter(i => i.isAdd);
  const doubles = interactions.filter(i => i.isSame);

  return {
    hit: interactions.length > 0,
    details: `${interactions.length}处阴阳消长：${cancels.length}处抵消，${adds.length}处相加，${doubles.length}处增强`
      + (cancels.length > 0 ? `；⚠️ ${cancels.map(c => c.palace).join(',')}有抵消需关注` : ''),
    interactions,
    summary: { total: interactions.length, cancels: cancels.length, adds: adds.length, doubles: doubles.length },
    criticalCancels: cancels.map(c => ({
      palace: c.palace,
      detail: c.effect,
      severity: c.effect.includes('忌被禄解') ? '吉(忌被化解)'
               : c.effect.includes('禄被忌消') ? '凶(禄被消掉)'
               : c.effect.includes('权被科化') ? '中和(权力被软化)'
               : '凶(科被权力破坏)',
    })),
  };
}
