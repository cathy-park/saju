import type { BirthInput, ComputedPillars, FiveElementCount, SajuProfile } from "./sajuEngine";

export type TenGodName =
  | "비견" | "겁재"
  | "식신" | "상관"
  | "편재" | "정재"
  | "편관" | "정관"
  | "편인" | "정인";

export type ManualTenGodCounts = Record<TenGodName, number>;

export interface ManualShinsalItem {
  position: string;
  name: string;
}

export interface ManualDerived {
  stemTenGod?:   Record<string, string>;
  branchTenGod?: Record<string, string>;
  hiddenStems?:  Record<string, string>;
  twelveStage?:  Record<string, string>;
  branchShinsal?: Record<string, string>;
}

export type MaritalStatus = "솔로" | "연애중" | "기혼" | "모름";
export type RelationshipType = "lover" | "spouse" | "friend" | "coworker" | "family" | "other";

export const RELATIONSHIP_TYPE_LABEL: Record<RelationshipType, string> = {
  lover:    "연인",
  spouse:   "배우자",
  friend:   "친구",
  coworker: "동료",
  family:   "가족",
  other:    "기타",
};
export const RELATIONSHIP_TYPE_EMOJI: Record<RelationshipType, string> = {
  lover:    "❤️",
  spouse:   "💍",
  friend:   "👫",
  coworker: "💼",
  family:   "🏠",
  other:    "🙂",
};

export interface ManualBranchRelation {
  type: string;
  branch1: string;
  branch2: string;
}

export interface FortuneOptions {
  daewoonStartAgeOverride?: number | null;
  /**
   * Expert option: Shinsal rule strictness.
   * "conservative" → only high-confidence shinsal (smaller set, fewer false positives)
   * "expanded"     → full shinsal set including minor / contextual ones
   * Default: "default" (balanced — current auto behavior)
   */
  shinsalMode?: "conservative" | "default" | "expanded";
  /**
   * Expert option: Disable 조후 보정 (seasonal adjustment on yongshin secondary).
   * When true, yongshin secondary is determined purely by 억부법, ignoring season.
   */
  seasonalAdjustmentOff?: boolean;
  /**
   * Expert option: Apply 천간합화 (Heavenly Stem Combination Transformation).
   * When two matching stems combine (e.g. 甲+己→土), their element contribution changes.
   * Disabled by default because it is complex and context-dependent.
   */
  ganhapChemyong?: boolean;

  // ── Time-correction expert options ─────────────────────────────────
  /**
   * 진태양시 (True Solar Time): adds Equation of Time (균시차, ±16 min)
   * on top of local-meridian correction before computing hour pillar & daewoon.
   * Default: false (most standard manseoryeok apps do not apply EoT).
   */
  trueSolarTimeOn?: boolean;
  /**
   * 지역시 (Local Mean Time): applies longitude-based meridian correction
   * (standard meridian 135°E → birth longitude, 4 min/degree).
   * Default: true — disabling passes applyTimeCorrection:false to the library.
   */
  localMeridianOn?: boolean;
  /**
   * 절입시각 정확 계산: uses actual birth hour/minute (KST→UTC) for
   * 대운수 solar-term distance calculation instead of fixed noon.
   * Default: true — this was previously always hardcoded to noon (bug).
   */
  exactSolarTermBoundaryOn?: boolean;
}

export interface PersonRecord {
  id: string;
  birthInput: BirthInput;
  profile: SajuProfile;
  manualPillars?: Partial<ComputedPillars>;
  manualShinsal?: ManualShinsalItem[];
  excludedAutoShinsal?: ManualShinsalItem[];
  maritalStatus?: MaritalStatus;
  relationshipType?: RelationshipType;
  manualStrengthLevel?: string;
  manualYongshin?: string;
  manualYongshinData?: { type: string; elements: string[] }[];
  manualBranchRelationAdd?: ManualBranchRelation[];
  manualBranchRelationRemove?: string[];
  manualDerived?: ManualDerived;
  manualFiveElements?: FiveElementCount;
  manualTenGodCounts?: ManualTenGodCounts;
  fortuneOptions?: FortuneOptions;
  createdAt: string;
  updatedAt: string;
}

export interface AppStorage {
  myProfile: PersonRecord | null;
  people: PersonRecord[];
}

const STORAGE_KEY = "saju_app_v1";

export function load(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { myProfile: null, people: [] };
    return JSON.parse(raw) as AppStorage;
  } catch {
    return { myProfile: null, people: [] };
  }
}

export function save(data: AppStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getMyProfile(): PersonRecord | null {
  return load().myProfile;
}

export function saveMyProfile(record: PersonRecord): void {
  const data = load();
  data.myProfile = record;
  save(data);
}

export function getPeople(): PersonRecord[] {
  return load().people;
}

export function savePerson(record: PersonRecord): void {
  const data = load();
  const idx = data.people.findIndex((p) => p.id === record.id);
  if (idx >= 0) {
    data.people[idx] = record;
  } else {
    data.people.push(record);
  }
  save(data);
}

export function deletePerson(id: string): void {
  const data = load();
  data.people = data.people.filter((p) => p.id !== id);
  save(data);
}

export function createRecord(
  birthInput: BirthInput,
  profile: SajuProfile
): PersonRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    birthInput,
    profile,
    createdAt: now,
    updatedAt: now,
  };
}

export function saveManualShinsal(recordId: string, items: ManualShinsalItem[]): void {
  const data = load();
  if (data.myProfile?.id === recordId) {
    data.myProfile = { ...data.myProfile, manualShinsal: items, updatedAt: new Date().toISOString() };
  }
  const idx = data.people.findIndex((p) => p.id === recordId);
  if (idx >= 0) {
    data.people[idx] = { ...data.people[idx], manualShinsal: items, updatedAt: new Date().toISOString() };
  }
  save(data);
}

export function saveExcludedAutoShinsal(recordId: string, items: ManualShinsalItem[]): void {
  const data = load();
  if (data.myProfile?.id === recordId) {
    data.myProfile = { ...data.myProfile, excludedAutoShinsal: items, updatedAt: new Date().toISOString() };
  }
  const idx = data.people.findIndex((p) => p.id === recordId);
  if (idx >= 0) {
    data.people[idx] = { ...data.people[idx], excludedAutoShinsal: items, updatedAt: new Date().toISOString() };
  }
  save(data);
}

export function saveMaritalStatus(recordId: string, status: MaritalStatus | undefined): void {
  const data = load();
  if (data.myProfile?.id === recordId) {
    data.myProfile = { ...data.myProfile, maritalStatus: status, updatedAt: new Date().toISOString() };
  }
  const idx = data.people.findIndex((p) => p.id === recordId);
  if (idx >= 0) {
    data.people[idx] = { ...data.people[idx], maritalStatus: status, updatedAt: new Date().toISOString() };
  }
  save(data);
}

export function updatePersonRecord(recordId: string, patch: Partial<PersonRecord>): void {
  const data = load();
  const now = new Date().toISOString();
  if (data.myProfile?.id === recordId) {
    data.myProfile = { ...data.myProfile, ...patch, updatedAt: now };
  }
  const idx = data.people.findIndex((p) => p.id === recordId);
  if (idx >= 0) {
    data.people[idx] = { ...data.people[idx], ...patch, updatedAt: now };
  }
  save(data);
}

export function getFinalPillars(record: PersonRecord) {
  const base = record.profile.computedPillars;
  const manual = record.manualPillars ?? {};
  return {
    year: manual.year ?? base.year,
    month: manual.month ?? base.month,
    day: manual.day ?? base.day,
    hour: manual.hour !== undefined ? manual.hour : base.hour,
  };
}
