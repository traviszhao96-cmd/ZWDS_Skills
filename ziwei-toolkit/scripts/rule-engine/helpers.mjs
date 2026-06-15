// Shared helpers for ZWDS rule engine
// All functions are PURE: input chart object → output result

export const PALACE_NAMES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];

export const MUTAGEN_TYPES = ['禄', '权', '科', '忌'];

// Opposite palace (六冲): offset +6 mod 12
export function oppositePalaceIndex(index) {
  return (index + 6) % 12;
}

// Triad palaces (三合): index, index+4, index+8
export function triadIndices(index) {
  return [index, (index + 4) % 12, (index + 8) % 12];
}

// 1-5-9 axis: index, index+4, index+8 (same as triad)
export const axis159 = triadIndices;

// Six yin-yang palace pairs (阴阳宫对)
export const YIN_YANG_PAIRS = [
  { yin: '命宫', yang: '迁移' },
  { yin: '兄弟', yang: '交友' },
  { yin: '夫妻', yang: '官禄' },
  { yin: '子女', yang: '田宅' },
  { yin: '财帛', yang: '福德' },
  { yin: '疾厄', yang: '父母' },
];

// Yin palaces: 命, 兄弟, 夫妻, 子女, 财帛, 疾厄
export const YIN_PALACES = new Set(YIN_YANG_PAIRS.map(p => p.yin));
// Yang palaces: 迁移, 交友, 官禄, 田宅, 福德, 父母
export const YANG_PALACES = new Set(YIN_YANG_PAIRS.map(p => p.yang));

// Four-right palaces (四正宫): 命, 迁移, 子女, 田宅
export const FOUR_RIGHT_PALACES = new Set(['命宫', '迁移', '子女', '田宅']);

// Accident three palaces (意外三宫): 命宫, 迁移, 子女, 田宅 (same as 四正)
export const ACCIDENT_PALACES = FOUR_RIGHT_PALACES;

// Brightness score map
const BRIGHTNESS_SCORE = { '庙': 3, '旺': 2.5, '得': 2, '平': 1.5, '不': 1, '陷': 0.5 };

/** Get a palace by index or name */
export function getPalace(chart, indexOrName) {
  const palaces = chart.palaces || [];
  if (typeof indexOrName === 'number') return palaces[indexOrName];
  return palaces.find(p => p.name === indexOrName);
}

/** Get all birth mutagens as array */
export function getBirthMutagens(chart) {
  const bm = chart.birthMutagens || {};
  const result = [];
  for (const [type, info] of Object.entries(bm)) {
    if (info && info.star) {
      result.push({
        type,
        star: info.star,
        palaceIndex: info.palace?.index,
        palaceName: info.palace?.name,
        oppositeIndex: info.palace?.index != null ? oppositePalaceIndex(info.palace.index) : null,
        oppositeName: info.palace?.index != null ? PALACE_NAMES[oppositePalaceIndex(info.palace.index)] : null,
      });
    }
  }
  return result;
}

/** Get self-mutagen (自化) for a palace */
export function getSelfMutagens(palace) {
  const sm = palace.selfMutaged || {};
  const result = [];
  for (const [type, value] of Object.entries(sm)) {
    if (value === true && type !== 'any') {
      result.push(type);
    }
  }
  return result;
}

/** Get feigong (飞宫) destinations from a palace: its heavenly stem → mutagedPlaces */
export function getFeigong(palace) {
  const mp = palace.mutagedPlaces || {};
  const result = [];
  for (const [type, dest] of Object.entries(mp)) {
    if (dest && dest.index != null) {
      result.push({
        type,
        fromPalace: palace.name,
        fromIndex: palace.index,
        toPalace: dest.name,
        toIndex: dest.index,
        oppositeIndex: oppositePalaceIndex(dest.index),
        oppositeName: PALACE_NAMES[oppositePalaceIndex(dest.index)],
      });
    }
  }
  return result;
}

/** Check if a palace has a birth mutagen of given type */
export function hasBirthMutagen(chart, palaceIndex, type) {
  const bm = chart.birthMutagens || {};
  const info = bm[type];
  return info && info.palace?.index === palaceIndex;
}

/** Check if a palace has any birth mutagen */
export function hasAnyBirthMutagen(chart, palaceIndex) {
  return MUTAGEN_TYPES.some(t => hasBirthMutagen(chart, palaceIndex, t));
}

/** Check if a star exists in a palace (with optional mutagen check) */
export function hasStar(palace, starName, mutagen) {
  const allStars = [
    ...(palace.majorStars || []),
    ...(palace.minorStars || []),
    ...(palace.adjectiveStars || []),
  ];
  return allStars.some(s => {
    if (s.name !== starName) return false;
    if (mutagen !== undefined) return s.mutagen === mutagen;
    return true;
  });
}

/** Get all stars in a palace with their details */
export function getStars(palace) {
  const result = [];
  for (const s of (palace.majorStars || [])) {
    result.push({ ...s, category: 'major' });
  }
  for (const s of (palace.minorStars || [])) {
    result.push({ ...s, category: 'minor' });
  }
  for (const s of (palace.adjectiveStars || [])) {
    result.push({ ...s, category: 'adjective' });
  }
  return result;
}

/** Get brightness score for a palace */
export function getBrightnessScore(palace) {
  const majors = palace.majorStars || [];
  let score = 0;
  for (const s of majors) {
    score += BRIGHTNESS_SCORE[s.brightness] || 1.5;
  }
  return score;
}

/** Energy concentration for a palace: brightness + star count * 1.5 + mutagen count * 2 */
export function getEnergyScore(chart, palaceIndex) {
  const p = getPalace(chart, palaceIndex);
  if (!p) return 0;
  const bmCount = [...MUTAGEN_TYPES].filter(t => hasBirthMutagen(chart, palaceIndex, t)).length;
  const smCount = getSelfMutagens(p).length;
  const totalMut = bmCount + smCount;
  return getBrightnessScore(p) + (p.majorStars || []).length * 1.5 + totalMut * 2;
}

/** Get the heavenly stem (天干) index for feigong calculation */
const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const HEAVENLY_STEM_INDEX = new Map(HEAVENLY_STEMS.map((s, i) => [s, i]));

export function stemIndex(stem) {
  return HEAVENLY_STEM_INDEX.get(stem) ?? -1;
}

/** Map 天干 → 四化星 (simplified: real chart uses iztro which handles this) */
// This table is for reference; actual feigong is already computed in mutagedPlaces

/** Check if two palaces form a clash (冲) - index difference of 6 */
export function isClash(idx1, idx2) {
  return Math.abs(((idx1 - idx2) % 12 + 12) % 12) === 6;
}

/** Normalize palace name (add 宫 if missing) */
export function normalizeName(name) {
  return name && name.endsWith('宫') ? name : (name + '宫');
}

/** Get body palace info */
export function getBodyPalace(chart) {
  const palaces = chart.palaces || [];
  return palaces.find(p => p.isBodyPalace) || null;
}

/** Get original palace (来因宫) */
export function getOriginalPalace(chart) {
  const palaces = chart.palaces || [];
  return palaces.find(p => p.isOriginalPalace) || null;
}

/** Get zodiac branch from zodiac animal */
const ZODIAC_TO_BRANCH = { '鼠': '子', '牛': '丑', '虎': '寅', '兔': '卯', '龙': '辰', '蛇': '巳', '马': '午', '羊': '未', '猴': '申', '鸡': '酉', '狗': '戌', '猪': '亥' };
const BRANCH_INDEX = new Map(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].map((b, i) => [b, i]));

export function zodiacBranchIndex(zodiac) {
  const branch = ZODIAC_TO_BRANCH[zodiac];
  return branch != null ? BRANCH_INDEX.get(branch) : -1;
}

export function findPalaceByBranch(chart, branch) {
  const palaces = chart.palaces || [];
  return palaces.find(p => p.earthlyBranch === branch);
}
