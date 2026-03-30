import RatImg      from "@assets/Rat_1774888819911.png";
import OxImg       from "@assets/Ox_1774888819910.png";
import TigerImg    from "@assets/Tiger_1774888819912.png";
import RabbitImg   from "@assets/Rabbit_1774888819911.png";
import DragonImg   from "@assets/Dragon_1774888819910.png";
import SnakeImg    from "@assets/Snake_1774888819911.png";
import HorseImg    from "@assets/Horse_1774888819910.png";
import SheepImg    from "@assets/Sheep_1774888819911.png";
import MonkeyImg   from "@assets/Monkey_1774888819910.png";
import RoosterImg  from "@assets/Rooster_1774888819911.png";
import DogImg      from "@assets/Dog_1774888819909.png";
import PigImg      from "@assets/Pig_1774888819911.png";

export interface ZodiacInfo {
  animal: string;   // English name
  label: string;    // Korean label
  src: string;      // image URL (after Vite import)
  glow: string;     // subtle radial glow color
}

// 지지(地支) → zodiac info
const JIJI_MAP: Record<string, ZodiacInfo> = {
  자: { animal: "rat",     label: "쥐",  src: RatImg,     glow: "rgba(120,120,130,0.15)" },
  축: { animal: "ox",      label: "소",  src: OxImg,      glow: "rgba(140,100,60,0.13)"  },
  인: { animal: "tiger",   label: "호랑이", src: TigerImg, glow: "rgba(200,140,50,0.14)" },
  묘: { animal: "rabbit",  label: "토끼", src: RabbitImg,  glow: "rgba(255,160,180,0.15)" },
  진: { animal: "dragon",  label: "용",  src: DragonImg,  glow: "rgba(100,200,160,0.15)" },
  사: { animal: "snake",   label: "뱀",  src: SnakeImg,   glow: "rgba(100,200,170,0.14)" },
  오: { animal: "horse",   label: "말",  src: HorseImg,   glow: "rgba(180,120,80,0.14)"  },
  미: { animal: "sheep",   label: "양",  src: SheepImg,   glow: "rgba(220,200,160,0.15)" },
  신: { animal: "monkey",  label: "원숭이", src: MonkeyImg, glow: "rgba(190,140,70,0.14)"},
  유: { animal: "rooster", label: "닭",  src: RoosterImg, glow: "rgba(220,130,110,0.15)" },
  술: { animal: "dog",     label: "개",  src: DogImg,     glow: "rgba(200,160,80,0.14)"  },
  해: { animal: "pig",     label: "돼지", src: PigImg,    glow: "rgba(255,180,190,0.15)" },
};

/** Extract zodiac info from a 2-char hangul pillar string like "갑진" → 진 → Dragon */
export function getZodiacFromDayPillar(dayPillarHangul: string): ZodiacInfo | null {
  if (!dayPillarHangul || dayPillarHangul.length < 2) return null;
  const jiji = dayPillarHangul[1];
  return JIJI_MAP[jiji] ?? null;
}

export const DEFAULT_ZODIAC: ZodiacInfo = {
  animal: "default",
  label: "결이",
  src: RabbitImg,
  glow: "rgba(232, 87, 42, 0.10)",
};
