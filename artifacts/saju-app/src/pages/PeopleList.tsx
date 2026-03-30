import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getPeople,
  deletePerson,
  getFinalPillars,
  type PersonRecord,
  type RelationshipType,
  RELATIONSHIP_TYPE_LABEL,
  RELATIONSHIP_TYPE_EMOJI,
} from "@/lib/storage";
import { getZodiacFromDayPillar } from "@/lib/zodiacAnimal";
import { Search, UserPlus, Trash2, Pencil, Heart, Check } from "lucide-react";
import { Mascot } from "@/components/Mascot";
import { useAuth } from "@/lib/authContext";
import { deletePartnerProfile } from "@/lib/db";

type TabKey = "전체" | RelationshipType;

const REL_TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: "전체",      label: "전체",   emoji: "" },
  { key: "lover",     label: "연인",   emoji: RELATIONSHIP_TYPE_EMOJI["lover"] },
  { key: "spouse",    label: "배우자", emoji: RELATIONSHIP_TYPE_EMOJI["spouse"] },
  { key: "friend",    label: "친구",   emoji: RELATIONSHIP_TYPE_EMOJI["friend"] },
  { key: "coworker",  label: "동료",   emoji: RELATIONSHIP_TYPE_EMOJI["coworker"] },
  { key: "family",    label: "가족",   emoji: RELATIONSHIP_TYPE_EMOJI["family"] },
  { key: "other",     label: "기타",   emoji: RELATIONSHIP_TYPE_EMOJI["other"] },
];

function PersonCard({
  record,
  onDelete,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  record: PersonRecord;
  onDelete: () => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const pillars = getFinalPillars(record);
  const input = record.birthInput;
  const dayStem   = pillars.day?.hangul?.[0] ?? "";
  const dayBranch = pillars.day?.hangul?.[1] ?? "";
  const dayHangul = pillars.day?.hangul ?? "";
  const zodiac    = getZodiacFromDayPillar(dayHangul);
  const STEM_EL: Record<string, string> = { 갑:"목",을:"목",병:"화",정:"화",무:"토",기:"토",경:"금",신:"금",임:"수",계:"수" };
  const EL_PASTEL: Record<string, string> = { 목:"#DFF4E4",화:"#FFE3E3",토:"#FFF1D6",금:"#F2F2F2",수:"#E3F1FF" };
  const thumbBg = dayStem ? (EL_PASTEL[STEM_EL[dayStem]] ?? "#F0F0F0") : "#F0F0F0";

  return (
    <div
      className={`rounded-xl border bg-card px-4 py-3.5 transition-colors ${
        selectionMode
          ? selected
            ? "border-primary bg-primary/5 cursor-pointer"
            : "border-border cursor-pointer"
          : "border-border"
      }`}
      onClick={selectionMode ? () => onToggleSelect(record.id) : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectionMode && (
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              selected ? "bg-primary border-primary" : "border-muted-foreground/40"
            }`}>
              {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
          )}
          <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center" style={{ background: `radial-gradient(circle at 50% 60%, ${thumbBg} 0%, ${thumbBg}88 100%)` }}>
            {zodiac ? (
              <img src={zodiac.src} alt={zodiac.label} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-muted-foreground">{input.name.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{input.name}</span>
              <span className="text-[13px] text-muted-foreground">{input.gender}</span>
              {dayStem && (
                <span className="text-[13px] text-muted-foreground/60">
                  {dayStem}{dayBranch}일주
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {input.year}. {input.month}. {input.day}
              {!input.timeUnknown && ` · ${input.hour}시`}
            </p>
          </div>
        </div>

        {!selectionMode && (
          <div className="flex items-center gap-0 shrink-0">
            <Link href={`/people/${record.id}/edit`}>
              <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-muted/50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>삭제하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {input.name}님의 사주 정보를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {!selectionMode && (
        <div className="flex gap-2 mt-3">
          <Link href={`/people/${record.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-[13px]">
              사주 보기
            </Button>
          </Link>
          <Link href={`/compatibility/${record.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-1 text-[13px]">
              <Heart className="h-3 w-3 text-rose-400" />
              궁합 보기
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-14 text-center">
      <Mascot expression="lonely" size={80} />
      <div>
        <p className="font-semibold text-foreground">아직 등록된 상대가 없어요</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-[220px] mx-auto leading-relaxed">
          상대를 추가하면 사주 분석과 궁합을 확인할 수 있어요
        </p>
      </div>
      <Link href="/people/add">
        <Button className="mt-1 gap-2">
          <UserPlus className="h-4 w-4" />
          상대 추가하기
        </Button>
      </Link>
    </div>
  );
}

export default function PeopleList() {
  const [people, setPeople] = useState<PersonRecord[]>(() => getPeople());
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("전체");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { user, dbSynced } = useAuth();
  const [, navigate] = useLocation();

  // Re-read the people list from localStorage after DB sync completes
  useEffect(() => {
    if (dbSynced) {
      setPeople(getPeople());
    }
  }, [dbSynced]);

  async function handleDelete(id: string) {
    deletePerson(id);
    setPeople(getPeople());
    if (user) {
      await deletePartnerProfile(id);
    }
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  function handleEnterSelectionMode() {
    setSelectionMode(true);
    setSelectedIds([]);
  }

  function handleCancelSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  function handleGoCompatibility() {
    if (selectedIds.length !== 2) return;
    navigate(`/compatibility?a=${selectedIds[0]}&b=${selectedIds[1]}`);
  }

  const searchFiltered = people.filter((p) =>
    p.birthInput.name.includes(search)
  );

  const visibleTabs = REL_TABS.filter((t) => {
    if (t.key === "전체") return true;
    return searchFiltered.some((p) => p.relationshipType === t.key);
  });

  const tabFiltered =
    activeTab === "전체"
      ? searchFiltered
      : searchFiltered.filter((p) => p.relationshipType === activeTab);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-32">

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">상대</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {selectionMode
              ? `${selectedIds.length}/2명 선택됨`
              : people.length > 0
              ? `${people.length}명 등록됨`
              : "등록된 상대가 없습니다"}
          </p>
        </div>
        {people.length > 0 && (
          <div className="flex items-center gap-2">
            {selectionMode ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleCancelSelectionMode}
              >
                취소
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-[13px]"
                  onClick={handleEnterSelectionMode}
                >
                  <Heart className="h-3.5 w-3.5 text-rose-400" />
                  궁합 비교
                </Button>
                <Link href="/people/add">
                  <Button size="sm" className="gap-1.5">
                    <UserPlus className="h-3.5 w-3.5" />
                    추가
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {people.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름으로 검색"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-4">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-shrink-0 text-[13px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  activeTab === t.key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground/40"
                }`}
              >
                {t.emoji ? `${t.emoji} ` : ""}{t.label}
              </button>
            ))}
          </div>

          {/* Person list */}
          {tabFiltered.length === 0 ? (
            <div className="text-center py-12">
              {search ? (
                <>
                  <p className="text-muted-foreground">"{search}"와 일치하는 상대가 없습니다</p>
                  <button onClick={() => setSearch("")} className="mt-2 text-sm text-primary">검색 초기화</button>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">이 카테고리에 등록된 상대가 없어요</p>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {tabFiltered.map((p) => (
                <PersonCard
                  key={p.id}
                  record={p}
                  onDelete={() => handleDelete(p.id)}
                  selectionMode={selectionMode}
                  selected={selectedIds.includes(p.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Sticky selection footer */}
      {selectionMode && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-30">
          <div className="w-full max-w-lg">
            <Button
              className="w-full h-12 gap-2 text-[15px] font-bold shadow-lg"
              disabled={selectedIds.length !== 2}
              onClick={handleGoCompatibility}
            >
              <Heart className="h-4 w-4" />
              {selectedIds.length === 2
                ? "궁합 분석하기"
                : `2명 선택해주세요 (${selectedIds.length}/2)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
