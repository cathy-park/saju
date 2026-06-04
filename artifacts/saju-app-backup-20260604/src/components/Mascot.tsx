import gyeolDefault from "@assets/gyeol_default_1774880100276.png";
import gyeolExcited from "@assets/gyeol_excited_1774880100276.png";
import gyeolThinking from "@assets/gyeol_thinking_1774880100278.png";
import gyeolGuiding from "@assets/gyeol_guiding_1774880100276.png";
import gyeolHappy from "@assets/gyeol_happy_1774880100277.png";
import gyeolNeutral from "@assets/gyeol_neutral_1774880100277.png";
import gyeolWarning from "@assets/gyeol_neutral-1_1774880100277.png";
import gyeolCalm from "@assets/gyeol_calm_1774880100275.png";
import gyeolLonely from "@assets/image_25_1774912809743.png";

export type MascotExpression =
  | "default"
  | "excited"
  | "thinking"
  | "guiding"
  | "happy"
  | "neutral"
  | "warning"
  | "calm"
  | "lonely";

const MASCOT_IMAGES: Record<MascotExpression, string> = {
  default: gyeolDefault,
  excited: gyeolExcited,
  thinking: gyeolThinking,
  guiding: gyeolGuiding,
  happy: gyeolHappy,
  neutral: gyeolNeutral,
  warning: gyeolWarning,
  calm: gyeolCalm,
  lonely: gyeolLonely,
};

export function Mascot({
  expression = "default",
  size = 80,
  className = "",
}: {
  expression?: MascotExpression;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={MASCOT_IMAGES[expression]}
      alt="결이"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`object-contain select-none ${className}`}
      draggable={false}
    />
  );
}
