import {
  MUTAGEN_LABELS,
  getBirthMutagenEntries,
  getMutagedPlacesMap,
  getOppositePalace,
  getSelfMutagedMap,
  serializePalaceRef,
} from './kinship.mjs';

export const SCOPE_LABELS = {
  decadal: '大限',
  age: '小限',
  yearly: '流年',
  monthly: '流月',
  daily: '流日',
  hourly: '流时',
};

export function renderChartText(input, chart, horoscope) {
  const parts = [];

  parts.push('输入');
  parts.push(`  历法: ${input.calendar === 'solar' ? '阳历' : '农历'}`);
  parts.push(`  性别: ${chart.gender}`);
  parts.push(`  出生日期: ${input.date}`);
  parts.push(`  时辰: ${chart.time} (${chart.timeRange}, index ${input.timeIndex})`);
  if (input.calendar === 'lunar') {
    parts.push(`  闰月: ${input.isLeapMonth ? '是' : '否'}`);
  }

  parts.push('');
  parts.push('命盘概览');
  parts.push(`  阳历: ${chart.solarDate}`);
  parts.push(`  农历: ${chart.lunarDate}`);
  parts.push(`  干支: ${chart.chineseDate}`);
  parts.push(`  星座: ${chart.sign}`);
  parts.push(`  生肖: ${chart.zodiac}`);
  parts.push(`  五行局: ${chart.fiveElementsClass}`);
  parts.push(`  命主: ${chart.soul}`);
  parts.push(`  身主: ${chart.body}`);
  parts.push(`  命宫地支: ${chart.earthlyBranchOfSoulPalace}`);
  parts.push(`  身宫地支: ${chart.earthlyBranchOfBodyPalace}`);

  parts.push('');
  parts.push('十二宫');
  chart.palaces.forEach((palace, index) => {
    parts.push(renderPalaceLine(palace, index + 1));
  });

  if (horoscope) {
    parts.push('');
    parts.push('运限');
    parts.push(`  参考阳历: ${horoscope.solarDate}`);
    parts.push(`  参考农历: ${horoscope.lunarDate}`);
    Object.entries(SCOPE_LABELS).forEach(([scopeKey, label]) => {
      const line = renderHoroscopeScope(horoscope, scopeKey, label);
      parts.push(...line);
    });
  }

  return parts.join('\n');
}

export function serializeChart(chart) {
  return {
    gender: chart.gender,
    solarDate: chart.solarDate,
    lunarDate: chart.lunarDate,
    chineseDate: chart.chineseDate,
    time: chart.time,
    timeRange: chart.timeRange,
    sign: chart.sign,
    zodiac: chart.zodiac,
    earthlyBranchOfSoulPalace: chart.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: chart.earthlyBranchOfBodyPalace,
    soul: chart.soul,
    body: chart.body,
    fiveElementsClass: chart.fiveElementsClass,
    birthMutagens: getBirthMutagenEntries(chart),
    palaces: chart.palaces.map((palace) => ({
      index: palace.index,
      name: palace.name,
      isBodyPalace: palace.isBodyPalace,
      isOriginalPalace: palace.isOriginalPalace,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      oppositePalace: serializePalaceRef(chart, getOppositePalace(chart, palace)),
      mutagedPlaces: getMutagedPlacesMap(chart, palace),
      selfMutaged: getSelfMutagedMap(chart, palace),
      majorStars: serializeStars(palace.majorStars),
      minorStars: serializeStars(palace.minorStars),
      adjectiveStars: serializeStars(palace.adjectiveStars),
      changsheng12: palace.changsheng12,
      boshi12: palace.boshi12,
      jiangqian12: palace.jiangqian12,
      suiqian12: palace.suiqian12,
      decadal: palace.decadal,
      ages: palace.ages,
    })),
  };
}

export function serializeHoroscope(horoscope) {
  return {
    solarDate: horoscope.solarDate,
    lunarDate: horoscope.lunarDate,
    scopes: Object.fromEntries(
      Object.keys(SCOPE_LABELS).map((scopeKey) => [
        scopeKey,
        serializeHoroscopeScope(horoscope, scopeKey),
      ]),
    ),
  };
}

function renderPalaceLine(palace, order) {
  const tags = [];
  if (palace.isBodyPalace) tags.push('身宫');
  if (palace.isOriginalPalace) tags.push('来因宫');
  const tagText = tags.length ? ` [${tags.join(' / ')}]` : '';
  const range = palace.decadal?.range ? `${palace.decadal.range[0]}-${palace.decadal.range[1]}` : '未知';
  const palaceName = displayPalaceName(palace.name);

  return [
    `${order}. ${palaceName}（${palace.heavenlyStem}${palace.earthlyBranch}）${tagText} 大限 ${range}`,
    `   主星: ${formatStars(palace.majorStars)}`,
    `   辅星: ${formatStars(palace.minorStars)}`,
    `   杂耀: ${formatStars(palace.adjectiveStars)}`,
    `   12长生/博士/将前/岁前: ${palace.changsheng12} / ${palace.boshi12} / ${palace.jiangqian12} / ${palace.suiqian12}`,
    `   小限岁数: ${palace.ages.join(', ')}`,
  ].join('\n');
}

function renderHoroscopeScope(horoscope, scopeKey, label) {
  const scopeData = horoscope[scopeKey];
  if (!scopeData) {
    return [`  ${label}: 无数据`];
  }

  const activePalace = horoscope.palace('命宫', scopeKey);
  const mutagen = formatMutagen(scopeData.mutagen);
  const activePalaceName = activePalace ? displayPalaceName(activePalace.name) : '未知';
  return [
    `  ${label}: 命宫落在${activePalaceName}（${scopeData.heavenlyStem}${scopeData.earthlyBranch}）`,
    `    四化: ${mutagen}`,
  ];
}

function formatStars(stars = []) {
  if (!stars.length) {
    return '无';
  }
  return stars
    .map((star) => {
      const extras = [];
      if (star.brightness) extras.push(star.brightness);
      if (star.mutagen) extras.push(`化${star.mutagen}`);
      return extras.length ? `${star.name}(${extras.join(',')})` : star.name;
    })
    .join('、');
}

function formatMutagen(mutagen = []) {
  if (!mutagen.length) {
    return '无';
  }
  return mutagen
    .map((star, index) => `${MUTAGEN_LABELS[index] ?? `化${index + 1}`}:${star}`)
    .join('，');
}

function displayPalaceName(name) {
  return name.endsWith('宫') ? name : `${name}宫`;
}

function serializeStars(stars = []) {
  return stars.map((star) => ({
    name: star.name,
    type: star.type,
    scope: star.scope,
    brightness: star.brightness ?? '',
    mutagen: star.mutagen ?? '',
  }));
}

function serializeHoroscopeScope(horoscope, scopeKey) {
  const scopeData = horoscope[scopeKey];
  if (!scopeData) {
    return undefined;
  }

  const activePalace = horoscope.palace('命宫', scopeKey);
  return {
    label: SCOPE_LABELS[scopeKey],
    index: scopeData.index,
    heavenlyStem: scopeData.heavenlyStem,
    earthlyBranch: scopeData.earthlyBranch,
    mutagen: Object.fromEntries(
      scopeData.mutagen.map((starName, index) => [MUTAGEN_LABELS[index] ?? String(index), starName]),
    ),
    activePalace: activePalace
      ? {
          index: activePalace.index,
          name: activePalace.name,
          heavenlyStem: activePalace.heavenlyStem,
          earthlyBranch: activePalace.earthlyBranch,
        }
      : undefined,
  };
}
