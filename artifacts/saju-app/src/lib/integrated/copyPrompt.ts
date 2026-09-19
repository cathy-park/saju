// 사람 목록 카드의 "종합 프롬프트" 버튼처럼, 개인 종합 리포트 화면(IntegratedOverview.tsx)을
// 열지 않고도 같은 세 체계(사주·자미두수·서양점성술) 종합 복사 텍스트를 즉석에서 만들 때
// 쓰는 함수. IntegratedOverview.tsx의 copyPrompt 생성 로직과 완전히 동일한 재료
// (buildPersonClipboardText/buildZiweiCopyPrompt/buildWesternCopyPrompt/buildIntegratedCopyPrompt)를
// 그대로 재사용한다 — 화면에 그리는 IntegratedReport(report state)는 만들지 않는다(카드에는
// 필요 없음, 서양점성술 "overview" API 호출도 생략해 목록에서 불필요한 요청을 줄인다).
import { buildExistingPersonalReports } from "@/lib/integrated/personReports";
import { buildIntegratedCopyPrompt } from "@/lib/integrated/prompt";
import { buildPersonClipboardText } from "@/lib/clipboardExport";
import { buildZiweiCopyPrompt } from "@/lib/ziwei/reports/promptExport";
import { buildWesternCopyPrompt } from "@/lib/western/synthesis/promptExport";
import { westernBirthSource } from "@/lib/western/uiModel";
import type { WesternPersonalityReport } from "@/lib/western/interpretation";
import type { PersonRecord } from "@/lib/storage";

export async function buildIntegratedCopyPromptForPerson(person: PersonRecord): Promise<string> {
  const existing = buildExistingPersonalReports(person);
  const saju = buildPersonClipboardText(person, "포함", true);
  const ziwei = existing.ziweiChart
    ? buildZiweiCopyPrompt(existing.ziweiChart)
    : "출생시간이 없어 명반을 계산하지 않았습니다.";

  let western = "출생지 좌표와 timezone을 설정하면 계산 구조가 포함됩니다.";
  if (person.westernLocation) {
    try {
      const birth = westernBirthSource(person);
      const response = await fetch("/api/western-personality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(birth),
      });
      if (response.ok) {
        const data = (await response.json()) as { report: WesternPersonalityReport };
        western = buildWesternCopyPrompt(data.report.chart, {
          placeLabel: person.westernLocation.placeLabel,
          solarReturnLocation: person.currentLocation,
        });
      }
    } catch {
      // 네트워크 실패 시 기본 안내 문구를 그대로 둔다 — saju/ziwei는 이미 계산됐으니
      // 그 부분만이라도 복사되게 한다.
    }
  }

  return buildIntegratedCopyPrompt({ saju, ziwei, western });
}
