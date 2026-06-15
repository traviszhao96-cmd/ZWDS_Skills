// Rule 8: 化出/化入 — Energy direction: out vs in
// 化出(direction=out): feigong from yin palace to yang palace = energy flowing out
// 化入(direction=in): feigong from yang palace to yin palace = energy flowing in
// Special: same yin-yang type flow is neutral
import { getFeigong, YIN_PALACES, YANG_PALACES, MUTAGEN_TYPES } from './helpers.mjs';

/**
 * Check 化出/化入
 * For every feigong, determine if energy flows out (付出/流失) or in (获得/进入)
 * 禄忌: 化出=损失, 化入=获得
 * 权科: 化出=表现/输出, 化入=吸收/输入
 */
export function checkHuaChuHuaRu(chart) {
  const palaces = chart.palaces || [];
  const flows = [];

  for (const p of palaces) {
    const fg = getFeigong(p);
    for (const f of fg) {
      const fromYin = YIN_PALACES.has(f.fromPalace);
      const toYin = YIN_PALACES.has(f.toPalace);

      // 化出: yin → yang, 化入: yang → yin
      const direction = fromYin && !toYin ? '化出'
                      : !fromYin && toYin ? '化入'
                      : fromYin === toYin ? (fromYin ? '阴→阴(内循环)' : '阳→阳(外循环)') : '?';

      const isChu = direction === '化出';
      const interpretation = isChu
        ? (f.type === '禄' || f.type === '忌'
          ? `${f.fromPalace}化${f.type}出→${f.toPalace}：能量外流/付出`
          : `${f.fromPalace}化${f.type}出→${f.toPalace}：对外表现/输出`)
        : direction === '化入'
        ? (f.type === '禄' || f.type === '忌'
          ? `${f.toPalace}化${f.type}入←${f.fromPalace}：能量流入/获得`
          : `${f.toPalace}化${f.type}入←${f.fromPalace}：吸收/输入`)
        : `${f.fromPalace}↔${f.toPalace}：${direction}`;

      flows.push({
        from: f.fromPalace,
        to: f.toPalace,
        type: f.type,
        direction,
        interpretation,
      });
    }
  }

  const chuCount = flows.filter(f => f.direction === '化出').length;
  const ruCount = flows.filter(f => f.direction === '化入').length;
  const neutral = flows.filter(f => f.direction !== '化出' && f.direction !== '化入').length;

  return {
    hit: flows.length > 0,
    details: `${flows.length}条飞宫：${chuCount}条化出，${ruCount}条化入，${neutral}条中性`
      + (chuCount > ruCount ? '→整体偏付出型' : chuCount < ruCount ? '→整体偏获得型' : '→进出平衡'),
    flows,
    summary: { total: flows.length, huaChu: chuCount, huaRu: ruCount, neutral },
    bias: chuCount > ruCount * 1.5 ? '高度付出型→注意能量损耗'
        : ruCount > chuCount * 1.5 ? '高度获得型→资源汇聚'
        : '基本平衡',
  };
}
