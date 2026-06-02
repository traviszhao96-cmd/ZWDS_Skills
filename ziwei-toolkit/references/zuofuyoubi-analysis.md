# 左辅右弼规则体系（前端桥接版）

> 最后更新：2026-06-02
> 来源：260531新视频(归藏易) + 260515番外篇(实操) + 初阶P07(星性) + 54例全量扫描

---

## 一、基础属性速查

| 属性 | 左辅 | 右弼 |
|:--|:--|:--|
| 主宰天干 | 壬 | 戊 |
| 阴阳 | 老阳 | 老阴 |
| 性别 | 男星 | 女星 |
| 层面 | 物质/实际 | 灵魂/灵性 |
| 心性 | 务实、执念、无明 | 好静、受业力牵引 |
| 所在宫位含义 | 该宫位事情必定存在 | 该宫位有先天感觉 |

---

## 二、结论输出模型（前端消费）

### 2.1 左辅结论

```typescript
interface ZuofuInsight {
  palace: GongName;          // 左辅所在宫位
  renStem: GongName;         // 壬天干所在宫位
  sameStem: boolean;         // 壬同宫 → 离心自化
  inZi: boolean;             // 在子宫 → 锁定
  shengnianKe: boolean;      // 生年科 → 物质"给出去"
  selfKe: boolean;           // 自化科 → 双重离开
  dingStem?: GongName;       // 丁天干位置（判断什么留不住）
  
  // 结论
  coreStatement: string;     // 同参一句话结论
  personality: string[];     // 心性标签
  alerts: string[];          // 警示
}
```

**左辅同参结论生成规则：**

| ZF宫位 | 壬在宫位 | 结论模板 |
|:--|:--|:--|
| {A} | {B} (能承福的宫位) | {B的含义}直接受益于{A的存在} |
| {A} | 疾厄 (病位) | 能量无法直承福 → 拐到福德祖辈层 → 长辈身体问题 |
| 夫妻 | 田宅 | 因另一半而买房置产 |
| 迁移 | 迁移(同宫) | 外出极其重要，离心自化→注意交通事故 |
| 夫妻(子宫) | 任意 | 婚姻锁住：不轻婚不轻离，靠谱伴侣 |

### 2.2 右弼结论

```typescript
interface YoubiInsight {
  palace: GongName;          // 右弼所在宫位
  wuStem: GongName;          // 戊天干所在宫位
  sameStem: boolean;         // 戊同宫 → 能量自循环
  enhanced: boolean;         // 五干加强(丙戊己辛壬同宫)
  shengnianKe: boolean;      // 生年科 → 天赋消耗
  guyin: boolean;            // 太阴+右弼同宫 → 孤阴
  
  // 结论
  coreStatement: string;
  alerts: string[];
}
```

### 2.3 组合判断

```typescript
interface ZuoYouBiComboInsight {
  // 左右同宫
  samePalace: boolean;
  samePalaceName?: GongName;
  samePalaceEffect: string;   // "拧巴：既要又要，患得患失"
  
  // 桃花（化科）
  hasTaohua: boolean;
  taohuaStars: string[];      // "左辅化科"/"右弼化科"
  taohuaRisk: "none"|"low"|"medium"|"high";
  taohuaNote: string;
  
  // 再一次
  againStudy: boolean;        // 命宫/官禄宫有左右 → 重考/重修
  againMarriage: boolean;     // 命宫/夫妻宫有左右 → 二度姻缘警示
  
  // 单守命宫
  singleMing: boolean;        // 只有左右无主星
  singleMingEffect: string;   // "幼年不顺，庶出/过继/认干亲"
  
  // 孤阴
  guyin: boolean;
  guyinPalace?: GongName;
  guyinEffect: string;        // "灵性极高 + 体质偏弱"
}
```

---

## 三、判断流程（实现伪代码）

```
function analyzeZuofuYoubi(chart):
  zf = chart.zuofu  // {palace, renStem, hasBM:ke?, hasSelf:ke?, inZi?}
  yb = chart.youbi  // {palace, wuStem, enhanced?, hasBM:ke?, guyin?}
  result = {}
  
  // 1. 左辅同参
  result.zfCore = ZF_TEMPLATES[zf.palace][zf.renStem]
  
  // 2. 左辅生年科 → 查丁干
  if zf.hasBM and zf.hasSelf:
    result.zfLeave = f"物质给出去 → 丁干在{chart.dingStem}宫，留不住: {dingMeaning(chart.dingStem)}"
  
  // 3. 左辅在子宫
  if zf.inZi:
    result.zfLock = f"{zf.palace}锁住，不轻易改变"
  
  // 4. 右弼同参
  result.ybCore = YB_TEMPLATES[yb.palace][yb.wuStem]
  
  // 5. 右弼生年科
  if yb.hasBM:
    result.ybWarning = f"天赋有但保不住: {yb.palace}"
  
  // 6. 五干加强
  if yb.enhanced:
    result.ybBoost = "先天感觉大幅加强"
  
  // 7. 左右同宫
  if zf.palace == yb.palace:
    result.twist = "拧巴/患得患失"
  
  // 8. 桃花：任何一颗化科
  if zf.hasBM or yb.hasBM:
    result.taohua = "桃花，前世因果业报"
    if zf.hasBM and zf.palace == "夫妻" or yb.hasBM and yb.palace == "夫妻":
      result.taohuaRisk = "high"
  
  // 9. 再一次
  if zf.palace in ["命宫","官禄"] or yb.palace in ["命宫","官禄"]:
    result.againStudy = true
  if zf.palace in ["命宫","夫妻"] or yb.palace in ["命宫","夫妻"]:
    result.againMarriage = true
  
  // 10. 单守命宫（需排盘确认主星）
  if isSingleStarMing(chart):
    result.singleMing = "幼年不顺，庶出/过继/认干亲"
  
  // 11. 孤阴
  if hasTaiyinAndYoubi(chart):
    result.guyin = "灵性极高 + 体质偏弱"
  
  return result
```

---

## 四、54例扫描统计（供前端参考面板）

```typescript
interface ZuoYouBiStats {
  totalCases: 54;
  zuofuTop3: Array<{palace: GongName, count: number}>;  // 夫妻8 田宅7 官禄7
  youbiTop3: Array<{palace: GongName, count: number}>;  // 夫妻10 福德9 父母9
  leftRightSamePalace: 18;  // 33% 左右同宫
  zuofuKe: 6;               // 左辅化科
  youbiKe: 4;               // 右弼化科
  guyin: 4;                 // 孤阴
  zuofuInZi: 4;             // 左在子宫
  zuofuRenSame: 4;          // 壬同宫离心
  youbiWuSame: 3;           // 戊同宫循环
  multiOverlap: [           // 多重叠加
    {name: "yjy", features: "孤阴+左在子宫+壬离心", count: 3},
    {name: "朱妈", features: "孤阴+左右同宫", count: 2},
    {name: "zoey", features: "左在子宫+壬离心@夫妻", count: 2},
    {name: "james", features: "右弼科+左右同宫@福德", count: 2},
  ];
}
```

---

## 五、InsightSidebar 输出格式

当前前端 `ZiweiInsightPayload` 结构：
```typescript
{
  headline: string;
  summary: string;
  sections: Array<{ title: string; points: string[] }>;
  methodology: string[];
}
```

**左辅右弼分析输出示例：**

```typescript
{
  headline: "左辅右弼：物质锁 + 灵魂牵引",
  summary: "左辅在田宅(壬在福德)：房产因精神追求而置，反过来滋养精神。右弼在疾厄(戊在财帛)：身体直觉与钱财互相牵连。无左右同宫，无桃花化科。",
  sections: [
    {
      title: "左辅线：必发生",
      points: [
        "田宅宫·左辅：房产/家宅的事必定存在且不一般",
        "壬天干在福德：能量来源是精神追求和福气",
        "同参结论：买房不是纯经济行为，与精神追求密切相关",
        "心性：对家/房产有执念，放不下，容易耿耿于怀"
      ]
    },
    {
      title: "右弼线：先天感觉",
      points: [
        "疾厄宫·右弼：对身体有先天直觉",
        "戊天干在财帛：能量来源与钱挂钩",
        "同参结论：财务状况影响身体状态，或反之",
        "提示：身体好时赚钱顺，身体差时财运降"
      ]
    },
    {
      title: "综合判断",
      points: [
        "田宅(库)←财帛(钱): 赚钱→蓄房→养精神，完整闭环",
        "无桃花：左右皆不化科，无前世因果桃花业",
        "无Again：不在命宫/官禄/夫妻，不触发学业重考或二度姻缘",
        "无孤阴/无同宫：左右各自独立运作，不打架"
      ]
    }
  ],
  methodology: [
    "左辅必与壬天干同参（陈小飞番外篇）",
    "右弼必与戊天干同参（陈小飞番外篇）",
    "桃花=左右化科，前世因果业报（许铨仁）",
    "Again=命宫/官禄/夫妻有左右（许铨仁）"
  ]
}
```

---

## 六、桥接映射

| 分析引擎输出 | 前端组件 | 数据结构 |
|:--|:--|:--|
| 左辅右弼全量分析 | `InsightSidebar` | `ZiweiInsightPayload` |
| 高风险宫位标记 | `InsightSidebar` (Risk Focus) | `SihuaRiskPalace[]` |
| 宫位详情（含左右影响） | `ReportPanel` + 宫位hover | `PalaceResult` |
| 54例统计 | 仪表盘/统计页 | `ZuoYouBiStats` |
