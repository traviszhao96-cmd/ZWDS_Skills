# ANALYSIS_BRIDGE.md — 分析引擎 ↔ 前端展示 桥接规格

> **用途**：AI Agent（知识库管理）与 CodeX（前端开发）之间的共享契约。
> 本文档定义分析输出的数据模型、两级展示结构、规则模块映射。
> **任何一方修改分析逻辑时，必须同步更新此文件。**
>
> 📍 创建：2026-05-28 | 更新：2026-06-02 (左辅右弼体系、有效飞宫、桃花/Again规则)

---

## 1. 统一数据模型（chartModel.ts 输出）

```typescript
// ===== 基础类型 =====

interface ChartModel {
  basicInfo: BasicInfo;
  palaces: Palace[];          // 12 宫
  stars: Star[];              // 所有星曜
  shengNianSiHua: SiHua[];    // 生年四化 (4 条)
  ziHua: ZiHua[];             // 自化 (离心力/向心力)
  daXian: DaXian[];           // 大限
  laiyinGong: GongName;       // 来因宫
}

interface BasicInfo {
  gender: "male" | "female";
  lunarBirth: string;         // 农历生日
  shengxiao: string;          // 生肖
  tianGan: string;            // 生年天干
  shenGong: GongName;         // 身宫
  wuXingJu: string;           // 五行局
}

interface Palace {
  name: GongName;
  diZhi: string;              // 地支 (寅卯辰...)
  daXianRange?: string;       // 大限年龄范围 (叠大限后)
  liuNianDiZhi?: string;      // 流年地支 (叠流年后)
  mainStar: string[];         // 主星列表
  minorStar: string[];        // 辅星列表
  shengNianSiHua?: { star: string; hua: "禄"|"权"|"科"|"忌" };
  ziHua?: { star: string; hua: "禄"|"权"|"科"|"忌"; direction: "离心"|"向心" };
}

type GongName = "命宫"|"兄弟"|"夫妻"|"子女"|"财帛"|"疾厄"|"迁移"|"交友"|"官禄"|"田宅"|"福德"|"父母";
```

---

## 2. 两级分析结构

### 2.1 「一级」总览 → overallAnalysis.ts

盘打开后第一时间展示的全局格局。

```typescript
interface OverallResult {
  // --- 来因宫 ---
  laiyinGong: GongName;
  laiyinInterpretation: string;    // e.g. "来因宫在命宫：为自己而来，主动型命运"

  // --- 四化人格 ---
  personalityType: string;         // "禄-权-科-忌" 组合
  personalityTags: string[];       // ["随和大方", "追求成就", "有计划性", "执念深"]

  // --- 格局评分 ---
  patternScore: number;            // 0-100
  patternLabel: string;            // "上格" | "中上" | "中格" | "中下"

  // --- 能量浓度 ---
  energyScore: number;             // 0-100
  energyQuadrant: string;          // "福报型"|"病灶型"|"隐藏型"|"空白型"

  // --- 关键警示 ---
  alerts: AlertItem[];

  // --- 全局特征 ---
  highlights: string[];            // 3-5 条一句话结论
}

interface AlertItem {
  severity: "high" | "medium" | "low";
  category: string;                // "忌冲"|"过犹不及"|"身宫风险"|"婚姻不正位"|"意外三宫"
  description: string;
  relatedPalaces: GongName[];
}
```

#### overallAnalysis 调用的规则模块

| 规则 | 来源 | 状态 |
|:--|:--|:--|
| 来因宫定位+含义 | methodology.ts → `laiyinGongRule` | ✅ |
| 四化人格特质（科权禄忌型） | `ziwei-knowledge/rules/01-四化人格特质.md` | ✅ |
| 过犹不及皆是病 | 双维度评分体系 | ✅ |
| 格局评分（双维度：星曜配置 + 四化质量） | `2026-05-28` 会话产出 | ✅ |
| 能量浓度扫描（brightness+starCount×1.5+sihua×2） | `batch-energy-v2.mjs` | ✅ |
| 命签纸田（意外三宫：命+迁+田） | MEMORY.md 规则 #2 | 🔧 |
| 六组阴阳宫二分 | 待补 #3 | ❌ |
| 身宫深度判断（三层检查+风险定级） | methodology.ts | ✅ (5/19) |


### 2.2 「二级」宫位详情 → palaceAnalysis.ts

点击某个宫位后展开的详细信息。

```typescript
interface PalaceResult {
  palace: GongName;
  basics: PalaceBasic;             // 本义 + 多层解读
  zhuanGong: ZhuanGongItem[];      // 转宫视角
  siHuaHere: SiHuaEffect[];        // 此宫四化效应
  duiGongRelation: string;         // 对宫关系
  sanFangSiZheng: SanFangInfo;     // 三方四正
  flowAnalysis?: FlowAnalysis;     // 能量流向
  alerts: AlertItem[];             // 此宫相关警示
}

interface PalaceBasic {
  number: number;                  // 1-12
  primary: string;                 // 本义
  layers: { label: string; meaning: string }[];  // 多层解读
  liuNeiWai: "六内" | "六外";
  heTuGroup: string;               // 河图分组名称
}

interface ZhuanGongItem {
  as: GongName;                    // 以什么宫为太极
  meaning: string;                 // e.g. "兄弟宫 = 父母宫的夫妻宫"
  implication: string;             // 实际论命含义
}

interface SiHuaEffect {
  type: "禄"|"权"|"科"|"忌";
  star: string;
  meaning: string;
  severity?: "neutral"|"caution"|"warning";
}

interface SanFangInfo {
  main: GongName;                  // 本宫
  duiGong: GongName;               // 对宫
  left: GongName;                  // 三方左
  right: GongName;                 // 三方右
}
```

---

## 3. 宫位知识映射表（palaceAnalysis 调用）

| # | 宫位 | 完成日期 | 内容 |
|:--|:--|:--|:--|
| 1 | 命宫 | 5/19 | 本义+四层分析法(主星/生年四化/自化/飞宫)+来因宫命宫联动 |
| 2 | 兄弟宫 | 5/19 + 5/28 | 六外宫/兄友线/二七同道/现金流位/以平辈方式相处的父母 |
| 3 | 夫妻宫 | 5/19 | 三重身份解读/婚姻不正位判断 |
| 4 | 子女宫 | 5/19 | 桃花层+享乐层双重含义 |
| 5 | 财帛宫 | 5/19 | 不等于你有多少钱/现金流VS资产区分 |
| 6 | 疾厄宫 | 5/19 | 财库位+性格层+健康 |
| 7 | **迁移宫** | **5/28** | **七步分析法+廉贞忌凶险机制+29命例验证** |
| 8 | 交友宫 | 5/28 | 六外宫/兄友线/三八为朋/夹宫结构 |
| 9 | 官禄宫 | ❌ | |
| 10 | 田宅宫 | 🔧 | 部分覆盖（命签纸田中涉及） |
| 11 | 福德宫 | ❌ | |
| 12 | 父母宫 | ❌ | |

**已覆盖：8/12 宫 ✅**


### 迁移宫专题（5/28 产出）

独立方法论：**迁移宫分析七步法**

```
Step 1: 主星配置 → 外面给人的第一印象
Step 2: 生年四化 → 外在环境对你的作用力
Step 3: 自化 → 外在表现的变化性
Step 4: 对宫命宫联动 → 内在vs外在的一致性/差异性
Step 5: 三方四正 → 夫妻+福德对迁移的影响
Step 6: 忌冲检测 → 迁移宫忌冲命宫/田宅宫
Step 7: 廉贞忌专项 → 凶险等级评估
```

**廉贞化忌在迁移宫的凶险机制**（已建案例对照：赵 vs selim）

---

## 4. 专项方法论模块（methodology.ts + mutagenChains.ts）

```typescript
// ===== methodology.ts =====

interface MethodologyResult {
  laiyinGong: GongName;
  laiyinChain: SiHuaFlow[];       // 来因宫 → 生年四化各落点
  tiYong: {
    ti: GongName[];               // 体（静态格局）
    yong: GongName[];             // 用（动态事件宫位）
  };
  pingFang?: PingFangItem[];
  liuNeiWaiMap: Record<GongName, "六内"|"六外">;
  heTuGroups: HeTuGroup[];
}

interface HeTuGroup {
  name: string;                   // "一六共宗" | "二七同道" | ...
  palaces: GongName[];
  theme: string;                  // "论自己" | "论人际" | ...
}

// ===== mutagenChains.ts =====

interface MutagenChainResult {
  jiChains: JiChain[];
  luSuiJi: LuSuiJiItem[];
  keSuiQuan?: KeSuiQuanItem[];
}

interface JiChain {
  source: { gong: GongName; star: string; type: "生年忌"|"飞宫忌" };
  target: { gong: GongName; star: string };
  impact: string;
  severity: "high"|"medium"|"low";
}
```

#### 规则 → 模块映射

| 规则 | 模块 | 状态 |
|:--|:--|:--|
| 来因宫定位+含义 | methodology.ts | ✅ |
| 体用关系（由体入用/由用归体） | methodology.ts | 🔧 |
| 平方象意（同星同四化） | methodology.ts | 🔧 |
| 六内六外判断 | methodology.ts | ✅ |
| 河图五组太极分组 | methodology.ts | ✅ |
| 命宫四层分析法 | methodology.ts | ✅ (5/19) |
| 身宫三层检查+风险定级 | methodology.ts | ✅ (5/19) |
| 迁移宫七步分析法 | methodology.ts | ✅ (5/28) |
| 忌转忌 | mutagenChains.ts | ✅ |
| 禄随忌走 | mutagenChains.ts | 🔧 |
| 四化论命五步法 | methodology.ts | ✅ (5/19) |
| 过犹不及诊断 | methodology.ts | ✅ |
| 能量扫描 | methodology.ts | ✅ (5/28) |
| 有效飞宫判断 | mutagenChains.ts | ✅ (6/1) |
| 左辅右弼体系（七大分类+桃花+Again） | zuofuyoubi.ts | ✅ (6/1-6/2) |
| 左辅右弼54例全量扫描 | zuofuyoubi.ts | ✅ (6/1) |
| 化出化入区分 | methodology.ts | ❌ 待补 #10 |
| 一五九法 | methodology.ts | ❌ 待补 #9 |


## 5. 交互数据流

```
iztro 排盘
    │
    ▼
chartModel.ts → ChartModel
    │
    ├──► overallAnalysis.ts (一级总览)
    │       ├── 来因宫定位
    │       ├── 四化人格类型
    │       ├── 格局双维度评分
    │       ├── 能量浓度四象限
    │       ├── 过犹不及检测
    │       ├── 命签纸田(意外三宫)检查
    │       └── 身宫风险定级
    │
    └──► 用户点击某宫位
            │
            ▼
         palaceAnalysis.ts (二级详情)
            ├── PalaceBasic (从宫位知识库取多层解读)
            ├── ZhuanGongItem[] (转宫：以任意宫为新太极)
            ├── SiHuaEffect[] (生年四化/自化/飞宫在此宫)
            ├── 对宫关系 + 三方四正
            ├── 迁移宫则调用七步法 @methodology.ts
            ├── 命宫则调用四层分析法 @methodology.ts
            └── mutagenChains.ts (相关忌冲/禄随忌走链)
```


## 6. 知识库文件索引

| 文件 | 大小 | 内容 |
|:--|:--|:--|
| `ziwei-knowledge/ziwei_knowledge_full.md` | 460KB | 全量课程知识聚合（三师承） |
| `ziwei-knowledge/ziwei_rules_structured.md` | 164KB | 按主题结构化规则 |
| `ziwei-knowledge/ziwei_rules_v3.md` | 220KB | v3 规则含置信度标注 |
| `ziwei-knowledge/ziwei_technique_catalog_v1.md` | 11KB | 75 条技法名录（索引） |
| `ziwei-knowledge/daily-rules-progress.md` | 2KB | 每日规则提取进度 |
| `memory/2026-05-19.md` | — | 命→疾厄 6宫解读 + 四化五步法 |
| `memory/2026-05-28.md` | — | 迁移宫七步法 + 能量扫描 |

**外部项目（不在本 workspace）**：
| 路径 | 内容 |
|:--|:--|
| `ZWDS_Skills/ziwei-toolkit/references/mingpan-analysis.md` | 命盘分析七步法框架 |
| `ShuShuMaser/` | 54 命例数据库 + 逆向排盘工具 |
| `ZWDS_Skills/ziwei-toolkit/references/zuofuyoubi-analysis.md` | 左辅右弼规则体系 + 前端桥接数据模型 |
| `workspace/左辅右弼54例完整分析.md` | 54例逐例分类结果（7大类+多重叠加） |


## 7. 当前状态 & 下一步

### ✅ 前端可立即实现
- 来因宫定位 + 一句话含义
- 四化人格类型标签
- 格局双维度评分 + 能量浓度四象限
- 过犹不及检测
- 身宫三层风险定级
- 六内六外分类
- 河图五组太极分组
- 忌转忌、禄随忌走链追踪
- 命宫四层分析法 (主星/生年四化/自化/飞宫)
- **迁移宫七步分析法**（含廉贞忌凶险机制）
- **8 个宫位的完整多层解读**（命/兄/夫/子/财/疾/迁/交）
- 十二宫编号 + 本对宫 + 三方四正 + 转宫算法

### ❌/🔧 暂不可用
- 官禄/田宅/福德/父母宫（4 宫缺多层解读）
- 命签纸田（意外三宫）规则
- 六组阴阳宫二分
- 一五九法
- 化出化入区分

### ✅ 最新交付 (6/2)
- **左辅右弼体系**：七大分类 + 桃花规则 + Again规则 + 二度姻缘 + 单守命宫
- 54例全量扫描：100%有左右，33%同宫，10例化科桃花
- 完整前端数据模型：`ZuoYouBiComboInsight` → `ZiweiInsightPayload`
- 参考文件：`references/zuofuyoubi-analysis.md`（含判断伪代码）
- **有效飞宫判断**：飞宫遇生年=由用归体，James 22条验证通过

### 建议开发顺序
1. **数据流**：ChartModel → OverallResult → 一级渲染
2. **交互**：点击宫位 → PalaceResult 基本结构（本义 + 转宫 + 对宫）
3. **填充 8 宫知识**（已就绪）
4. **接入专项**：忌转忌、来因宫飞化链、迁移宫七步法
5. **补缺**：4 宫 + 剩余规则
6. **左辅右弼面板**：七大分类 + 桃花/Again 自动判断 → InsightSidebar


## 8. 左辅右弼桥接规格

### 8.1 数据模型

```typescript
interface ZuoYouBiComboInsight {
  // 基础位置
  zuofu: { palace: GongName; renStem: GongName; inZi: boolean; renSame: boolean };
  youbi: { palace: GongName; wuStem: GongName; wuSame: boolean; enhanced: boolean };
  
  // 组合判断
  samePalace: boolean;        // 左右同宫 → 拧巴
  hasTaohua: boolean;         // 任一化科 → 桃花
  taohuaRiskLevel: 'none'|'low'|'medium'|'high';
  againStudy: boolean;        // 命宫/官禄有左右
  againMarriage: boolean;     // 命宫/夫妻有左右
  singleMing: boolean;        // 单守命宫
  guyin: boolean;             // 太阴+右弼同宫
  
  // 结论
  coreStatements: string[];   // 2-4条同参结论
  alerts: string[];
  
  // 分类标签
  categories: string[];       // e.g. ['左辅生年科', '右弼生年科', '左右同宫', ...]
}
```

### 8.2 模块映射

| 规则 | 来源 | 前端模块 | 输出格式 |
|:--|:--|:--|:--|
| 左辅同参（ZF+壬） | zuofuyoubi-analysis.md | InsightSidebar | ZiweiInsightPayload.sections[0] |
| 右弼同参（YB+戊） | zuofuyoubi-analysis.md | InsightSidebar | ZiweiInsightPayload.sections[1] |
| 桃花判断（化科） | zuofuyoubi-analysis.md | InsightSidebar alerts | SihuaRiskPalace |
| 再一次（命/官/夫） | zuofuyoubi-analysis.md | InsightSidebar | ZiweiInsightPayload.sections[2] |
| 拧巴（左右同宫） | zuofuyoubi-analysis.md | InsightSidebar | ZiweiInsightPayload.sections[2] |
| 孤阴（太阴+右弼） | zuofuyoubi-analysis.md | InsightSidebar alerts | SihuaRiskPalace |
| 左辅单守命宫 | zuofuyoubi-analysis.md | OverallResult.alerts | AlertItem |
| 右弼单守命宫 | zuofuyoubi-analysis.md | OverallResult.alerts | AlertItem |
| 有效飞宫 | ziwei-knowledge-rule-6 | mutagenChains.ts | JiChain[] |

### 8.3 判断流程

```
ChartModel
  → 提取 zuofu = findStar('左辅'), youbi = findStar('右弼')
  → 找壬天干宫位, 戊天干宫位
  → checkCategory(zf, yb)       → 七大分类
  → checkTaohua(zf, yb)         → 是否化科 → 桃花等级
  → checkAgain(zf, yb)          → 命/官/夫?
  → checkShared(zf, yb)         → 同宫? 单守? 孤阴?
  → buildInsight(result)        → ZuoYouBiComboInsight
  → toZiweiInsightPayload(insight) → 前端渲染
```
