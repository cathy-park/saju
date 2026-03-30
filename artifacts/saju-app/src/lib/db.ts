import { supabase } from "./supabase";
import type { PersonRecord } from "./storage";
import { load as loadLocal, save as saveLocal } from "./storage";

// ── Types ─────────────────────────────────────────────────────────

export interface DbMyProfile {
  id: string;
  user_id: string;
  name: string;
  gender: string | null;
  birth_date: string;
  birth_time: string | null;
  birth_calendar_type: string;
  birthplace: string | null;
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
  birth_calendar_type: string;
  memo: string | null;
  saju_payload: unknown;
  created_at: string;
  updated_at: string;
}

// ── Conversion helpers ────────────────────────────────────────────

function recordToBirthDate(r: PersonRecord): string {
  const i = r.birthInput;
  return `${i.year}-${String(i.month).padStart(2, "0")}-${String(i.day).padStart(2, "0")}`;
}

function recordToBirthTime(r: PersonRecord): string | null {
  if (r.birthInput.timeUnknown) return null;
  const h = r.birthInput.hour ?? 0;
  const m = r.birthInput.minute ?? 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dbRowToRecord(row: DbMyProfile | DbPartnerProfile): PersonRecord {
  const payload = row.saju_payload as PersonRecord;
  const birthDate = row.birth_date;
  const [yr, mo, dy] = birthDate.split("-").map(Number);
  const timeUnknown = row.birth_time === null;
  const [h, mi] = row.birth_time ? row.birth_time.split(":").map(Number) : [0, 0];
  return {
    ...payload,
    id: row.id,
    birthInput: {
      ...payload.birthInput,
      year: yr,
      month: mo,
      day: dy,
      hour: timeUnknown ? undefined : h,
      minute: timeUnknown ? undefined : mi,
      timeUnknown,
      calendarType: (row.birth_calendar_type ?? "solar") as "solar" | "lunar",
      birthplace: (row as DbMyProfile).birthplace ?? undefined,
      name: row.name,
      gender: (row.gender ?? "남") as "남" | "여",
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  if (error) { console.error("[db] fetchMyProfile:", error); return null; }
  if (!data) return null;
  return dbRowToRecord(data as DbMyProfile);
}

export async function upsertMyProfile(userId: string, record: PersonRecord): Promise<void> {
  const { error } = await supabase.from("my_saju_profiles").upsert({
    id: record.id,
    user_id: userId,
    name: record.birthInput.name,
    gender: record.birthInput.gender ?? "남",
    birth_date: recordToBirthDate(record),
    birth_time: recordToBirthTime(record),
    birth_calendar_type: record.birthInput.calendarType ?? "solar",
    birthplace: record.birthInput.birthplace ?? null,
    saju_payload: record,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) console.error("[db] upsertMyProfile:", error);
}

// ── Partner Profiles ──────────────────────────────────────────────

export async function fetchPartnerProfiles(userId: string): Promise<PersonRecord[]> {
  const { data, error } = await supabase
    .from("partner_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[db] fetchPartnerProfiles:", error); return []; }
  if (!data) return [];
  return (data as DbPartnerProfile[]).map(dbRowToRecord);
}

export async function upsertPartnerProfile(userId: string, record: PersonRecord): Promise<void> {
  const { error } = await supabase.from("partner_profiles").upsert({
    id: record.id,
    user_id: userId,
    name: record.birthInput.name,
    gender: record.birthInput.gender ?? "남",
    birth_date: recordToBirthDate(record),
    birth_time: recordToBirthTime(record),
    birth_calendar_type: record.birthInput.calendarType ?? "solar",
    memo: null,
    saju_payload: record,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) console.error("[db] upsertPartnerProfile:", error);
}

export async function deletePartnerProfile(id: string): Promise<void> {
  const { error } = await supabase.from("partner_profiles").delete().eq("id", id);
  if (error) console.error("[db] deletePartnerProfile:", error);
}

// ── Migration: local → Supabase (one-time, on first login) ───────

const MIGRATED_KEY = "saju_migrated_v1";

export async function migrateLocalToSupabase(userId: string): Promise<void> {
  if (localStorage.getItem(MIGRATED_KEY) === "1") return;

  const local = loadLocal();
  const tasks: Promise<void>[] = [];

  if (local.myProfile) {
    tasks.push(upsertMyProfile(userId, local.myProfile));
  }
  for (const person of local.people) {
    tasks.push(upsertPartnerProfile(userId, person));
  }

  await Promise.all(tasks);
  localStorage.setItem(MIGRATED_KEY, "1");
  console.log("[db] local data migrated to Supabase");
}

// ── Upsert profile record in Supabase's auth.users mirror table ──

export async function upsertUserProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Promise<void> {
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    full_name: user.user_metadata?.full_name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) console.error("[db] upsertUserProfile:", error);
}
