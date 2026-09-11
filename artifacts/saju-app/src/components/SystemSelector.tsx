import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface SystemItem {
  key: string;
  label: string;
  status: "active" | "soon";
  href?: string;
}

/** 사주·자미두수·서양점성술·(세 체계) 종합을 같은 레벨의 시스템 선택 탭으로 보여준다.
 * 최종 종합은 아직 기능이 없으므로 "준비중"으로만 자리를 예약한다 —
 * 여기서 말하는 "종합"은 자미두수 내부의 "종합" 리포트(/ziwei/:id/overview)와는 다른,
 * 세 체계를 가로지르는 상위 종합이라 링크를 연결하지 않는다.
 * 나(MyProfile)/상대(PersonDetail) 화면 최상단에서 개인 분석 진입을 전담하는 탭 바. */
export function SystemSelector({ personId, sajuHref }: { personId: string; sajuHref: string }) {
  const [location] = useLocation();

  const items: SystemItem[] = [
    { key: "saju", label: "사주", status: "active", href: sajuHref },
    { key: "ziwei", label: "자미두수", status: "active", href: `/ziwei/${personId}` },
    { key: "western", label: "서양점성술", status: "active", href: `/western/${personId}` },
    { key: "synthesis", label: "종합", status: "soon" },
  ];

  return (
    <div className="flex gap-1 rounded-2xl bg-muted/40 p-1">
      {items.map((item) => {
        const isActive =
          !!item.href && (location === item.href || location.startsWith(`${item.href}/`));
        const tab = (
          <div
            className={cn(
              "flex h-10 flex-1 items-center justify-center rounded-xl text-sm font-bold transition-colors",
              item.status === "soon"
                ? "cursor-default text-muted-foreground/40"
                : isActive
                ? "border border-primary/30 bg-card text-primary shadow-sm"
                : "cursor-pointer text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </div>
        );
        return item.href ? (
          <Link key={item.key} href={item.href} className="flex-1">
            {tab}
          </Link>
        ) : (
          <div key={item.key} className="flex-1">
            {tab}
          </div>
        );
      })}
    </div>
  );
}
