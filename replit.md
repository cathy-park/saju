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
- **`interpretationRules.ts`**: if-then 규칙 배열 (R01~R11). 규칙 추가 = RULES 배열에 항목 추가  
- **자동 재계산**: `SajuReport.tsx`에서 `useMemo` 기반으로 오행/신강약/용신 변경 시 즉시 재실행  
- **격국 판정**: 월지 십성 기반 단순 판정 (건록격·식신격·재격·관격·인수격·잡격)

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
