// Rule 16: 生肖法 — Zodiac six-relatives location method
// 四步严格顺序：分男女定星类→查生年四化本对宫→由体入用→平方找用神
// 三大应用：生时校正、六亲个性命运、贵人讨债识别
import { getBirthMutagens, getFeigong, getSelfMutagens, getPalace, MUTAGEN_TYPES, oppositePalaceIndex, PALACE_NAMES, zodiacBranchIndex, findPalaceByBranch } from './helpers.mjs';

// Male stars (男星) and Female stars (女星)
const MALE_STARS = new Set(['太阳', '天机', '天同', '天梁', '贪狼', '武曲']);
const FEMALE_STARS = new Set(['太阴', '巨门', '天相', '紫微', '破军']);

/**
 * Check 生肖法 — Locate six-relative using zodiac
 * @param {Object} chart - serialized chart
 * @param {Object} [relative] - { zodiac: '鼠', gender: 'male'|'female', relation: '父'|'母'|'兄弟'|... }
 */
export function checkShengXiaoMethod(chart, relative) {
  const palaces = chart.palaces || [];
  const bm = getBirthMutagens(chart);
  const zIdx = zodiacBranchIndex(chart.zodiac);

  // Step 0: Find zodiac palace
  const zodiacPalace = findPalaceByBranch(chart, ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][zIdx]);
  const zodiacPalaceName = zodiacPalace?.name || '未找到';

  // If no relative specified, return base zodiac mapping
  if (!relative) {
    return {
      hit: true,
      details: `生肖${chart.zodiac}(${['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][zIdx]})位在${zodiacPalaceName}`,
      zodiacPalace: zodiacPalaceName,
      zodiacBranch: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'][zIdx],
      zodiacIndex: zIdx,
      birthMutagens: bm.map(m => ({
        type: m.type,
        star: m.star,
        palace: m.palaceName,
        isMaleStar: MALE_STARS.has(m.star),
        isFemaleStar: FEMALE_STARS.has(m.star),
      })),
    };
  }

  // Step 1: 分男女定星类
  const targetStars = relative.gender === 'male' ? MALE_STARS : FEMALE_STARS;

  // Step 2: 查生年四化本对宫 → find birth mutagen stars matching gender + zodiac
  const matchingBm = bm.filter(m => targetStars.has(m.star));

  // Step 3: 由体入用 (权转权/科转科/禄转禄/忌转忌)
  // From matching birth mutagen palace, fly the same type
  const tiToYong = [];
  for (const mb of matchingBm) {
    if (mb.palaceIndex == null) continue;
    const srcPalace = palaces[mb.palaceIndex];
    if (!srcPalace) continue;
    const fg = getFeigong(srcPalace);
    const sameFg = fg.filter(f => f.type === mb.type);
    for (const f of sameFg) {
      tiToYong.push({
        from: mb,
        path: `${mb.palaceName}(${mb.star}化${mb.type})→${f.toPalace}`,
        toPalace: f.toPalace,
        toIndex: f.toIndex,
        type: mb.type,
      });
    }
  }

  // Step 4: 平方找用神 — check for self-mutagen at destinations
  const yongShen = [];
  for (const tty of tiToYong) {
    const dest = palaces[tty.toIndex];
    if (!dest) continue;
    const sm = getSelfMutagens(dest);
    if (sm.includes(tty.type)) {
      yongShen.push({
        ...tty,
        selfMutagen: sm,
        yongShenPalace: dest.name,
        description: `${tty.path}（平方：自化${tty.type}）→用神在${dest.name}`,
      });
    }
  }

  // Find which step we reached
  const steps = [];
  steps.push({ step: 1, name: '分男女定星类', result: `${relative.gender === 'male' ? '男' : '女'}星: ${[...targetStars].join('/')}` });
  steps.push({ step: 2, name: '查生年四化', result: matchingBm.length > 0 ? `${matchingBm.length}处匹配: ${matchingBm.map(m => `${m.star}化${m.type}在${m.palaceName}`).join(', ')}` : '无匹配' });
  steps.push({ step: 3, name: '由体入用', result: tiToYong.length > 0 ? `${tiToYong.length}条路径` : '无路径' });
  steps.push({ step: 4, name: '平方找用神', result: yongShen.length > 0 ? `${yongShen.length}处用神定位` : '未找到用神(可能需更高级手法)' });

  const found = yongShen.length > 0;
  const partial = !found && tiToYong.length > 0;

  return {
    hit: found || partial,
    details: found ? `生肖法定位${relative.relation || '六亲'}用神：${yongShen.map(y => y.yongShenPalace).join(',')}`
             : partial ? `生肖法定位${relative.relation || '六亲'}：前3步完成，第4步未找到平方→需高级手法` : '未找到六亲用神',
    steps,
    matchingBirthMutagens: matchingBm.map(m => ({ star: m.star, type: m.type, palace: m.palaceName })),
    tiToYong,
    yongShen: yongShen.map(y => ({
      star: y.from.star,
      mutagen: y.type,
      path: y.path,
      yongShenPalace: y.yongShenPalace,
      description: y.description,
    })),
    found,
    partial,
  };
}
