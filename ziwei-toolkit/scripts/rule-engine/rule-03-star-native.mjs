// Rule 3: 星有本宫 — Stars have native palaces; star expression depends on palace stage
import { getStars, getPalace, PALACE_NAMES } from './helpers.mjs';

// Major star native palaces (庙旺落陷 mappings are handled by iztro brightness)
// Star-to-palace affinity: which palace each star "belongs" to
const STAR_NATIVE = {
  '紫微': '官禄',
  '天机': '兄弟',
  '太阳': '交友',
  '武曲': '财帛',
  '天同': '福德',
  '廉贞': '官禄',
  '天府': '财帛',
  '太阴': '田宅',
  '贪狼': '子女',
  '巨门': '父母',
  '天相': '交友',
  '天梁': '父母',
  '七杀': '子女',
  '破军': '夫妻',
};

const STAR_ELEMENT = {
  '紫微': '土', '天机': '木', '太阳': '火', '武曲': '金',
  '天同': '水', '廉贞': '火', '天府': '土', '太阴': '水',
  '贪狼': '木', '巨门': '水', '天相': '水', '天梁': '木',
  '七杀': '金', '破军': '水',
};

/**
 * Check 星有本宫 — Star native palace analysis
 * For each major star, check if it's in its native (本宫) palace
 * and whether its brightness supports its expression
 */
export function checkStarNativePalace(chart) {
  const palaces = chart.palaces || [];
  const findings = [];

  for (const p of palaces) {
    const stars = p.majorStars || [];
    for (const s of stars) {
      const native = STAR_NATIVE[s.name];
      if (!native) continue;

      const isNative = p.name === native;
      const brightness = s.brightness || '';
      const isBright = brightness === '庙' || brightness === '旺';
      const isDim = brightness === '陷' || brightness === '不';

      const assessment = isNative && isBright ? '得位得地→充分发挥' :
                        isNative && isDim ? '得位失地→有力难施' :
                        !isNative && isBright ? '失位得地→跨界发挥' :
                        !isNative && isDim ? '失位失地→能量受限' :
                        isNative ? '在原生宫位' : '不在原生宫位';

      findings.push({
        star: s.name,
        element: STAR_ELEMENT[s.name] || '',
        currentPalace: p.name,
        nativePalace: native,
        isNative,
        brightness,
        assessment,
      });
    }
  }

  const nativeStars = findings.filter(f => f.isNative);
  const foreignStars = findings.filter(f => !f.isNative);
  const dimStars = findings.filter(f => f.brightness === '陷' && f.isNative);

  return {
    hit: findings.length > 0,
    details: `${findings.length}颗主星中，${nativeStars.length}颗在位，${foreignStars.length}颗在外`
      + (dimStars.length ? `；${dimStars.length}颗在位但陷地` : ''),
    findings,
    summary: {
      native: nativeStars.map(f => `${f.star}在${f.currentPalace}(${f.brightness})`),
      foreign: foreignStars.map(f => `${f.star}在${f.currentPalace}→本宫${f.nativePalace}`),
      nativeDim: dimStars.map(f => `${f.star}在${f.currentPalace}${f.brightness}`),
    },
  };
}
