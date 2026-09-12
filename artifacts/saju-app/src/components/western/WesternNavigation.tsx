import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { westernRoutes } from "@/lib/western/uiModel";

function TopicNav({ items, label }: { items: { label: string; href: string }[]; label: string }) {
  const [location] = useLocation();
  const pathname = location.split("?")[0];
  return <nav className="grid rounded-xl bg-muted/40 p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} aria-label={label} data-testid="western-topic-nav">
    {items.map((item) => <Link key={item.href} href={item.href} className={cn("flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1 text-center text-xs font-semibold leading-tight text-muted-foreground", pathname === item.href && "border border-primary/30 bg-card font-bold text-primary shadow-sm")}>{item.label}</Link>)}
  </nav>;
}

export function WesternPersonalNav({ personId }: { personId: string }) {
  const routes = westernRoutes.personal(personId);
  return <TopicNav label="서양점성술 해석 주제" items={[{ label: "종합", href: routes.overview }, { label: "성향", href: routes.personality }, { label: "연애", href: routes.romance }, { label: "시기운", href: routes.transit }]} />;
}

export function WesternRelationshipNav({ personId, otherPersonId }: { personId: string; otherPersonId: string }) {
  const routes = westernRoutes.relationship(personId, otherPersonId);
  return <TopicNav label="관계 분석 주제" items={[{ label: "관계 종합", href: routes.overview }, { label: "시너스트리 상세", href: routes.details }]} />;
}
