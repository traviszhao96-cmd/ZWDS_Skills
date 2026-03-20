#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from typing import Optional

from bidict import bidict
from colorama import Fore, Style, init
from lunar_python import Lunar, Solar

init(autoreset=True)

CALENDAR_ALIASES = {
    "solar": "solar",
    "yangli": "solar",
    "gregorian": "solar",
    "阳历": "solar",
    "公历": "solar",
    "lunar": "lunar",
    "yinli": "lunar",
    "阴历": "lunar",
    "农历": "lunar",
}

GENDER_CANON = bidict({1: "male", 0: "female"})

GENDER_ALIASES = {
    "male": 1,
    "man": 1,
    "nan": 1,
    "男": 1,
    "female": 0,
    "woman": 0,
    "nv": 0,
    "女": 0,
}


@dataclass
class BirthInput:
    year: int
    month: int
    day: int
    hour: int = 12
    minute: int = 0
    second: int = 0
    has_time: bool = True


def parse_birth_text(text: str) -> BirthInput:
    cleaned = text.strip()
    patterns = [
        (r"^(\d{4})[-/\.年](\d{1,2})[-/\.月](\d{1,2})(?:日)?\s+(\d{1,2})[:点时](\d{1,2})(?:[:分](\d{1,2}))?$", True),
        (r"^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$", True),
        (r"^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$", True),
        (r"^(\d{4})[-/\.年](\d{1,2})[-/\.月](\d{1,2})(?:日)?$", False),
        (r"^(\d{4})(\d{2})(\d{2})$", False),
    ]
    for pattern, has_time in patterns:
        match = re.match(pattern, cleaned)
        if not match:
            continue
        parts = [int(part) for part in match.groups() if part is not None]
        if has_time:
            while len(parts) < 6:
                parts.append(0)
            return BirthInput(*parts[:6], has_time=True)
        return BirthInput(parts[0], parts[1], parts[2], has_time=False)
    raise ValueError(
        "无法识别生日格式，请使用例如 1990-01-01、1990-01-01 12:30 或 199001011230。"
    )


def normalize_calendar(value: str) -> str:
    key = value.strip().lower()
    if key not in CALENDAR_ALIASES:
        raise ValueError("calendar 仅支持 solar 或 lunar。")
    return CALENDAR_ALIASES[key]


def normalize_gender(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    key = value.strip().lower()
    if key not in GENDER_ALIASES:
        raise ValueError("gender 仅支持 male 或 female。")
    return GENDER_ALIASES[key]


def build_lunar(birth: BirthInput, calendar: str, is_leap_month: bool):
    if calendar == "solar":
        return Solar.fromYmdHms(
            birth.year, birth.month, birth.day, birth.hour, birth.minute, birth.second
        ).getLunar()
    return Lunar.fromYmdHms(
        birth.year,
        birth.month,
        birth.day,
        birth.hour,
        birth.minute,
        birth.second,
    ) if not is_leap_month else Lunar.fromYmdHms(
        birth.year,
        -birth.month,
        birth.day,
        birth.hour,
        birth.minute,
        birth.second,
    )


def fmt_label(label: str) -> str:
    return f"{Fore.CYAN}{label}{Style.RESET_ALL}"


def fmt_value(value: str) -> str:
    return f"{Fore.YELLOW}{value}{Style.RESET_ALL}"


def render_chart(lunar, has_time: bool, gender: Optional[int]) -> str:
    ec = lunar.getEightChar()
    lines = []
    solar = lunar.getSolar()
    lines.append(f"{fmt_label('阳历')} {solar.toYmdHms()}")
    lines.append(f"{fmt_label('农历')} {lunar.toString()}")
    lines.append("")
    lines.append(fmt_label("四柱"))
    time_pillar = ec.getTime() if has_time else "未知"
    lines.append(
        f"年柱 {fmt_value(ec.getYear())}  月柱 {fmt_value(ec.getMonth())}  "
        f"日柱 {fmt_value(ec.getDay())}  时柱 {fmt_value(time_pillar)}"
    )
    lines.append("")
    lines.append(fmt_label("基础信息"))
    lines.append(
        f"日主 {fmt_value(ec.getDayGan())}  "
        f"五行 年{ec.getYearWuXing()} 月{ec.getMonthWuXing()} 日{ec.getDayWuXing()} "
        + (f"时{ec.getTimeWuXing()}" if has_time else "时未知")
    )
    lines.append(
        f"纳音 年{ec.getYearNaYin()} 月{ec.getMonthNaYin()} 日{ec.getDayNaYin()} "
        + (f"时{ec.getTimeNaYin()}" if has_time else "时未知")
    )
    lines.append("")
    lines.append(fmt_label("十神"))
    lines.append(
        f"年干 {ec.getYearShiShenGan()}  月干 {ec.getMonthShiShenGan()}  "
        f"日干 日主  " + (f"时干 {ec.getTimeShiShenGan()}" if has_time else "时干 未知")
    )
    lines.append(
        f"年支 {'/'.join(ec.getYearShiShenZhi())}  月支 {'/'.join(ec.getMonthShiShenZhi())}  "
        f"日支 {'/'.join(ec.getDayShiShenZhi())}  "
        + (
            f"时支 {'/'.join(ec.getTimeShiShenZhi())}"
            if has_time
            else "时支 未知"
        )
    )
    lines.append("")
    lines.append(fmt_label("藏干"))
    lines.append(
        f"年支 {'/'.join(ec.getYearHideGan())}  月支 {'/'.join(ec.getMonthHideGan())}  "
        f"日支 {'/'.join(ec.getDayHideGan())}  "
        + (f"时支 {'/'.join(ec.getTimeHideGan())}" if has_time else "时支 未知")
    )
    if gender is not None:
        yun = ec.getYun(gender)
        lines.append("")
        lines.append(fmt_label("起运"))
        lines.append(
            f"{'男' if gender == 1 else '女'}命，约 {yun.getStartYear()}年{yun.getStartMonth()}个月"
            f"{yun.getStartDay()}天{yun.getStartHour()}小时后起运"
        )
        lines.append(f"起运阳历 {yun.getStartSolar().toYmd()}")
    if not has_time:
        lines.append("")
        lines.append("注：未提供出生时辰，时柱、时柱十神与部分细节未计算。若出生在 23:00-00:59，日柱也可能受影响。")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="八字排盘脚本")
    parser.add_argument("birthday", help='生日，例如 "1990-01-01 12:30"')
    parser.add_argument("--calendar", default="solar", help="solar 或 lunar")
    parser.add_argument("--gender", default=None, help="male 或 female，用于起运")
    parser.add_argument("--leap", action="store_true", help="农历闰月时传入")
    args = parser.parse_args()

    birth = parse_birth_text(args.birthday)
    calendar = normalize_calendar(args.calendar)
    gender = normalize_gender(args.gender)
    lunar = build_lunar(birth, calendar, args.leap)
    print(render_chart(lunar, birth.has_time, gender))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
