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
