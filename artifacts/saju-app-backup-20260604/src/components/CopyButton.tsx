import { useState } from "react";
import { Clipboard, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CopyButtonProps {
  buildText: () => string;
  label?: string;
}

export function CopyButton({ buildText, label = "분석 전체 복사" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      const text = buildText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "사주 분석 데이터가 복사되었습니다.",
        description: "GPT 또는 Gemini에 붙여넣어 추가 해석을 받을 수 있습니다.",
        duration: 3000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "복사 실패",
        description: "클립보드 접근 권한을 확인해주세요.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        width: "100%",
        padding: "10px 16px",
        borderRadius: 12,
        border: "1px solid #E8E8E8",
        background: copied ? "#F0FDF4" : "#FAFAFA",
        color: copied ? "#15803D" : "#666",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {copied
        ? <Check size={15} strokeWidth={2.5} />
        : <Clipboard size={15} strokeWidth={2} />
      }
      {copied ? "복사됨!" : label}
    </button>
  );
}
