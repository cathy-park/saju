# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Korean 사주 만세력 app with accurate Four Pillars calculation.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **사주 계산 라이브러리**: `@fullstackfamily/manseryeok` v1.0.8 (KASI 데이터 기반)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── saju-app/           # Korean 사주 React+Vite app (previewPath: /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/saju-app` (`@workspace/saju-app`)

한국 사주 만세력 React+Vite 앱. 사주 계산, 프로필 관리, 궁합 기능 제공.

- **previewPath**: `/` (루트)
- **PORT**: 22817
- Entry: `src/main.tsx`
- App 라우터: `src/App.tsx` — wouter 사용
- `pnpm --filter @workspace/saju-app run dev` — 개발 서버

#### 핵심 파일

- `src/lib/sajuEngine.ts` — 만세력 계산 엔진. `calculateProfileFromBirth(input)` 반환 형태:
  - `computedPillars` (년/월/일/시 주)
  - `fiveElementDistribution` (오행 분포)
  - `lunarDate`, `solarDate`, `rawResult`, `isTimeCorrected`, `correctedTime`
- `src/lib/storage.ts` — localStorage 기반 프로필 저장 (`myProfile`, `people`)
- `src/lib/compatibility.ts` — 오행 상생/상극 기반 궁합 계산 (legacy)
- `src/lib/compatibilityScore.ts` — 100점 만점 구조적 궁합 점수 엔진 (6개 가중치 항목)
- `src/lib/authContext.tsx` — Google 로그인 + Supabase DB 동기화
- `src/lib/db.ts` — Supabase CRUD
- `supabase_schema.sql` — RLS 포함 전체 스키마

#### 라이브러리 API

`@fullstackfamily/manseryeok`:
```ts
calculateSaju(year, month, day, hour?, minute?, options?) → SajuResult
// options.longitude (기본: 127 서울), options.applyTimeCorrection
// 지원 범위: 1900~2050년
// 시간 미입력 시 hourPillar: null
```

#### 사주 계산 파이프라인 아키텍처 (4-Layer)

| 레이어 | 파일 | 역할 |
|------|------|------|
| Layer 1 (입력) | `sajuPipeline.ts: PipelineInput` | 일간·오행·신강약 수동값 입력 |
| Layer 2 (기본 구조) | `sajuPipeline.ts: computeBaseStructure()` | 십성 분포·신강약 점수·용신 계산 |
| Layer 3 (조정 구조) | `sajuPipeline.ts: computeAdjustedStructure()` | 조후 보정·수동 재정의 반영 |
| Layer 4 (해석) | `sajuPipeline.ts: buildInterpretationResult()` + `interpretationRules.ts` | 규칙 기반 해석 텍스트 자동 생성 |

- **`sajuPipeline.ts`**: `computeSajuPipeline()` 단일 함수로 전체 파이프라인 실행  
- **특별격 레이어 삽입 위치**: Layer 2(`computeBaseStructure`) 직후, Layer 3(`computeAdjustedStructure`) 진입 전에 `detectSpecialPatterns()`를 실행. 다음 두 조건을 모두 만족할 때만 Layer 3의 `effectiveYongshin`이 억부용신 대신 순세 취용으로 대체됨: (1) high confidence 특별격 후보가 존재 (2) 수동 용신 재정의(`manualYongshinData`)가 없음. 두 조건 중 하나라도 어긋나면(후보가 없거나, medium/low만 있거나, 수동 재정의가 있으면) 기존 억부용신 로직이 그대로 유지됨  
- **`interpretationRules.ts`**: if-then 규칙 배열 (R01~R11). 규칙 추가 = RULES 배열에 항목 추가  
- **자동 재계산**: `SajuReport.tsx`에서 `useMemo` 기반으로 오행/신강약/용신 변경 시 즉시 재실행  
- **격국 판정(내격)**: `gukguk.ts: determineGukguk()` — 월지 지장간의 천간 투출(透出) 여부를 기준으로 판정(strict: 투출이 없으면 `null` = 격국 없음). 일간과 투출 천간의 십성 관계로 10격 결정: 건록격·양인격(비견/겁재 구분)·식신격·상관격·편재격·정재격·편관격·정관격·편인격·정인격. "잡격"은 미구현.
- **특별격 후보(전왕격·종격)**: `specialGukguk.ts: detectSpecialPatterns()` — 내격이 다루지 못하는 극단적 편중 명식을 위한 별도 추가 레이어(내격 판정을 대체하지 않음). 전왕격 5종(곡직격·염상격·가색격·종혁격·윤하격), 종격 4종(종왕격·종강격·종재격·종살격) 후보를 격별 독립 규칙(필수조건·가감조건·파격조건)으로 판정해 confidence(high/medium/low)와 성립/방해 근거를 함께 반환. high confidence일 때만 `sajuPipeline.ts`의 용신이 억부용신 대신 해당 격의 순세 취용으로 분기되며, medium/low는 보조 참고 정보로만 표시된다.
- **월령 후보(미투출 내격, B레이어)**: `latentGukguk.ts: determineLatentGukguk()` — `determineGukguk()`이 투출 미확인으로 `null`을 반환한 경우에만 계산되는 읽기 전용 보조 레이어. 월지 지장간 본기(本氣)와 일간의 십성 관계로 "월령 후보" 격명을 산출해 "천간 미투출로 확정은 아님"을 함께 표시한다. 강약·용신·구조 도메인·activation 등 어떤 downstream 계산에도 입력되지 않으며, 오직 UI 설명 텍스트로만 소비된다. 화면 구성은 A(내격 확정) → B(월령 후보, 내격 미확정 시에만) → C(특별격 후보) 3층 구조로 표시된다.

#### 정확도 개선 (2026-03-31)

| 항목 | 이전 | 이후 |
|------|------|------|
| 대운수 계산 | 하드코딩 5세 | 절기 기반 실제 계산 (VSOP87 간략식, ±1일 정확도) |
| 신강약 점수 | 일간 자체를 보조 천간으로 이중 계산 | `if (s === dayStem) continue` 제외 |
| 신강약 임계값 | 구 임계값 | 일간 제외 후 점수 분포에 맞춰 전체 -1 조정 |
| 공망 | 미구현 | 일주 旬(순)에서 자동 계산, 신살 목록에 표시 |

- **`calculateDaewoonSu()`** (`luckCycles.ts`): 출생일 태양경도 → 순행/역행 방향 → 최근 절기까지 일수 ÷ 3 = 대운수
- **`gongmangBranches`** (`calculateShinsalFull`): `dayPillarIdx / 10` 旬 인덱스 → 공허 지지 2개 자동 산출
- 신강약 점수 계산 시 천간 루프에서 일간(day stem) 제외: `computeStrengthScore()` in `interpretSchema.ts`

#### 화면

| 경로 | 파일 | 기능 |
|------|------|------|
| `/` | `Home.tsx` | 홈 대시보드 — 히어로 카드 + 4-도메인 운세 그리드 + 운 흐름 (프로필 없을 때: 온보딩) |
| `/saju` | `MyProfile.tsx` | 내 사주 — 전체 사주 리포트 (아코디언 섹션) |
| `/people` | `PeopleList.tsx` | 상대 — 검색 + 컴팩트 카드 + 플로팅 추가 버튼 |
| `/people/add` | `AddPerson.tsx` | 상대 추가 |
| `/people/:id/edit` | `EditPerson.tsx` | 생년월일 수정 + 사주 직접 수정 |
| `/people/:id` | `PersonDetail.tsx` | 상대 상세 + SajuReport |
| `/compatibility` | `Compatibility.tsx` | 궁합 결과 |
| `/compatibility/:personId` | `Compatibility.tsx` | 특정 인물과 궁합 |

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /healthz` (full path: `/api/healthz`)
- Depends on: `@workspace/db`, `@workspace/api-zod`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec (`openapi.yaml`) and Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Run scripts via `pnpm --filter @workspace/scripts run <script>`.

## 2026-10-30 계산 경계 후속 검증

- `pnpm run build`가 루트 타입 검사 및 앱/API 전체 빌드를 실행한다. 최종 Node 22.17.1 / pnpm 9.15.0에서 종료코드 0. Astronomy Engine의 존재하지 않는 default export 참조를 namespace import로 정리했다. 큰 클라이언트 chunk 경고는 남는다.
- `pnpm --filter @workspace/saju-app test`: 53개 파일, 570개 시험 통과(신규 실제 의존성 경계시험 25개 포함). 전체 천문 정확도의 독립 검증을 뜻하지 않는다. 긴 천문 계산을 위해 공유 Intel 호스트에서 worker 2개/시험 제한 30초를 사용한다.
- `node scripts/test-three-charts-calculation-guards.cjs`: 기존 모형 기반 38개 통과. 실제 의존성 통합시험과 별개다. 출력 JSON은 커밋하지 않는다.
- 경도와 균시차의 날짜 이월은 래퍼에서 수행하고 의존성에는 보정 끔으로 전달해 중복 보정을 방지한다. 기존 경도 반올림, 기본 켬/끔과 원본 입력을 보존한다. 같은 일간 천간이 다른 주에 실제 투출한 경우까지 제거하던 필터를 고쳐 건록 월지 시험을 추가했다. 규칙 버전은 v3이다.
- `TimeCalculationAuditView`로 기존 명반 화면에 기준/경계/미검증을 표시한다. 저장된 과거 명반에 감사 정보가 없으면 부재를 알리며 자동 초기화 전 수동값은 변경하지 않는다. API의 timeAudit와 화면 컴포넌트의 서버 렌더링을 시험했으며, 로그인 브라우저 전체 흐름·DB 동기화는 이번 변경에서 미실행이다.
- 별도 Sites 엔진의 로컬 검증 소스와 승인 후 반영·롤백 절차는 [chatgpt-plugin/README.md](chatgpt-plugin/README.md)를 따른다. 플러그인 스킬 1.1.0, Vercel 앱 및 Sites 서버는 서로 별도 릴리스다.

### 승인된 기존 Sites 서버 반영

대표가 기존 서버 업데이트와 단기 권한 발급을 승인한 뒤 기존 원격 소스 HEAD를 대조했다. 공식 helper로 소스 커밋 `016ccb53c57ad01c1616a10a2beba157325286cc`와 동일 번들을 반영해 저장 버전 2가 succeeded 상태다. 실제 플러그인에서 `0.2.0-candidate`, timeAudit, 날짜 이월/±5분 경계/오류 정책/기존 응답 키 보존을 확인했다. 기존 17개와 신규 15개를 합친 서버 시험 32개가 통과했다. 소유자 전용 접근과 endpoint/DB/인증 설정은 유지했고, 롤백 버전 1을 보존했다. Vercel Production과 GitHub main은 변경하지 않았다. 독립 천문·유파 검증 범위는 위 제한을 그대로 따른다.

### 추가 독립 검증 — 운영 미반영

[독립 검증 보고서](docs/three-charts-independent-verification-20261030.md)에 Swiss 실데이터/NASA/HKO/별도 음력·자미두수 구현과의 대조, 불일치, 유파·연 경계·나이 정책을 기록했다. 양력 55,152일 대조에서 자료 누락 1일과 음력 연말 역변환 문제를 확인했다. 신강·용신 제안은 별도 patch이며 기본 코드에는 적용하지 않았다. 수치 후보 `0.3.0-audit-candidate`는 격리 검증용이며 운영은 `0.2.0-candidate` 그대로다. 이번 추가 검증은 새 Sites 배포·소스 push·접근 권한 발급을 포함하지 않았다.
