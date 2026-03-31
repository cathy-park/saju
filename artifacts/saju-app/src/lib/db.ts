import { supabase } from "./supabase";
import type { PersonRecord } from "./storage";

// ── DB row types (match exact Supabase column names) ──────────────

export interface DbMyProfile {
  id: string;
  user_id: string;
  name: string;
  gender: string | null;
  birth_date: string;
  birth_time: string | null;
  calendar_type: string;
  birth_place: string | null;   // ← "birth_place" in Supabase
  saju_payload: unknown;
  created_at: string;
  updated_at: string;
}

export interface DbPartnerProfile {
  id: string;
  user_id: string;
  name: string;
  gender: string | null;
  birth_date: string;
  birth_time: string | null;
  calendar_type: string;
  memo: string | null;
  saju_payload: unknown;
  created_at: string;
  updated_at: string;
}

// ── Helpers: app record → DB column values ────────────────────────

function toBirthDate(r: PersonRecord): string {
  const i = r.birthInput;
  const year = Number(i.year);
  const month = Number(i.month);
  const day = Number(i.day);
  if (!i.year || !i.month || !i.day || isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`생년월일 데이터 오류 (year=${i.year}, month=${i.month}, day=${i.day})`);
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toBirthTime(r: PersonRecord): string | null {
  if (r.birthInput.timeUnknown) return null;
  const h = Number(r.birthInput.hour ?? 0);
  const m = Number(r.birthInput.minute ?? 0);
  if (isNaN(h) || isNaN(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Central mapper: PersonRecord → my_saju_profiles payload.
 * All DB column names must match the actual Supabase schema.
 *
 * Supabase columns: id, user_id, name, gender, birth_date, birth_time,
 *                   calendar_type, birth_place, saju_payload, created_at, updated_at
 */
function toMyProfilePayload(userId: string, record: PersonRecord) {
  const payload = {
    id:            record.id,
    user_id:       userId,
    name:          record.birthInput.name,
    gender:        record.birthInput.gender ?? "남",
    birth_date:    toBirthDate(record),
    birth_time:    toBirthTime(record),
    calendar_type: record.birthInput.calendarType ?? "solar",
    birth_place:   record.birthInput.birthplace ?? null,
    saju_payload:  record,
    updated_at:    new Date().toISOString(),
  };
  console.log("[db] my_saju_profiles payload →", payload);
  return payload;
}

/**
 * Central mapper: PersonRecord → partner_profiles payload.
 *
 * Supabase columns: id, user_id, name, gender, birth_date, birth_time,
 *                   calendar_type, memo, saju_payload, created_at, updated_at
 */
function toPartnerPayload(userId: string, record: PersonRecord) {
  const payload = {
    id:            record.id,
    user_id:       userId,
    name:          record.birthInput.name,
    gender:        record.birthInput.gender ?? "남",
    birth_date:    toBirthDate(record),
    birth_time:    toBirthTime(record),
    calendar_type: record.birthInput.calendarType ?? "solar",
    memo:          null,
    saju_payload:  record,
    updated_at:    new Date().toISOString(),
  };
  console.log("[db] partner_profiles payload →", payload);
  return payload;
}

// ── Validation allowlists ─────────────────────────────────────────
// Shinsal names that are valid in the current code version.
// Any name NOT in this set from old saju_payload is silently dropped.
const VALID_SHINSAL_NAMES = new Set([
  "도화", "홍염", "역마", "화개",
  "천을귀인", "문창귀인", "문곡귀인", "금여", "태극귀인", "천복귀인", "천의성", "천문성",
  "천덕귀인", "월덕귀인",
  "양인살", "장성살", "반안살",
  "겁살", "재살", "천살", "월살", "지살", "망신살", "육해살", "원진살",
  "고신살", "과숙살", "귀문관살", "암록",
  "현침살", "백호살", "괴강살",
]);

// Yongshin types in current UI.
// NOTE: We only DROP entries that are structurally malformed (missing type or elements).
//       We do NOT drop entries with unrecognized type strings, because:
//       - "종용신" or custom types the user manually entered must survive sync.
//       - Dropping on type-name mismatch causes data loss on schema evolution.
const KNOWN_YONGSHIN_TYPES = new Set(["억부용신", "조후용신", "통관용신", "병약용신"]);

// ── Helper: DB row → PersonRecord ─────────────────────────────────

function dbRowToRecord(row: DbMyProfile | DbPartnerProfile): PersonRecord {
  const payload = row.saju_payload as PersonRecord;
  const [yr, mo, dy] = row.birth_date.split("-").map(Number);
  const timeUnknown = row.birth_time === null;
  const [h, mi] = row.birth_time ? row.birth_time.split(":").map(Number) : [0, 0];

  // Sanitise manual shinsal: drop any name that no longer exists in the codebase
  const rawManualShinsal = payload.manualShinsal ?? [];
  const sanitisedManualShinsal = rawManualShinsal.filter((item) => {
    const ok = VALID_SHINSAL_NAMES.has(item.name);
    if (!ok) console.warn(`[db] dropping stale manualShinsal entry: "${item.name}"`);
    return ok;
  });

  const rawExcludedShinsal = payload.excludedAutoShinsal ?? [];
  const sanitisedExcludedShinsal = rawExcludedShinsal.filter((item) => {
    const ok = VALID_SHINSAL_NAMES.has(item.name);
    if (!ok) console.warn(`[db] dropping stale excludedAutoShinsal entry: "${item.name}"`);
    return ok;
  });

  // Sanitise manual yongshin data: drop only structurally malformed entries.
  // We intentionally keep entries with unrecognised type strings so that user-entered
  // values (e.g. "종용신", custom labels) survive a save → sync → load cycle.
  const rawYongshinData = payload.manualYongshinData ?? [];
  const sanitisedYongshinData = rawYongshinData.filter((entry) => {
    if (!entry || typeof entry.type !== "string" || !Array.isArray(entry.elements)) {
      console.warn(`[db] dropping malformed manualYongshinData entry`, entry);
      return false;
    }
    if (!KNOWN_YONGSHIN_TYPES.has(entry.type)) {
      console.info(`[db] preserving unrecognized manualYongshinData type: "${entry.type}"`);
    }
    return true;
  });

  return {
    ...payload,
    id: row.id,
    birthInput: {
      ...payload.birthInput,
      year:         yr,
      month:        mo,
      day:          dy,
      hour:         timeUnknown ? undefined : h,
      minute:       timeUnknown ? undefined : mi,
      timeUnknown,
      calendarType: (row.calendar_type ?? "solar") as "solar" | "lunar",
      birthplace:   (row as DbMyProfile).birth_place ?? undefined,
      name:         row.name,
      gender:       (row.gender ?? "남") as "남" | "여",
    },
    manualShinsal:      sanitisedManualShinsal.length > 0 ? sanitisedManualShinsal : undefined,
    excludedAutoShinsal: sanitisedExcludedShinsal.length > 0 ? sanitisedExcludedShinsal : undefined,
    manualYongshinData: sanitisedYongshinData.length > 0 ? sanitisedYongshinData : undefined,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  };
}

// ── My Profile ────────────────────────────────────────────────────

export async function fetchMyProfile(userId: string): Promise<PersonRecord | null> {
  const { data, error } = await supabase
    .from("my_saju_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[db] fetchMyProfile:", error);
    throw new Error(error.message);
  }
  if (!data) return null;
  return dbRowToRecord(data as DbMyProfile);
}

export async function upsertMyProfile(userId: string, record: PersonRecord): Promise<void> {
  const { error } = await supabase
    .from("my_saju_profiles")
    .upsert(toMyProfilePayload(userId, record), { onConflict: "id" });
  if (error) {
    console.error("[db] upsertMyProfile:", error);
    throw new Error(error.message);
  }
}

export async function deleteMyProfileFromDb(userId: string): Promise<void> {
  const { error } = await supabase
    .from("my_saju_profiles")
    .delete()
    .eq("user_id", userId);
  if (error) {
    console.error("[db] deleteMyProfile:", error);
    throw new Error(error.message);
  }
}

// ── Partner Profiles ──────────────────────────────────────────────

export async function fetchPartnerProfiles(userId: string): Promise<PersonRecord[]> {
  const { data, error } = await supabase
    .from("partner_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[db] fetchPartnerProfiles:", error);
    throw new Error(error.message);
  }
  if (!data) return [];
  return (data as DbPartnerProfile[]).map(dbRowToRecord);
}

export async function upsertPartnerProfile(userId: string, record: PersonRecord): Promise<void> {
  const { error } = await supabase
    .from("partner_profiles")
    .upsert(toPartnerPayload(userId, record), { onConflict: "id" });
  if (error) {
    console.error("[db] upsertPartnerProfile:", error);
    throw new Error(error.message);
  }
}

export async function deletePartnerProfile(id: string): Promise<void> {
  const { error } = await supabase.from("partner_profiles").delete().eq("id", id);
  if (error) {
    console.error("[db] deletePartnerProfile:", error);
    throw new Error(error.message);
  }
}

// ── Auth user mirror (profiles table) ────────────────────────────

export async function upsertUserProfile(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("profiles").upsert({
    id:         user.id,
    email:      user.email ?? null,
    full_name:  user.user_metadata?.full_name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) {
    console.error("[db] upsertUserProfile:", error);
    throw new Error(error.message);
  }
}
