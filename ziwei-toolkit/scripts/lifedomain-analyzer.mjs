// scripts/lifedomain-analyzer.mjs
// 生活域分析引擎 — 基于命盘 + 已有规则，按信号阈值输出八大模块
import { buildChart } from './lib/kinship.mjs';
import { serializeChart } from './lib/chart-output.mjs';

const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ZHI = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
const PALACE_NAMES = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','交友','官禄','田宅','福德','父母'];

// ========== 基础工具 ==========

function parseChart(input) {
  const chart = buildChart({
    date: input.birthday,
    timeIndex: input.birthTime,
    calendar: input.birthdayType === 'lunar' ? 'lunar' : 'solar',
    gender: input.gender,
    isLeapMonth: false,
    fixLeap: true,
  });
  const s = serializeChart(chart);
  const ps = s.palaces;

  // 确定生年天干(从年份天干)
  const yearGan = input.bazi?.yearPillar?.[0] || s.heavenlyStem || '?';

  // 确定来因宫: 生年天干所在的宫位
  let laiyin = null;
  for (const p of ps) {
    if (p.heavenlyStem === yearGan) { laiyin = p; break; }
  }

  // 确定身宫: bodyEarth → 找到该地支所在的宫位
  const bodyPalace = ps.find(p => p.earthlyBranch === s.earthlyBranchOfBodyPalace);
  const shenGong = bodyPalace ? bodyPalace.name : '?';

  // 解析每个宫位
  const palaces = ps.map((p, i) => {
    const major = (p.majorStars || []).map(s => ({
      name: s.name,
      brightness: s.brightness,
      mutagen: s.mutagen || null,
      type: s.type,
    }));
    const minor = (p.minorStars || []).map(s => ({
      name: s.name,
      brightness: s.brightness,
      mutagen: s.mutagen || null,
      type: s.type,
    }));

    const birthMutagens = [];
    for (const t of ['禄','权','科','忌']) {
      if (p.birthMutagen?.type === t) birthMutagens.push(t);
      for (const s of [...major, ...minor]) if (s.mutagen === t) birthMutagens.push(t);
    }
    const selfMutagens = [];
    if (p.selfMutaged) {
      for (const t of ['禄','权','科','忌']) {
        if (p.selfMutaged[t]) selfMutagens.push({ type: t, active: true });
      }
    }

    // 飞宫: mutagedPlaces
    const fly = {};
    if (p.mutagedPlaces) {
      for (const t of ['禄','权','科','忌']) {
        if (p.mutagedPlaces[t]) fly[t] = p.mutagedPlaces[t].name;
      }
    }

    return {
      index: i,
      name: p.name,
      heavenlyStem: p.heavenlyStem,
      earthlyBranch: p.earthlyBranch,
      majorStars: major,
      minorStars: minor,
      birthMutagens,
      selfMutagens,
      fly,
      isBodyPalace: p.isBodyPalace,
      oppositePalace: p.oppositePalace?.name || null,
    };
  });

  const shengNian = {};
  if (s.birthMutagens) {
    for (const t of ['禄','权','科','忌']) {
      if (s.birthMutagens[t]) shengNian[t] = {
        star: s.birthMutagens[t].star,
        palace: s.birthMutagens[t].palace?.name,
      };
    }
  }

  return {
    name: input.name,
    gender: input.gender,
    birthday: input.birthday,
    birthTime: input.birthTime,
    birthdayType: input.birthdayType,
    yearGan,
    lunarBirth: s.lunarDate || s.lunarBirth,
    zodiac: s.zodiac || s.shengxiao,
    wuXingJu: s.fiveElementsClass,
    shenGong,
    laiyinGong: laiyin ? laiyin.name : '?',
    shengNian,
    palaces,
  };
}

// ========== 转宫 ==========
function zhuanGong(palaces, baseIdx) {
  // 以 baseIdx 为新的"命宫(0)", 返回映射: 原索引 → 新太极下的宫名
  const result = {};
  for (let i = 0; i < 12; i++) {
    const newIdx = (i - baseIdx + 12) % 12;
    result[PALACE_NAMES[i]] = PALACE_NAMES[newIdx];
  }
  return result;
}

// 获取以某宫为太极时，另一个原宫在转宫下是什么宫
function getTransformedRole(palaces, baseName, targetName) {
  const baseIdx = palaces.findIndex(p => p.name === baseName);
  const targetIdx = palaces.findIndex(p => p.name === targetName);
  if (baseIdx < 0 || targetIdx < 0) return '?';
  const newIdx = (targetIdx - baseIdx + 12) % 12;
  return PALACE_NAMES[newIdx];
}

// ========== 飞宫分析 ==========
function analyzeFly(palaces, shengNian) {
  const results = [];
  // 由体入用: 坐生年四化的宫位, 用本宫干飞同类型四化
  const snPalaces = {};
  for (const [t, info] of Object.entries(shengNian)) {
    snPalaces[info.palace] = snPalaces[info.palace] || [];
    snPalaces[info.palace].push(t);
  }
  for (const [pname, types] of Object.entries(snPalaces)) {
    const src = palaces.find(p => p.name === pname);
    if (!src) continue;
    for (const t of types) {
      const target = src.fly[t];
      if (target) {
        const targetP = palaces.find(p => p.name === target);
        const hasMatch = targetP && targetP.birthMutagens.some(m => m === t);
        results.push({
          type: '由体入用',
          from: pname,
          to: target,
          hua: t,
          star: shengNian[t].star,
          valid: true,
        });
      }
    }
  }
  return results;
}

// ========== 有效飞宫(由用归体) ==========
function analyzeFeiGong(palaces, shengNian) {
  const results = [];
  const snSet = new Set(Object.values(shengNian).map(x => x.palace));
  for (const src of palaces) {
    for (const [t, targetName] of Object.entries(src.fly)) {
      if (snSet.has(targetName)) {
        results.push({
          type: '飞宫遇生年',
          from: src.name,
          to: targetName,
          hua: t,
          valid: true,
        });
      }
    }
  }
  return results;
}

// ========== 忌冲检测 ==========
function checkJiChong(palaces) {
  const issues = [];
  for (const p of palaces) {
    const hasJi = p.birthMutagens.includes('忌') || p.selfMutagens.some(s => s.type === '忌');
    if (hasJi && p.oppositePalace) {
      issues.push({
        type: '忌冲',
        from: p.name,
        to: p.oppositePalace,
        isBirthJi: p.birthMutagens.includes('忌'),
        isSelfJi: p.selfMutagens.some(s => s.type === '忌'),
      });
    }
  }
  return issues;
}

// ========== 三八为朋 ==========
function checkSanBa(palaces) {
  const jiaoyou = palaces.find(p => p.name === '交友');
  const fuqi = palaces.find(p => p.name === '夫妻');
  if (!jiaoyou || !fuqi) return { broken: false };
  const hasJiChong = jiaoyou.birthMutagens.includes('忌') && jiaoyou.oppositePalace === '夫妻';
  return { broken: hasJiChong, detail: hasJiChong ? '交友忌冲夫妻' : null };
}

// ========== 信号阈值判断 ==========
function checkSignals(chart) {
  const { palaces, shengNian, laiyinGong } = chart;
  const jiChong = checkJiChong(palaces);
  const sanBa = checkSanBa(palaces);

  // Helper: find palace by name
  const P = (name) => palaces.find(p => p.name === name);

  const signals = {
    '身心与生活': {
      high: false,
      reasons: [],
    },
    '事业': { high: false, reasons: [] },
    '财富': { high: false, reasons: [] },
    '家庭·原生': { high: false, reasons: [] },
    '学业': { high: false, reasons: [] },
    '恋爱': { high: false, reasons: [] },
    '婚姻': { high: false, reasons: [] },
    '交友': { high: false, reasons: [] },
    '子女': { high: false, reasons: [] },
  };

  // 身心: 命宫自化忌 / 疾厄忌 / 迁移忌冲命 / 身宫落忌
  if (P('命宫').selfMutagens.some(s => s.type === '忌')) {
    signals['身心与生活'].high = true;
    signals['身心与生活'].reasons.push('命宫自化忌');
  }
  if (P('疾厄').birthMutagens.includes('忌')) {
    signals['身心与生活'].high = true;
    signals['身心与生活'].reasons.push('疾厄生年忌');
  }
  const qyJiChong = jiChong.find(j => j.from === '迁移' && j.to === '命宫');
  if (qyJiChong) {
    signals['身心与生活'].high = true;
    signals['身心与生活'].reasons.push('迁移忌冲命宫');
  }
  if (P(chart.shenGong)?.birthMutagens.includes('忌')) {
    signals['身心与生活'].high = true;
    signals['身心与生活'].reasons.push('身宫落忌');
  }

  // 事业: 官禄生年忌/权 / 官禄忌冲 / 迁移忌冲官禄
  if (P('官禄').birthMutagens.includes('忌') || P('官禄').birthMutagens.includes('权')) {
    signals['事业'].high = true;
    signals['事业'].reasons.push('官禄生年' + (P('官禄').birthMutagens.includes('忌')?'忌':'权'));
  }
  if (jiChong.find(j => j.from === '官禄')) {
    signals['事业'].high = true;
    signals['事业'].reasons.push('官禄忌冲');
  }

  // 财富: 财帛生年忌 / 财帛自化忌 / 禄存被破
  if (P('财帛').birthMutagens.includes('忌')) {
    signals['财富'].high = true;
    signals['财富'].reasons.push('财帛生年忌');
  }
  if (P('财帛').selfMutagens.some(s => s.type === '忌')) {
    signals['财富'].high = true;
    signals['财富'].reasons.push('财帛自化忌');
  }

  // 家庭: 父母/兄弟忌冲 / 火铃+忌
  ['父母','兄弟'].forEach(n => {
    if (P(n).birthMutagens.includes('忌')) {
      signals['家庭·原生'].high = true;
      signals['家庭·原生'].reasons.push(n + '生年忌');
    }
    if (jiChong.find(j => j.from === n || j.to === n)) {
      signals['家庭·原生'].high = true;
      signals['家庭·原生'].reasons.push(n + '被冲');
    }
  });

  // 学业: 文昌化科/忌、文曲科/忌、天机权/科在父母/福德、父母生年忌/自化忌、文昌科@疾厄、巨门忌@福德
  // 文昌/文曲化科/化忌 in 父母/疾厄/命宫
  ['父母','疾厄','命宫','福德'].forEach(n => {
    const p = P(n);
    for (const s of [...p.majorStars, ...p.minorStars]) {
      if ((s.name === '文昌' || s.name === '文曲') && (s.mutagen === '科' || s.mutagen === '忌')) {
        signals['学业'].high = true;
        signals['学业'].reasons.push(s.name+s.mutagen+'@'+n);
      }
    }
  });
  // 天机权/科 in 父母/福德
  ['父母','福德'].forEach(n => {
    const p = P(n);
    for (const s of [...p.majorStars, ...p.minorStars]) {
      if (s.name === '天机' && (s.mutagen === '权' || s.mutagen === '科')) {
        signals['学业'].high = true;
        signals['学业'].reasons.push('天机'+s.mutagen+'@'+n);
      }
    }
  });
  // 父母生年忌
  if (P('父母').birthMutagens.includes('忌')) {
    signals['学业'].high = true;
    signals['学业'].reasons.push('父母生年忌');
  }
  // 父母自化忌
  if (P('父母').selfMutagens.some(s => s.type === '忌')) {
    signals['学业'].high = true;
    signals['学业'].reasons.push('父母自化忌');
  }
  // 巨门忌@福德
  for (const s of [...P('福德').majorStars, ...P('福德').minorStars]) {
    if (s.name === '巨门' && s.mutagen === '忌') {
      signals['学业'].high = true;
      signals['学业'].reasons.push('巨门忌@福德');
    }
  }

  // 恋爱: 子女忌 / 左右化科 / 子女自化忌
  if (P('子女').birthMutagens.includes('忌')) {
    signals['恋爱'].high = true;
    signals['恋爱'].reasons.push('子女生年忌');
  }
  if (P('子女').selfMutagens.some(s => s.type === '忌')) {
    signals['恋爱'].high = true;
    signals['恋爱'].reasons.push('子女自化忌');
  }
  // 左右化科
  for (const p of palaces) {
    for (const s of [...p.majorStars, ...p.minorStars]) {
      if ((s.name === '左辅' || s.name === '右弼') && s.mutagen === '科') {
        signals['恋爱'].high = true;
        signals['恋爱'].reasons.push(s.name + '科@' + p.name);
      }
    }
  }

  // 婚姻: 夫妻忌 / 迁移忌对冲夫妻 / 夫妻自化忌 / 三八为朋破
  if (P('夫妻').birthMutagens.includes('忌')) {
    signals['婚姻'].high = true;
    signals['婚姻'].reasons.push('夫妻生年忌');
  }
  if (P('夫妻').selfMutagens.some(s => s.type === '忌')) {
    signals['婚姻'].high = true;
    signals['婚姻'].reasons.push('夫妻自化忌');
  }
  if (jiChong.find(j => j.from === '迁移' && j.to === '夫妻')) {
    signals['婚姻'].high = true;
    signals['婚姻'].reasons.push('迁移忌冲夫妻');
  }
  if (sanBa.broken) {
    signals['婚姻'].high = true;
    signals['婚姻'].reasons.push('三八为朋破');
  }
  // 左右化科在夫妻
  for (const s of [...P('夫妻').majorStars, ...P('夫妻').minorStars]) {
    if ((s.name === '左辅' || s.name === '右弼') && s.mutagen === '科') {
      signals['婚姻'].high = true;
      signals['婚姻'].reasons.push(s.name + '科@夫妻');
    }
  }

  // 交友: 交友忌冲夫妻 / 兄友线双向忌
  if (jiChong.find(j => j.from === '交友' && j.to === '夫妻')) {
    signals['交友'].high = true;
    signals['交友'].reasons.push('交友忌冲夫妻');
  }
  if (P('兄弟').birthMutagens.includes('忌') && P('交友').birthMutagens.includes('忌')) {
    signals['交友'].high = true;
    signals['交友'].reasons.push('兄友线双向忌');
  }

  // 子女: 子女忌 / 田宅忌冲子女 / 夫妻自化忌
  if (P('子女').birthMutagens.includes('忌')) {
    signals['子女'].high = true;
    signals['子女'].reasons.push('子女生年忌');
  }

  return { signals, jiChong, sanBa };
}

// ========== 方向推荐 ==========
const STAR_FIELDS = {
  '文昌': ['文学','语言','法律','考证','教育'],
  '文曲': ['艺术','音乐','设计','传播','口才类'],
  '天机': ['策划','IT','数学','数据分析','咨询'],
  '巨门': ['法律','辩论','传播','调查','心理学'],
  '天梁': ['教育','医疗','公益','学术研究','管理'],
  '紫微': ['管理','领导力','综合统筹','公共事务'],
  '天府': ['管理','金融','地产','资源整合'],
  '贪狼': ['艺术','娱乐','外交','创意','市场'],
  '七杀': ['军事','工程','技术','实操','创业'],
  '破军': ['创新行业','创业','破坏性革新','新兴领域'],
  '武曲': ['金融','会计','理工','制造业','军事'],
  '廉贞': ['精密技术','电子','司法','刑侦','管制行业'],
  '太阳': ['公共事务','政治','能源','教育','公益'],
  '太阴': ['财务','女性相关','美学','地产','服务'],
  '天同': ['服务','艺术','生活美学','心理学','养老'],
  '天相': ['行政','协调','法律','公关','HR'],
  '左辅': ['辅助型','幕后','咨询','技术辅助'],
  '右弼': ['辅助型','创意','直觉型工作'],
  '天魁/天钺': ['贵人型','需要资源对接的行业'],
  '禄存': ['积累型','稳健行业','地产','金融'],
  '擎羊/火星/铃星/陀罗': [], // 煞星不推荐
};

function recommendFields(palaces) {
  // 学业方向: 父母宫主星 + 疾厄宫主星
  const parents = palaces.find(p => p.name === '父母');
  const health = palaces.find(p => p.name === '疾厄');
  const stars = [
    ...(parents?.majorStars||[]).map(s => s.name),
    ...(health?.majorStars||[]).map(s => s.name),
    ...(parents?.minorStars||[]).filter(s => ['文昌','文曲','左辅','右弼','天魁','天钺','禄存'].includes(s.name)).map(s => s.name),
    ...(health?.minorStars||[]).filter(s => ['文昌','文曲'].includes(s.name)).map(s => s.name),
  ];
  const fields = new Set();
  for (const s of stars) {
    const f = STAR_FIELDS[s];
    if (f) f.forEach(x => fields.add(x));
  }
  return [...fields];
}

function recommendCareers(palaces) {
  // 事业方向: 官禄宫 + 财帛宫 + 命宫主星
  const career = palaces.find(p => p.name === '官禄');
  const wealth = palaces.find(p => p.name === '财帛');
  const ming = palaces.find(p => p.name === '命宫');
  const stars = [
    ...(career?.majorStars||[]).map(s => s.name),
    ...(wealth?.majorStars||[]).map(s => s.name),
    ...(ming?.majorStars||[]).map(s => s.name),
  ];
  const fields = new Set();
  for (const s of stars) {
    const f = STAR_FIELDS[s];
    if (f) f.forEach(x => fields.add(x));
  }
  return [...fields];
}

// ========== 主入口 ==========
export function analyze(input) {
  const chart = parseChart(input);
  const { signals, jiChong, sanBa } = checkSignals(chart);
  const flyResults = analyzeFly(chart.palaces, chart.shengNian);
  const feiGongResults = analyzeFeiGong(chart.palaces, chart.shengNian);

  // 转宫参考
  const zhuan = {};
  for (const base of ['夫妻','子女','财帛','官禄']) {
    const baseIdx = chart.palaces.findIndex(p => p.name === base);
    if (baseIdx >= 0) zhuan[base] = zhuanGong(chart.palaces, baseIdx);
  }

  return {
    basic: {
      name: chart.name,
      gender: chart.gender,
      birthday: chart.birthday,
      birthTime: chart.birthTime,
      lunar: chart.lunarBirth,
      zodiac: chart.zodiac,
      wuXingJu: chart.wuXingJu,
      shenGong: chart.shenGong,
      laiyinGong: chart.laiyinGong,
      yearGan: chart.yearGan,
    },
    shengNian: chart.shengNian,
    palaces: chart.palaces.map(p => ({
      name: p.name,
      heavenlyStem: p.heavenlyStem,
      stars: [...p.majorStars.map(s => s.name+(s.brightness?'('+s.brightness+')':'')+(s.mutagen?s.mutagen:'')), ...p.minorStars.map(s => s.name+(s.mutagen?s.mutagen:''))],
      birthMutagens: p.birthMutagens,
      selfMutagens: p.selfMutagens.map(s => s.type),
      fly: p.fly,
      opposite: p.oppositePalace,
      isBody: p.isBodyPalace,
    })),
    signals,
    jiChong,
    sanBa,
    flyResults,
    feiGongResults,
    zhuan,
    recommendations: {
      studyFields: recommendFields(chart.palaces),
      careers: recommendCareers(chart.palaces),
    },
  };
}

// CLI
if (process.argv[1] && process.argv[1].includes('lifedomain-analyzer')) {
  const input = JSON.parse(process.argv[2] || '{}');
  const result = analyze(input);
  process.stdout.write(JSON.stringify(result, null, 2));
}
