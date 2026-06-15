// Rule 1: 四化人格特质 — Birth mutagen personality analysis
import { getBirthMutagens, getPalace, PALACE_NAMES, YIN_PALACES, YANG_PALACES } from './helpers.mjs';

// Personality traits for each mutagen type
const MUTAGEN_PERSONALITY = {
  '禄': { trait: '圆融亲和型', desc: '随缘自在，人际缘佳，善于借力使力；但易懒散、缺乏主见', positive: '人缘好、乐观、慷慨、随和', negative: '贪图安逸、缺乏原则、易被利用' },
  '权': { trait: '掌控主导型', desc: '强势主动，追求权力与掌控，目标导向；但易刚愎自用、人际关系紧张', positive: '领导力强、果断、有担当、专业精湛', negative: '霸道、好斗、孤傲、不懂变通' },
  '科': { trait: '文雅清秀型', desc: '斯文有礼，注重名声形象，善于修饰表达；但易虚伪、过度在意他人眼光', positive: '温和有礼、聪明好学、品位高雅', negative: '爱面子、矫情、优柔寡断、名过于实' },
  '忌': { trait: '执着收纳型', desc: '认真负责，收纳执着，注重细节累积；但易焦虑、纠结放不下、自我设限', positive: '认真负责、执着坚毅、专一深情', negative: '固执、焦虑、计较、自我折磨' },
};

// Palace domains for personality expression
const PALACE_DOMAIN = {
  '命宫': '自我展现',
  '兄弟': '手足关系与早期人际',
  '夫妻': '伴侣关系与情感模式',
  '子女': '创造力与子息缘',
  '财帛': '金钱态度与理财方式',
  '疾厄': '身体感知与情绪底色',
  '迁移': '社会形象与对外表现',
  '交友': '朋友交往与团队角色',
  '官禄': '事业风格与工作态度',
  '田宅': '家庭氛围与内在安全感',
  '福德': '精神世界与人生享受',
  '父母': '长辈关系与学识涵养',
};

/**
 * Check 四化人格特质
 * @param {Object} chart - serialized chart
 * @returns {{ hit: boolean, details: string, personality: Object }}
 */
export function checkSihuaPersonality(chart) {
  const bm = getBirthMutagens(chart);
  const result = [];

  for (const m of bm) {
    const trait = MUTAGEN_PERSONALITY[m.type];
    const domain = PALACE_DOMAIN[m.palaceName] || m.palaceName;
    const yinYang = YIN_PALACES.has(m.palaceName) ? '阴(精神面)' : '阳(物质面)';

    result.push({
      mutagen: m.type,
      star: m.star,
      palace: m.palaceName,
      trait: trait.trait,
      domain,
      yinYang,
      desc: trait.desc,
      positive: trait.positive,
      negative: trait.negative,
    });
  }

  return {
    hit: result.length > 0,
    details: result.length > 0
      ? `命盘${result.length}个生年四化，形成${result.map(r => r.trait).join('+')}复合人格`
      : '无生年四化数据',
    personalities: result,
  };
}
