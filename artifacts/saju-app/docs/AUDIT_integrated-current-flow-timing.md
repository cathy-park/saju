# 종합(integrated) "현재 흐름" timing 데이터 감사 — 2026-09-12

> 이 문서는 **감사(audit) 기록**입니다. 이 시점에는 코드를 수정하지 않았습니다.
> 박소연 개인 종합 리포트에서 "현재 흐름"이 "시기 데이터 없음"으로 생략되는 원인을 코드 레벨에서 추적한 결과이며, 아래 "다음 작업 범위"가 확정되면 이 문서를 기준으로 별도 작업을 진행합니다.

## 배경

박소연 개인 종합 화면에서 "현재 흐름" 영역이 생략됨. 실제 앱에는 다음이 이미 계산돼 있음에도 종합에 반영되지 않음:

- 사주 세운/월운
- 자미두수 대한/유년
- 서양점성술 current transit

확인 대상 질문 3가지:
1. 통합 holistic AI 입력에 세 체계의 현재 timing 데이터가 실제로 전달되는가?
2. `timingConvergence`(체계 간 교차 일치)가 비어 있다는 이유만으로 "현재 흐름" 전체가 없는 것으로 처리되는가?
3. 세 체계가 합의하지 않아도 각 체계 고유의 현재 timing fact가 "현재 흐름"에 종합될 수 있도록 설계돼 있는가?

## 결론 요약

| 질문 | 답 |
|---|---|
| Q1. AI 입력에 세 체계 현재 timing이 전달되는가 | **아니오.** `polishIntegratedHolistic()`이 `report.sections`의 fact와 `report.timingConvergences`만 읽는다. `report.standaloneFacts`/`unmappedFacts`는 읽지 않는다. |
| Q2. timingConvergence 빈 값이 "현재 흐름" 생략의 유일한 이유인가 | **네.** `sectionsFor()`가 `timingFacts.length > 0`일 때만 `currentFlow` 섹션을 생성한다. `timingConvergence`는 2개 이상 체계가 같은 theme+concept로 겹칠 때만 생성된다(단일 체계는 애초에 후보에서 제외). |
| Q3. 합의 없이 단일 체계 현재 timing만으로 종합 가능하게 설계돼 있는가 | **아니오.** `report.ts`의 `build()`가 `temporalScope`가 있는 fact를 `buildFacts()` 입력에서 제외해 `standaloneFacts`로 분리하고, 그 `standaloneFacts`는 AI에 전달되지 않는다. |

**timingConvergence 없음 ≠ timing data 없음** — 이 구분을 체계별로 적용하면:

| 체계 | 실제 상태 | 분류 |
|---|---|---|
| 자미두수 결혼시기(`upcoming-YYYY`) | evidence 있음, `temporalScope` 태그됨, taxonomy 매핑됨(2026 하드코딩) → `report.standaloneFacts`까지는 도달하지만 AI로 전달 안 됨 | **데이터 전달 누락** |
| 자미두수 대한/유년(`current-major`/`current-timing`) | 계산은 되지만 `evidence: []`로 생성돼 `eligible()`에서 탈락, taxonomy 매핑 이전에 제거됨 | **진짜 timing data 없음** (계산 단계의 evidence 누락이 원인) |
| 사주 세운/월운 | `buildSajuMonthlySections()`가 이미 evidence 포함해서 계산하지만, integrated 어댑터(`buildExistingPersonalReports`)가 애초에 이 함수를 호출하지 않음 | **진짜 timing data 없음** (integrated 파이프라인에 연결 자체가 안 됨) |
| 서양점성술 current transit | 기본 화면(`?month=` 없음)에서는 서버 호출에 `query`조차 실어 보내지 않아 transit이 계산되지 않음. "현재 월 흐름도 함께 보기" 클릭 시에만 계산·전달됨 | **진짜 timing data 없음** (기본 상태에서는 계산 자체가 트리거되지 않음) |

## 근거 코드 위치

### 1) AI로 가는 입력이 sections/timingConvergences로 제한됨
- `src/lib/integrated/prompt.ts:86` — `const facts = report.sections.flatMap((section) => section.facts)...`
- `src/lib/integrated/prompt.ts:95` — `const timing = report.timingConvergences.map(...)`
- `report.standaloneFacts`, `report.unmappedFacts`를 읽는 코드 없음.

### 2) currentFlow 섹션 생성 조건
- `src/lib/integrated/report.ts:64-69` (`sectionsFor()`) — `if (timingFacts.length) details.push({ key: "currentFlow", ... })`
- `src/lib/integrated/report.ts:49-62` (`timing()`) — `selected`(selectedPeriod) 없으면 즉시 `[]`. 있어도 같은 theme+concept로 **2개 이상 체계**가 겹칠 때만 항목 생성(`systems.length < 2 → return []`).
- `src/lib/integrated/report.ts:73` (`build()`) — `buildFacts(normalized.mapped.filter((source) => !source.temporalScope), ...)`: temporalScope가 있는 fact는 `buildFacts()` 입력에서 제외되어 일반 섹션 fact로도 못 들어감.
- `src/lib/integrated/report.ts:75` — `standaloneFacts: normalized.mapped.filter((source) => !built.used.has(sourceKey(source)))`: 단일 체계 timing fact가 여기로 빠짐.

### 3) API 프롬프트도 timingConvergences만 "시기 정보"로 취급
- `api/integrated-holistic.ts:221` — "'현재 흐름'(또는 '현재 관계 흐름') 영역은 시기 정보가 있을 때만 포함"
- `api/integrated-holistic.ts:236` — `timingLines`는 `timingConvergences`에서만 만들어짐. 다른 채널 없음.

### 4) 자미두수 — 결혼시기(evidence 있음, 전달 누락)
- `src/lib/ziwei/reports/comprehensiveReport.ts:248-264` (`buildUpcomingTimingSection`) — `id: upcoming-${card.year}`, `evidence: card.evidence`(비어있지 않음).
- `src/lib/integrated/adapters.ts` (`adaptZiweiPersonal`) — `factId`가 `/^upcoming-(\d{4})$/`와 매치하면 `temporalScope`를 태그.
- `src/lib/integrated/taxonomy.ts` — `rule("ziwei.timing.relationship", "ziwei", /^timing$/, /^upcoming-2026$/, "relationshipNeeds", "relationship-adjustment", "adjusting")`: **factId가 정확히 `upcoming-2026`일 때만** 매핑(연도 하드코딩). 결혼시기(relationshipNeeds) 주제 한정이며 일반적인 "현재 흐름" 전체를 대표하지 않음.

### 5) 자미두수 — 대한/유년(evidence 없음, 진짜 데이터 없음)
- `src/lib/ziwei/reports/comprehensiveReport.ts:195-241` (`buildCurrentFocusSection`)
  - `current-major`(대한, 10년 단위 흐름): `evidence: []` (line 223)
  - `current-timing`(유년, 올해 결혼 관련 신호 활성 여부): `evidence: []` (line 238)
  - `current-shengong`(身宮, 타고난 구조): evidence 있음(line 208)이지만 이건 natal 정보라 "현재 흐름"이 아님.
- `src/lib/integrated/report.ts:6` (`eligible()`) — `source.evidence.length > 0` 요구. 위 두 fact는 이 시점에 탈락하여 taxonomy 매핑·standaloneFacts 어디에도 도달하지 않음.
- 게다가 `adaptZiweiPersonal`의 `temporalScope` 태깅은 `upcomingTiming` 섹션의 `upcoming-YYYY` factId만 대상으로 해서, `currentFocus` 섹션의 `current-major`/`current-timing`은 evidence가 있었더라도 애초에 `temporalScope` 태그 대상이 아님.

### 6) 사주 — 세운/월운(계산은 존재, integrated에 미연결)
- `src/lib/sajuMonthlyFacts.ts:310` (`buildSajuMonthlySections`) — 세운/월운 fact를 evidence 포함해서 계산하는 함수가 이미 존재. 사용처: `src/components/saju/SajuMonthlySummary.tsx`(홈 화면 등에서 사용 중, integrated와 무관).
- `src/lib/integrated/personReports.ts:12` (`buildExistingPersonalReports`) — `buildSajuSummarySections(pipeline, [], [])`만 호출. `buildSajuMonthlySections`는 import조차 되지 않음.
- `src/lib/integrated/adapters.ts` (`adaptSajuPersonal`) — 어떤 fact에도 `temporalScope`를 태그하지 않음(태깅 로직 자체가 없음).

### 7) 서양점성술 — current transit(기본 화면에서 미계산)
- `src/pages/IntegratedOverview.tsx:21,27,29` — `month`가 URL 쿼리에 없으면 `scope = undefined`.
  - line 29-30: `scope`가 없으면 `/api/western-overview` 호출 body에 `query` 필드 자체를 안 실음 → 서버(`api/western-overview.ts`)가 `query ? buildWesternTransitReport(...) : undefined`이므로 transit 자체가 계산되지 않음.
  - line 27: `adaptWesternPersonal(western, scope)`도 `scope` 없으면(`src/lib/integrated/adapters.ts`) transit fact를 만들지 않고 `base`만 반환.
- `IntegratedOverview.tsx:34` — "현재 월 흐름도 함께 보기" 링크(`?month=YYYY-MM`)를 사용자가 직접 눌러야만 이 계산이 트리거됨. 기본 진입 상태에서는 절대 실행되지 않음.

## 왜 오늘 "좁은 수정"을 적용하지 않았는가

가장 좁게 고칠 수 있는 지점은 자미두수 결혼시기(`upcoming-2026`) `standaloneFacts` 하나뿐이었음(`prompt.ts`+`api/integrated-holistic.ts`만 건드리면 됨). 하지만:

- 이 fact만 연결하면 "현재 흐름"이 뜨더라도 내용이 사실상 "2026년 결혼시기 신호" 하나로 좁게 채워짐.
- 사주 세운/월운, 자미두수 대한/유년(일반), 서양 기본 화면 transit은 여전히 빠진 채로 "현재 흐름"이라는 이름의 섹션이 생기게 됨 → 세 체계를 종합한 것처럼 보이지만 실제로는 한 체계, 한 주제만 반영된 상태 → 사용자에게 잘못된 완성도를 줄 위험.
- 대표 판단: 오늘은 적용하지 않고, 세 체계 모두 정식으로 연결하는 것을 하나의 후속 작업 범위로 남김.

## 다음 작업 범위 (확정, 후속 작업 기준)

1. **사주**: `buildSajuMonthlySections()`의 현재 세운·월운을 integrated adapter에 연결(`adaptSajuPersonal` 또는 신규 어댑터 + `personReports.ts`에서 호출 추가).
2. **자미두수**: `current-major`/`current-timing` fact에 정상 `evidence`를 부여해 `eligible()`/taxonomy를 통과시키고, `upcoming-YYYY`의 `2026` 하드코딩(`taxonomy.ts`) 제거 — 선택/현재 시점 기준의 연도 매칭으로 전환.
3. **서양점성술**: 종합 기본 화면(현재는 `?month=` 있을 때만 계산)에서도 현재 월 transit을 자동 계산해서 integrated input에 포함.
4. **integrated 공통**: 단일 체계 timing fact를 버리지 말고 `standaloneFacts` 또는 별도 timing fact collection으로 holistic AI에 전달.
   - `timingConvergence`는 "2개 이상 체계가 같은 방향을 가리키는 추가 신호"로만 사용하고, "현재 흐름" 존재 여부의 필수 조건으로 사용하지 않는다.
   - `currentFlow`는 한 체계라도 유효한 현재 timing fact가 있으면 생성 가능해야 한다.
   - AI 프롬프트는 단일 체계 흐름과 다체계 convergence를 구분해서 종합하도록 지시한다(합의처럼 과장하지 않음).
   - 특정 연도(2026 등) 하드코딩 금지 — 선택된 기간 또는 현재 시점 기준으로 동작해야 한다.

## 영향받는 파일(후속 작업 예상 범위, 참고용)

- `src/lib/sajuMonthlyFacts.ts` (읽기만, 이미 존재)
- `src/lib/integrated/personReports.ts`
- `src/lib/integrated/adapters.ts`
- `src/lib/integrated/taxonomy.ts`
- `src/lib/ziwei/reports/comprehensiveReport.ts` (evidence 부여)
- `src/lib/integrated/report.ts` (standaloneFacts/timing 처리 방식 조정 가능성)
- `src/lib/integrated/prompt.ts`
- `api/integrated-holistic.ts`
- `src/pages/IntegratedOverview.tsx` (서양 기본 화면 transit 자동 계산)

## 오늘 자 변경사항

없음. 코드 수정 없이 감사만 수행.
