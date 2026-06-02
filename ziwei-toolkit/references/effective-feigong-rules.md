# 有效飞宫判断规则（飞宫遇生年 = 由用归体）

> 最后更新：2026-06-01
> 来源：中阶P07（有效飞宫第一课）、P06（能量流动法前导）、P16（总整理·撞球理论）、许铨仁全集
> 验证：James命盘手算22条有效飞宫，含2条忌冲忌致命线

---

## 一、核心公式

```
任意宫位天干飞出的四化
  ↓
是否落入已有「生年四化」的宫位？
  ↓ 是 → 有效，该飞宫能量真实作用
  ↓ 否 → 无效，视为常规流转，不构成关键判断
```

**口诀**：飞宫遇生年 = 唯一有效能量判定。同宫才算遇到，不同宫不算。

---

## 二、两个方向

| 方向 | 公式 | 另一个名字 |
|:--|:--|:--|
| **由体入用** | 坐生年四化的宫位 → 本宫干飞同类型四化 | "生年四化向外找" |
| **由用归体** | 任意宫位 → 本宫干飞四化 → 落回生年四化宫位 | "飞宫遇生年" |

两者是同一个东西的两个观察方向。陈小飞强调：由体入用使用频率更高，且**忌转忌是重中之重**。

---

## 三、优先级

```
忌 > 权 > 禄 > 科
```

飞宫忌能量最大，决定吉凶成败。

---

## 四、六大飞宫忌重点

| 优先级 | 类型 | 含义 |
|:--|:--|:--|
| 1 | **忌冲忌**（撞球） | 最凶，双方直接对冲 |
| 2 | 忌冲禄 | 好的被坏的冲掉 |
| 3 | 忌冲权 | 控制力被破坏 |
| 4 | 忌冲科 | 名分/美名受损 |
| 5 | 忌转忌 | 连锁反应，一拖二 |
| 6 | 忌冲自化忌 | 双重消耗 |

---

## 五、验证：James命盘

生年四化分布：
- 贪狼禄 @ 父母
- 太阴权 @ 迁移
- 右弼科 @ 福德
- 天机忌 @ 迁移

**22条有效飞宫**（从12宫各自的宫干飞四化，看是否落入4个生年四化宫位）

### 最凶两条线（忌冲忌）：

```
线1：疾厄戊干飞 天机忌 → 迁移(已有天机忌) = 双忌冲命宫
线2：福德乙干飞 太阴忌 → 命宫 → 对冲迁移之天机忌 = 忌冲忌
```

### 由体入用四条：
```
父母甲飞贪狼禄 → 廉贞禄入兄弟
命宫癸飞太阴权 → 巨门权入福德
福德乙飞右弼科 → 紫微科入疾厄
迁移丁飞天机忌 → 巨门忌入福德
```

---

## 六、实现伪代码

```typescript
function getEffectiveFeigong(chart: ChartModel): EffectiveFeiGong[] {
  const shengnian = chart.shengNianSiHua;  // 4条生年四化
  const shengnianPalaces = new Set(shengnian.map(s => s.palace));
  const results: EffectiveFeiGong[] = [];
  
  for (const palace of chart.palaces) {
    const feiHuas = computeFeigong(palace);  // 本宫干飞四化
    for (const fh of feiHuas) {
      if (shengnianPalaces.has(fh.targetPalace) || 
          shengnianPalaces.has(fh.oppositePalace)) {  // 对冲也算遇到
        results.push({
          source: palace.name,
          star: fh.star,
          huaType: fh.type,
          target: fh.targetPalace,
          shengnianHere: shengnian.find(s => s.palace === fh.targetPalace),
          severity: fh.type === '忌' ? 'high' : 'medium',
          isJiChongJi: fh.type === '忌' && 
            shengnian.some(s => s.type === '忌' && s.palace === fh.oppositePalace)
        });
      }
    }
  }
  
  return results.sort((a, b) => severityRank(b) - severityRank(a));
}
```

**注意**：当前代码层未实现飞宫计算，所有飞宫判断需手工推演或后续补入 iztro 飞宫接口。

---

## 七、课程引用

- 中阶P07：有效飞宫判断技巧（核心课程，8,000+字）
- 中阶P06：能量流动法（前导，体用关系铺垫）
- 中阶P08：体用法（志玲姐姐/男命职场案例）
- 中阶P10：体用法进阶（家暴/婆媳案例，忌转忌连锁）
- 高阶P16：总整理（撞球理论/飞宫遇生年）
- 许铨仁B01：星曜研究方法论（不直接涉及飞宫）
