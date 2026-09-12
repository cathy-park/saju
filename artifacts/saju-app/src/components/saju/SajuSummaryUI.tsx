import type { SajuEvidenceItem } from "@/lib/sajuSummaryFacts";
import { EvidenceDisclosure, EvidenceChipList } from "@/components/EvidenceDisclosure";

// 12단계 UI·요약 구조 정리 — 9/10/11단계가 각자 파일에 복붙해 두었던 evidence 토글 +
// 요약 카드 래퍼를 이 파일 하나로 합친다. 시각 스타일은 그대로(색상·타이포·카드 스타일
// 변경 없음), 중복 제거와 "fact 0개 섹션은 완전히 숨김" 동작 통일만 한다.
// 21단계 — 토글의 셸(버튼 문구·열림 박스)은 공용 EvidenceDisclosure로 옮겨 자미두수·
// 서양점성술과 통일했다. category→라벨 매핑처럼 사주만의 데이터 모양은 이 파일에 남긴다
// (데이터 모델 자체를 억지로 합치지 않는다).

const CATEGORY_LABEL: Record<SajuEvidenceItem["category"], string> = {
  strength: "강약",
  gukguk: "격국",
  yongshin: "용신·희신",
  fiveElement: "오행",
  tenGod: "십성",
  interaction: "합충형파해원진",
  shinsal: "신살",
  ruleInsight: "규칙",
  natal: "원국",
  daewoon: "대운",
  saeun: "세운",
  wolun: "월운",
  compatScore: "궁합 점수",
  compatDetail: "궁합 세부",
  compatAxis: "배우자 구조축",
  compatMarriage: "결혼 관점",
};

function evidenceLabel(e: SajuEvidenceItem): string {
  return `[${CATEGORY_LABEL[e.category]}] ${e.label}`;
}

/** 사주 전용 근거 토글(원국/월운/궁합 공통) — "[왜 이런 결과인가요?]" 클릭 시 원자료를
 * chip 형태로 보여준다. 이전에는 SajuCoreSummary.tsx에 있었으나 12단계에서 이 파일로
 * 옮겨 순환 참조 없이 세 요약 컴포넌트가 동일하게 재사용한다. */
export function SajuEvidenceToggle({ evidence }: { evidence: SajuEvidenceItem[] }) {
  if (evidence.length === 0) return null;
  return (
    <EvidenceDisclosure>
      <EvidenceChipList items={evidence.map(evidenceLabel)} />
    </EvidenceDisclosure>
  );
}

/** 원국/월운/궁합 요약이 공통으로 넘기는 렌더용 섹션 모양 — 각자의 fact 타입(SajuFact/
 * SajuMonthlyFact/SajuCompatFact)은 다르지만 렌더에 필요한 건 이 4개뿐이라 여기서는
 * fact 타입 자체를 몰라도 된다. hasFacts는 호출부가 `section.facts.length > 0`으로
 *넘긴다 — 이 파일은 fact 배열을 직접 들여다보지 않는다(도메인 로직과 분리 유지). */
export interface SajuSummaryCardSection {
  key: string;
  title: string;
  text: string;
  evidence: SajuEvidenceItem[];
  hasFacts: boolean;
}

function SajuSummarySectionCard({ section }: { section: SajuSummaryCardSection }) {
  return (
    <div className="ds-card ds-card-pad shadow-none">
      <h3 className="text-base font-bold text-foreground">{section.title}</h3>
      {section.text ? (
        <>
          <p className="mt-2 text-sm text-foreground leading-relaxed">{section.text}</p>
          <SajuEvidenceToggle evidence={section.evidence} />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">이 주제에 대한 근거가 부족합니다.</p>
      )}
    </div>
  );
}

/** 원국/월운/궁합 3개 요약이 공유하는 바깥 래퍼 — fact가 있는 섹션만 카드로 보여주고,
 * 전부 0개면 캡션까지 포함해 전체를 숨긴다(대표 지시: 3곳 모두 동일하게). */
export function SajuSummaryBlock({
  caption, sections,
}: {
  caption: string;
  sections: SajuSummaryCardSection[];
}) {
  const visible = sections.filter((s) => s.hasFacts);
  if (visible.length === 0) return null;

  return (
    <div className="ds-stack-2">
      <p className="ds-caption font-semibold uppercase tracking-wide">{caption}</p>
      {visible.map((section) => (
        <SajuSummarySectionCard key={section.key} section={section} />
      ))}
    </div>
  );
}
