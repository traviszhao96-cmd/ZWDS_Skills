import { astro } from 'iztro';

export const MUTAGEN_LABELS = ['禄', '权', '科', '忌'];
export const ZODIAC_BRANCHES = {
  鼠: '子',
  牛: '丑',
  虎: '寅',
  兔: '卯',
  龙: '辰',
  蛇: '巳',
  马: '午',
  羊: '未',
  猴: '申',
  鸡: '酉',
  狗: '戌',
  猪: '亥',
};

const MUTAGEN_INDEX = new Map(MUTAGEN_LABELS.map((label, index) => [label, index]));
const THIRD_GATE_MUTAGEN = new Map([
  ['忌', '禄'],
  ['权', '科'],
  ['科', '权'],
]);

const RELATIVE_BODY_STARS = {
  male: ['太阳', '天机', '天同', '天梁', '贪狼', '武曲'],
  female: ['太阴', '巨门', '天相', '紫微', '破军'],
};

export function buildChart(input) {
  return astro.withOptions({
    type: input.calendar,
    dateStr: input.date,
    timeIndex: input.timeIndex,
    gender: input.gender,
    isLeapMonth: input.isLeapMonth,
    fixLeap: input.fixLeap,
    language: input.language,
  });
}

export function getBoundPalace(chart, palaceOrNameOrIndex) {
  if (palaceOrNameOrIndex === undefined || palaceOrNameOrIndex === null) {
    return undefined;
  }

  if (typeof palaceOrNameOrIndex === 'number' || typeof palaceOrNameOrIndex === 'string') {
    return chart.palace(palaceOrNameOrIndex);
  }

  return chart.palace(palaceOrNameOrIndex.name);
}

export function getOppositePalace(chart, palaceOrNameOrIndex) {
  const palace = getBoundPalace(chart, palaceOrNameOrIndex);
  if (!palace) {
    return undefined;
  }

  return chart.palace((palace.index + 6) % 12);
}

export function serializePalaceRef(chart, palaceOrNameOrIndex) {
  const palace = getBoundPalace(chart, palaceOrNameOrIndex);
  if (!palace) {
    return undefined;
  }

  return {
    index: palace.index,
    name: palace.name,
    heavenlyStem: palace.heavenlyStem,
    earthlyBranch: palace.earthlyBranch,
  };
}

export function getMutagedPlace(chart, palaceOrNameOrIndex, mutagen) {
  const palace = getBoundPalace(chart, palaceOrNameOrIndex);
  if (!palace) {
    return undefined;
  }

  const index = MUTAGEN_INDEX.get(mutagen);
  if (index === undefined) {
    return undefined;
  }

  return getBoundPalace(chart, palace.mutagedPlaces()[index]);
}

export function getMutagedPlacesMap(chart, palaceOrNameOrIndex) {
  return Object.fromEntries(
    MUTAGEN_LABELS.map((label) => [label, serializePalaceRef(chart, getMutagedPlace(chart, palaceOrNameOrIndex, label))]),
  );
}

export function getSelfMutagedMap(chart, palaceOrNameOrIndex) {
  const palace = getBoundPalace(chart, palaceOrNameOrIndex);
  if (!palace) {
    return {
      any: false,
      禄: false,
      权: false,
      科: false,
      忌: false,
    };
  }

  const result = Object.fromEntries(MUTAGEN_LABELS.map((label) => [label, palace.selfMutaged(label)]));
  return {
    any: MUTAGEN_LABELS.some((label) => result[label]),
    ...result,
  };
}

export function getBirthMutagenEntries(chart) {
  const entries = {};

  chart.palaces.forEach((palace) => {
    for (const star of [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]) {
      if (!star.mutagen || entries[star.mutagen]) {
        continue;
      }

      entries[star.mutagen] = {
        star: star.name,
        palace: serializePalaceRef(chart, palace),
        oppositePalace: serializePalaceRef(chart, getOppositePalace(chart, palace)),
      };
    }
  });

  return Object.fromEntries(MUTAGEN_LABELS.map((label) => [label, entries[label]]));
}

export function getRelativeCandidates(chart, sex) {
  const normalizedSex = normalizeRelativeSex(sex);
  const candidates = [];

  for (const starName of RELATIVE_BODY_STARS[normalizedSex]) {
    const star = chart.star(starName);
    if (!star?.mutagen) {
      continue;
    }
    if (starName === '武曲' && star.mutagen !== '权') {
      continue;
    }

    candidates.push({
      star: starName,
      mutagen: star.mutagen,
      rule: '生年四化',
    });
  }

  const lianzhen = chart.star('廉贞');
  if (normalizedSex === 'male' && lianzhen?.mutagen === '禄') {
    candidates.push({
      star: '廉贞',
      mutagen: '禄',
      rule: '特殊规则',
    });
  }
  if (normalizedSex === 'female' && lianzhen?.mutagen === '忌') {
    candidates.push({
      star: '廉贞',
      mutagen: '忌',
      rule: '特殊规则',
    });
  }

  return candidates;
}

export function traceRelative(chart, relative) {
  const sex = normalizeRelativeSex(relative.sex);
  const branch = ZODIAC_BRANCHES[relative.zodiac];
  if (!branch) {
    throw new Error(`无法识别生肖: ${relative.zodiac}`);
  }

  const candidates = getRelativeCandidates(chart, sex).map((candidate) =>
    traceCandidate(chart, candidate, branch),
  );
  const bestCandidate = [...candidates].sort(compareCandidates)[0];

  return {
    label: relative.label,
    sex,
    zodiac: relative.zodiac,
    branch,
    candidates,
    bestCandidate,
    matched: Boolean(bestCandidate?.matched),
  };
}

function traceCandidate(chart, candidate, targetBranch) {
  const star = chart.star(candidate.star);
  if (!star?.mutagen || star.mutagen !== candidate.mutagen) {
    return {
      ...candidate,
      squareDetected: false,
      matched: false,
      matchedGate: undefined,
      score: 0,
      gates: [],
    };
  }

  const gates = [];
  const gate1Palace = getBoundPalace(chart, star.palace());
  gates.push(
    buildGateResult(chart, {
      gate: 1,
      rule: '生年四化本对宫',
      mutagen: candidate.mutagen,
      fromPalace: gate1Palace,
      toPalace: gate1Palace,
      targetBranch,
    }),
  );

  const gate2Palace = getMutagedPlace(chart, gate1Palace, candidate.mutagen);
  gates.push(
    buildGateResult(chart, {
      gate: 2,
      rule: `有体路用 ${candidate.mutagen}转${candidate.mutagen}`,
      mutagen: candidate.mutagen,
      fromPalace: gate1Palace,
      toPalace: gate2Palace,
      targetBranch,
    }),
  );

  const thirdMutagen = THIRD_GATE_MUTAGEN.get(candidate.mutagen);
  if (thirdMutagen) {
    const gate3Palace = getMutagedPlace(chart, gate2Palace, thirdMutagen);
    gates.push(
      buildGateResult(chart, {
        gate: 3,
        rule: thirdMutagen === '禄' ? '禄随忌走' : '权科一组',
        mutagen: thirdMutagen,
        fromPalace: gate2Palace,
        toPalace: gate3Palace,
        targetBranch,
      }),
    );
  }

  const matchedGate = gates.find((gate) => gate.hit);
  return {
    ...candidate,
    squareDetected: gate1Palace ? gate1Palace.selfMutaged(candidate.mutagen) : false,
    matched: Boolean(matchedGate),
    matchedGate: matchedGate?.gate,
    score: scoreCandidate(gates),
    gates,
  };
}

function buildGateResult(chart, payload) {
  const fromPalace = getBoundPalace(chart, payload.fromPalace);
  const toPalace = getBoundPalace(chart, payload.toPalace);
  const oppositePalace = getOppositePalace(chart, toPalace);
  const hitPalace =
    toPalace?.earthlyBranch === payload.targetBranch
      ? toPalace
      : oppositePalace?.earthlyBranch === payload.targetBranch
        ? oppositePalace
        : undefined;

  return {
    gate: payload.gate,
    rule: payload.rule,
    mutagen: payload.mutagen,
    fromPalace: serializePalaceRef(chart, fromPalace),
    fromStem: fromPalace?.heavenlyStem,
    toPalace: serializePalaceRef(chart, toPalace),
    oppositePalace: serializePalaceRef(chart, oppositePalace),
    hit: Boolean(hitPalace),
    hitPalace: serializePalaceRef(chart, hitPalace),
  };
}

function scoreCandidate(gates) {
  const matchedGate = gates.find((gate) => gate.hit)?.gate;
  if (matchedGate === 1) return 100;
  if (matchedGate === 2) return 70;
  if (matchedGate === 3) return 40;
  return 0;
}

function compareCandidates(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.star.localeCompare(right.star, 'zh-CN');
}

function normalizeRelativeSex(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'male' || normalized === 'm' || normalized === '男') {
    return 'male';
  }
  if (normalized === 'female' || normalized === 'f' || normalized === '女') {
    return 'female';
  }

  throw new Error(`无法识别六亲性别: ${value}`);
}
