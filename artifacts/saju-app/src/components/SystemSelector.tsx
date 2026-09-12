import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface SystemItem {
  key: string;
  label: string;
  status: "active" | "soon";
  href?: string;
}

/** 사주·자미두수·서양점성술·(세 체계) 종합을 같은 레벨의 시스템 선택 탭으로 보여준다.
 * 나(MyProfile)/상대(PersonDetail) 화면 최상단에서 개인 분석 진입을 전담하는 탭 바.
 *
 * 21단계 — 홈 화면 "오늘 나의 흐름"도 같은 4개 탭을 쓰지만, 그 자리에서는 다른 페이지로
 * 이동하지 않고 같은 화면 안에서 내용만 바꿔 보여줘야 한다. `activeKey`+`onSelect`를 함께
 * 넘기면 각 탭이 Link 대신 button으로 렌더링되고, active 판정도 현재 경로가 아니라
 * activeKey로 한다 — 기존 페이지 이동 방식(Link)은 두 prop을 넘기지 않으면 그대로 동작한다
 * (완전히 하위 호환, 기존 5곳의 호출부는 수정하지 않는다). */
export function SystemSelector({
  personId, sajuHref, westernHref, synthesisHref, activeKey, onSelect,
}: {
  personId: string;
  sajuHref: string;
  westernHref?: string;
  synthesisHref?: string;
  activeKey?: string;
  onSelect?: (key: string) => void;
}) {
  const [location] = useLocation();

  const items: SystemItem[] = [
    { key: "saju", label: "사주", status: "active", href: sajuHref },
    { key: "ziwei", label: "자미두수", status: "active", href: `/ziwei/${personId}` },
    { key: "western", label: "서양점성술", status: "active", href: westernHref ?? `/western/${personId}/overview` },
    { key: "synthesis", label: "종합", status: "active", href: synthesisHref ?? `/integrated/${personId}/overview` },
  ];

  return (
    <div className="flex gap-1 rounded-2xl bg-muted/40 p-1">
      {items.map((item) => {
        const isActive = onSelect
          ? activeKey === item.key
          : item.key === "western"
          ? location.startsWith("/western/")
          : item.key === "synthesis" ? location.startsWith("/integrated/")
          : !!item.href && (location === item.href || location.startsWith(`${item.href}/`));
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
        if (onSelect) {
          return (
            <button key={item.key} type="button" className="flex-1" onClick={() => onSelect(item.key)}>
              {tab}
            </button>
          );
        }
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
