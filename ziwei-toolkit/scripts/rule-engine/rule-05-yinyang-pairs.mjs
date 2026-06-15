// Rule 5: 六组阴阳宫二分 — Six yin-yang palace pairs + four-mutagen yin-yang classification
import { YIN_YANG_PAIRS, YIN_PALACES, YANG_PALACES, getBirthMutagens, MUTAGEN_TYPES } from './helpers.mjs';

// 四化 also have yin-yang: 禄忌为阴(精神), 权科为阳(物质)
const MUTAGEN_YIN = new Set(['禄', '忌']);
const MUTAGEN_YANG = new Set(['权', '科']);

/**
 * Check 六组阴阳宫二分
 * Classifies palaces + mutagens into yin/yang
 */
export function checkYinYangClassification(chart) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);

  // Classify each palace
  const palClass = [];
  for (const p of palaces) {
    const isYin = YIN_PALACES.has(p.name);
    palClass.push({ palace: p.name, type: isYin ? '阴(精神面)' : '阳(物质面)', isYin });
  }

  // Six pairs analysis
  const pairs = YIN_YANG_PAIRS.map(pair => {
    const yinP = getPalaceByName(palaces, pair.yin);
    const yangP = getPalaceByName(palaces, pair.yang);
    const yinBm = bm.filter(m => m.palaceName === pair.yin);
    const yangBm = bm.filter(m => m.palaceName === pair.yang);
    const yinScore = yinBm.length;
    const yangScore = yangBm.length;

    const balance = yinScore > yangScore ? '阴盛(精神面强)'
                  : yangScore > yinScore ? '阳盛(物质面强)'
                  : yinScore === 0 && yangScore === 0 ? '双空'
                  : '平衡';

    return { yin: pair.yin, yang: pair.yang, yinSeq: yinScore, yangSeq: yangScore, balance };
  });

  // Mutagen yin-yang
  const mutClass = bm.map(m => ({
    mutagen: m.type,
    star: m.star,
    palace: m.palaceName,
    yinYang: MUTAGEN_YIN.has(m.type) ? '阴(禄忌为阴)' : '阳(权科为阳)',
  }));

  const yinMuts = mutClass.filter(m => MUTAGEN_YIN.has(m.mutagen)).length;
  const yangMuts = mutClass.filter(m => MUTAGEN_YANG.has(m.mutagen)).length;

  return {
    hit: true,
    details: `六组阴阳宫：${pairs.filter(p => p.balance !== '双空' && p.balance !== '平衡').length}组不平衡`
      + `；四化：${yinMuts}阴${yangMuts}阳→${yinMuts > yangMuts ? '偏精神面' : yinMuts < yangMuts ? '偏物质面' : '阴阳均衡'}`,
    pairs,
    mutagens: mutClass,
    overallBias: yinMuts > yangMuts ? '整体偏向精神面(内在世界)' :
                 yinMuts < yangMuts ? '整体偏向物质面(外在成就)' : '阴阳均衡',
  };
}

function getPalaceByName(palaces, name) {
  return palaces.find(p => p.name === name) || null;
}
