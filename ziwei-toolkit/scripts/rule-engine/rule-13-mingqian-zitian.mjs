// Rule 13: 命签纸田 — Accident three palaces (意外三宫)
// 四正宫: 命宫, 迁移, 子女, 田宅 = accident/relocation risk zones
// Three energy connection layers + must-not-clash rule
import { getBirthMutagens, getFeigong, getSelfMutagens, getPalace, MUTAGEN_TYPES, oppositePalaceIndex, PALACE_NAMES } from './helpers.mjs';

const FOUR_RIGHT = new Set(['命宫', '迁移', '子女', '田宅']);
const FOUR_RIGHT_INDICES = new Set([0, 6, 3, 9]); // 命=0, 迁=6, 子=3, 田=9

/**
 * Check 命签纸田 (意外三宫)
 * Analyzes the four-right palaces for accident/relocation risk
 */
export function checkMingQianZhiTian(chart) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);

  const fourRight = palaces.filter(p => FOUR_RIGHT.has(p.name));
  const analysis = [];

  for (const p of fourRight) {
    // Layer 1: Birth mutagen connection
    const bmHere = bm.filter(m => m.palaceIndex === p.index);

    // Layer 2: Self mutagen
    const sm = getSelfMutagens(p);

    // Layer 3: Feigong connection - check if other palaces fly ji here
    const fgIncoming = [];
    for (const src of palaces) {
      const fg = getFeigong(src);
      for (const f of fg) {
        if (f.toIndex === p.index) {
          fgIncoming.push(f);
        }
      }
    }

    const hasBirthJi = bmHere.some(m => m.type === '忌');
    const hasSelfJi = sm.includes('忌');
    const hasFeigongJi = fgIncoming.some(f => f.type === '忌');
    const totalJi = (hasBirthJi ? 1 : 0) + (hasSelfJi ? 1 : 0) + (hasFeigongJi ? 1 : 0);

    // Check opposition (冲) — is opposite palace hit by ji?
    const oppIdx = oppositePalaceIndex(p.index);
    const oppPalace = palaces[oppIdx];
    const oppBm = bm.filter(m => m.palaceIndex === oppIdx);
    const oppJi = oppBm.some(m => m.type === '忌');

    const riskLevel = totalJi >= 3 ? '高危' :
                      totalJi >= 2 ? '中危' :
                      totalJi >= 1 ? '低危' : '安全';

    analysis.push({
      palace: p.name,
      birthJis: bmHere.filter(m => m.type === '忌').map(m => `${m.star}化忌`),
      selfJis: sm.includes('忌') ? ['离心忌'] : [],
      feigongJis: fgIncoming.filter(f => f.type === '忌').map(f => `${f.fromPalace}化忌入`),
      totalJi,
      oppositeHasJi: oppJi,
      riskLevel,
      warning: riskLevel === '高危' ? `⚠️ ${p.name}三重忌叠加→重大意外/搬迁/变动风险`
              : riskLevel === '中危' ? `⚡ ${p.name}双重忌→需警惕意外事件`
              : riskLevel === '低危' ? `△ ${p.name}单忌→有小波折` : '✓ 安全',
      isClashed: oppJi ? `⚠️ ${p.name}对宫${oppPalace?.name || ''}有忌冲` : '',
    });
  }

  const highRisk = analysis.filter(a => a.riskLevel === '高危');
  const midRisk = analysis.filter(a => a.riskLevel === '中危');
  const hasClashInRight = analysis.filter(a => a.totalJi > 0);

  return {
    hit: hasClashInRight.length > 0,
    details: `四正宫意外分析：${highRisk.length}高危，${midRisk.length}中危，${hasClashInRight.length - highRisk.length - midRisk.length}低危`
      + (highRisk.length > 0 ? ` ⚠️ 命迁子田有高危信号！` : ''),
    fourRightAnalysis: analysis,
    summary: {
      highRisk: highRisk.map(a => a.palace),
      midRisk: midRisk.map(a => a.palace),
      overallRisk: highRisk.length > 0 ? '高' : midRisk.length > 0 ? '中' : hasClashInRight.length > 0 ? '低' : '安全',
    },
  };
}
