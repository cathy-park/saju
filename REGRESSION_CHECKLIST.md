# 사주 앱 회귀 체크리스트
## 생성·수정·저장·동기화·다기기 로드 후 반드시 유지되어야 할 필드

> 이 파일은 **회귀 방지용** 체크리스트입니다.  
> 새 기능을 추가하거나 저장/로드/동기화 로직을 수정할 때마다 아래 항목을 수동 또는 자동으로 검증하세요.

---

## 1. 데이터 흐름 개요

```
사용자 편집
  → localStorage (storage.ts)
    → scheduleSync() → upsertMyProfile/upsertPartnerProfile (db.ts)
      → Supabase (saju_payload 컬럼에 전체 PersonRecord JSON)
        → fetchMyProfile / fetchPartnerProfiles (db.ts · dbRowToRecord)
          → localStorage overwrite (authContext.tsx)
            → refreshKey++ → SajuReport 재렌더
```

---

## 2. PersonRecord 필드별 보존 체크리스트

| 필드 | 저장 위치 | 로드 위치 | DB 필터링 위험 | 상태 |
|------|-----------|-----------|----------------|------|
| `birthInput.*` | saju_payload + 개별 컬럼 | dbRowToRecord() 재조립 | ❌ 없음 | ✅ 안전 |
| `profile.*` | saju_payload 내 | `...payload` spread | ❌ 없음 | ✅ 안전 |
| `manualPillars` | saju_payload | `...payload` spread | ❌ 없음 | ✅ 안전 |
| `manualShinsal` | saju_payload | `VALID_SHINSAL_NAMES` 필터 | ⚠️ 목록 외 이름 삭제 | ✅ 허용목록 최신화 |
| `excludedAutoShinsal` | saju_payload | `VALID_SHINSAL_NAMES` 필터 | ⚠️ 목록 외 이름 삭제 | ✅ 허용목록 최신화 |
| `manualYongshinData` | saju_payload | 구조 검증만 (type 문자열 보존) | ✅ 수정됨 | ✅ 안전 |
| `manualStrengthLevel` | saju_payload | `...payload` spread | ❌ 없음 | ✅ 안전 |
| `manualYongshin` | saju_payload | `...payload` spread | ❌ 없음 | ✅ 안전 |
| `manualBranchRelationAdd` | saju_payload | `...payload` spread | ❌ 없음 | ✅ 안전 |
| `manualBranchRelationRemove` | saju_payload | `...payload` spread | ❌ 없음 | ✅ 안전 |
| `manualDerived` | saju_payload | `...payload` spread | ❌ 없음 | ✅ 안전 |
| `manualFiveElements` | saju_payload | `...payload` spread | ❌ 없음 | ✅ 안전 |
| `maritalStatus` | saju_payload | `...payload` spread | ❌ 없음 | ✅ 안전 |
| `createdAt` | saju_payload + created_at | `row.created_at` | ❌ 없음 | ✅ 안전 |
| `updatedAt` | updated_at 컬럼 | `row.updated_at` | ❌ 없음 | ✅ 안전 |

---

## 3. 파생 계산값 (저장 안 함 → 로드 후 재계산)

이 값들은 PersonRecord에 저장되지 않고 **매 렌더마다 재계산**됩니다.  
저장된 입력값(아래 "의존 필드")이 올바르게 보존되면 자동으로 복원됩니다.

| 파생값 | 재계산 위치 | 의존 필드 |
|--------|-------------|-----------|
| **종용신 (yongshinSecondary)** | `interpretSchema.ts · computeYongshinFull()` | `manualStrengthLevel`, `manualFiveElements`, `manualYongshinData` |
| 신강약 점수 | `interpretSchema.ts · computeStrengthLevel()` | `manualStrengthLevel` (수동 재정의 시) |
| 용신 기본 | `interpretSchema.ts · computeYongshinFull()` | `manualYongshinData` |
| 십성 분포 그룹 | `SajuReport.tsx · computeTenGodDistribution()` | `manualFiveElements` |
| 격국 판정 | `sajuPipeline.ts · buildInterpretationResult()` | `pillars`, `effectiveFiveElements` |
| 규칙 기반 해석 | `interpretationRules.ts · applyInterpretationRules()` | 파이프라인 전체 출력 |
| 신살 목록 | `luckCycles.ts · calculateShinsalFull()` | `pillars` (manualPillars 포함) |
| 대운/세운 | `luckCycles.ts · calculateLuckCycles()` | `birthInput`, `pillars` |

---

## 4. 신살 허용목록 (db.ts · VALID_SHINSAL_NAMES)

신살을 새로 추가하면 반드시 **두 곳**을 동시에 업데이트해야 합니다:

1. `artifacts/saju-app/src/lib/luckCycles.ts` → 계산 로직 + `ALL_SHINSAL_NAMES` + `SHINSAL_GROUPS` + `SHINSAL_DESC` + `SHINSAL_COLOR`
2. `artifacts/saju-app/src/lib/db.ts` → `VALID_SHINSAL_NAMES` Set

현재 허용된 신살:
```
도화, 홍염, 역마, 화개,
천을귀인, 문창귀인, 문곡귀인, 금여, 태극귀인, 천복귀인, 천의성, 천문성,
천덕귀인, 월덕귀인,
양인살, 장성살, 반안살,
겁살, 재살, 천살, 지살, 망신살, 육해살,
고신살, 과숙살, 귀문관살,
현침살, 백호살, 괴강살
```

---

## 5. 수동 테스트 시나리오 (create → edit → save → sync → load)

### 시나리오 A: 기본 사이클
1. 새 프로필 생성 → 사주 계산 확인
2. 로그아웃 후 재로그인 → 프로필 그대로인지 확인

### 시나리오 B: 종용신 보존
1. 용신 탭에서 억부용신 오행을 편집 → 저장
2. 다른 기기(또는 시크릿 창)에서 로그인
3. **종용신(보조:)이 동일하게 표시되는지 확인**
   - 종용신은 `manualStrengthLevel` + `manualFiveElements` 기반으로 재계산됨
   - 이 두 값이 저장되면 종용신도 자동 복원

### 시나리오 C: 천문성 보존
1. 신살 탭 → 수동 추가 → 천문성 추가
2. 저장 → 동기화 대기(약 2초) → 시크릿 창 로그인
3. **천문성이 신살 목록에 있는지 확인**

### 시나리오 D: 지지 관계 추가 보존
1. 지지 관계 수동 추가 → 천간합 선택 → **갑/을/기 등 천간 선택** → 추가
2. 지지육합 선택 → 자/축 등 지지 선택 → 추가
3. 저장 후 재로그인
4. **두 관계 모두 목록에 남아있는지 확인**

### 시나리오 E: 오행 편집 후 십성·종용신 재계산
1. 오행 편집 → 수치 변경 → 저장
2. 십성 분포가 즉시 업데이트되는지 확인
3. 종용신이 새 오행 기준으로 재계산되는지 확인
4. 재로그인 후 편집값이 유지되는지 확인

### 시나리오 F: 동기화 충돌 해결
1. 기기 A에서 편집 → 동기화 완료 전에 기기 B에서 다른 편집
2. 나중에 저장된 기기의 `updatedAt`이 더 최신이어야 함
3. Supabase 콘솔에서 `saju_payload.updatedAt` 확인

---

## 6. 알려진 위험 지점

| 위험 | 파일 | 설명 |
|------|------|------|
| **신살 허용목록 오래됨** | `db.ts · VALID_SHINSAL_NAMES` | 새 신살 추가 시 허용목록도 함께 업데이트 필수 |
| **yongshinData 타입 필터** | `db.ts · dbRowToRecord` | 구조 검증만 수행 — 타입 문자열은 보존 (수정됨) |
| **spread 순서** | `db.ts · dbRowToRecord` | `...payload` 뒤에 sanitised 값이 오므로 sanitised가 최종값 |
| **manualStrengthLevel null vs undefined** | `SajuReport.tsx` | null이면 자동계산, undefined도 동일하게 처리됨 |
| **authContext 덮어쓰기** | `authContext.tsx · syncWithSupabase` | 로그인 시 Supabase 데이터가 최신이면 localStorage를 덮어씀 — 오프라인 편집 후 로그인 시 손실 가능 |

---

## 7. 코드 위치 요약

| 역할 | 파일 |
|------|------|
| 스키마 정의 | `storage.ts · PersonRecord` |
| 신살 계산 | `luckCycles.ts · calculateShinsalFull()` |
| 신강약·용신 계산 | `interpretSchema.ts · computeStrengthLevel / computeYongshinFull` |
| 전체 파이프라인 | `sajuPipeline.ts · computeSajuPipeline()` |
| 해석 규칙 | `interpretationRules.ts · RULES[]` |
| DB 저장 | `db.ts · upsertMyProfile / upsertPartnerProfile` |
| DB 로드·정제 | `db.ts · dbRowToRecord` |
| Supabase 동기화 | `authContext.tsx · syncWithSupabase` |
| UI 렌더링 | `SajuReport.tsx` |
