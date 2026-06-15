// Rule 4: 身宫深度判断 — Body palace depth analysis
// 身宫落生年忌/离心忌 → 严重程度增加
import { getBodyPalace, getBirthMutagens, getSelfMutagens, hasBirthMutagen, getPalace } from './helpers.mjs';

/**
 * Check 身宫深度判断
 * Body palace location + birth/self ji analysis
 */
export function checkBodyPalaceDepth(chart) {
  const body = getBodyPalace(chart);
  if (!body) {
    return { hit: false, details: '未找到身宫' };
  }

  const bm = getBirthMutagens(chart);
  const sm = getSelfMutagens(body);
  const bodyBm = bm.filter(m => m.palaceIndex === body.index);

  const hasBirthJi = bodyBm.some(m => m.type === '忌');
  const hasCentrifugalJi = sm.includes('忌');
  const jiSeverity = (hasBirthJi && hasCentrifugalJi) ? '严重（生年忌+离心忌双重叠加）' :
                      hasBirthJi ? '较重（生年忌在身宫）' :
                      hasCentrifugalJi ? '中度（离心忌在身宫）' : '无';

  const bodyBmTypes = bodyBm.map(m => m.type);

  return {
    hit: true,
    details: `身宫在${body.name}(${body.heavenlyStem}${body.earthlyBranch})，${jiSeverity === '无' ? '无忌冲' : jiSeverity}`,
    bodyPalace: body.name,
    bodyStem: body.heavenlyStem,
    bodyBranch: body.earthlyBranch,
    birthMutagensHere: bodyBm.map(m => `${m.star}化${m.type}`),
    selfMutagensHere: sm,
    hasBirthJi,
    hasCentrifugalJi,
    severity: jiSeverity,
    warning: (hasBirthJi && hasCentrifugalJi)
      ? '⚠️ 身宫双重忌：后天行为模式被严重限制，易焦虑执着、反复内耗'
      : hasBirthJi
      ? '⚠️ 身宫生年忌：精力投放方向易遇阻碍，需加倍努力'
      : hasCentrifugalJi
      ? '⚡ 身宫离心忌：后天能量有流失倾向，需主动稳固'
      : '✓ 身宫无严重忌冲',
  };
}
