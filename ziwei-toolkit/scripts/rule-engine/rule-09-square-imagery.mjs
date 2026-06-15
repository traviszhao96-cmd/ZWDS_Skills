// Rule 9: 平方象意取象 — Same star, same image: birth + self mutagen energy cycle
import { getBirthMutagens, getSelfMutagens, getPalace, MUTAGEN_TYPES } from './helpers.mjs';

/**
 * Check 平方象意取象
 * Detects when a star has both birth mutagen and self-mutagen (自化)
 * Same star + same image = squared energy → multidimensional interpretation
 */
export function checkSquareImagery(chart) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);
  const squares = [];

  for (const p of palaces) {
    const sm = getSelfMutagens(p);
    if (sm.length === 0) continue;

    const stars = [...(p.majorStars || []), ...(p.minorStars || [])];
    for (const s of stars) {
      // Star has both a birth mutagen and self-mutagen in this palace
      const starBm = bm.find(m => m.palaceIndex === p.index && m.star === s.name);

      for (const smType of sm) {
        squares.push({
          star: s.name,
          palace: p.name,
          birthMutagen: starBm ? `${starBm.type}` : null,
          selfMutagen: smType,
          isSameType: starBm?.type === smType,
          category: starBm?.type === smType
            ? `同象平方(${starBm.type}+自化${smType})→能量共振放大`
            : starBm
            ? `异象平方(生年${starBm.type}+自化${smType})→多维度复合`
            : `纯自化平方(自化${smType})→后天自调`,
        });
      }
    }
  }

  const sameTypeCount = squares.filter(s => s.isSameType).length;
  const diffTypeCount = squares.filter(s => !s.isSameType && s.birthMutagen).length;
  const pureSelfCount = squares.filter(s => !s.birthMutagen).length;

  return {
    hit: squares.length > 0,
    details: `${squares.length}处平方象意：${sameTypeCount}处同象共振，${diffTypeCount}处异象复合，${pureSelfCount}处纯自化`,
    squares,
    summary: {
      total: squares.length,
      sameType: sameTypeCount,
      diffType: diffTypeCount,
      pureSelf: pureSelfCount,
    },
    interpretation: sameTypeCount >= 2 ? '多个同象平方→能量共振强烈，对应领域波动大'
                   : squares.length === 0 ? '无平方象意→能量较稳定，单一维度表达'
                   : '有平方象意→存在能量循环与多维表达',
  };
}
