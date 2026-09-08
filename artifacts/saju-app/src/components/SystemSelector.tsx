import { Link } from "wouter";
import { ScrollText, Sparkles, Moon, GitMerge, type LucideIcon } from "lucide-react";

interface SystemItem {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: "active" | "soon";
  href?: string;
}

/** 사주·자미두수·서양점성술·(세 체계) 종합을 같은 레벨의 시스템 선택 영역으로 보여준다.
 * 서양점성술과 최종 종합은 아직 기능이 없으므로 "준비중"으로만 자리를 예약한다(대표 지시) —
 * 여기서 말하는 "종합"은 자미두수 내부의 "종합" 리포트(/ziwei/:id/overview)와는 다른,
 * 세 체계를 가로지르는 상위 종합이라 링크를 연결하지 않는다.
 * PersonDetail.tsx/MyProfile.tsx의 기존 목록·궁합 같은 기능 버튼은 건드리지 않고, 이 영역은
 * 그 위에 별도로 추가한다. */
export function SystemSelector({ personId, sajuHref }: { personId: string; sajuHref: string }) {
  const items: SystemItem[] = [
    {
      key: "saju", label: "사주", status: "active", icon: ScrollText, href: sajuHref,
      description: "타고난 기질과 오행 구조, 재물·커리어, 대운·세운의 흐름을 봅니다.",
    },
    {
      key: "ziwei", label: "자미두수", status: "active", icon: Sparkles, href: `/ziwei/${personId}`,
      description: "삶의 영역별 성향과 연애·배우자, 재물·커리어, 구체적인 시기 활성화를 봅니다.",
    },
    {
      key: "western", label: "서양점성술", status: "soon", icon: Moon,
      description: "심리와 욕구, 감정 반응, 관계 패턴과 트랜싯 변화를 봅니다.",
    },
    {
      key: "synthesis", label: "종합", status: "soon", icon: GitMerge,
      description: "세 체계가 공통으로 말하는 것과 서로 보완·충돌하는 지점을 종합합니다.",
    },
  ];

  return (
    <div className="ds-stack-2">
      <p className="ds-caption font-semibold uppercase tracking-wide">내 사주/차트</p>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <div
              className={`ds-card ds-card-pad flex items-start gap-3 shadow-none ${
                item.status === "active" ? "cursor-pointer active-elevate" : "opacity-60"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{item.label}</span>
                  {item.status === "soon" && <span className="text-[11px] text-muted-foreground">준비중</span>}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            </div>
          );
          return item.href ? <Link key={item.key} href={item.href}>{content}</Link> : <div key={item.key}>{content}</div>;
        })}
      </div>
    </div>
  );
}
