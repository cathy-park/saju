import { useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { getMyProfile, getPeople } from "@/lib/storage";

export function WesternPersonalRedirect() {
  const { personId } = useParams<{ personId: string }>(); const [, navigate] = useLocation();
  useEffect(() => { if (personId) navigate(`/western/${personId}/overview`, { replace: true }); }, [navigate, personId]);
  return null;
}
export function WesternSynastryRedirect() {
  const { personId, otherPersonId } = useParams<{ personId: string; otherPersonId: string }>(); const [, navigate] = useLocation();
  useEffect(() => { if (personId && otherPersonId) navigate(`/western/${personId}/synastry/${otherPersonId}/overview`, { replace: true }); }, [navigate, otherPersonId, personId]);
  return null;
}
export function WesternRelationshipEntry() {
  const { personId } = useParams<{ personId: string }>();
  const mine = getMyProfile(), other = getPeople().find((person) => person.id === personId);
  if (mine && other) return <RelationshipEntryRedirect selfId={mine.id} otherId={other.id} />;
  return <main className="ds-app-shell ds-page-pad py-8"><div className="ds-card ds-card-pad shadow-none"><h1 className="text-lg font-bold">내 프로필이 필요합니다</h1><p className="mt-2 text-sm text-muted-foreground">관계 서양점성술은 저장된 내 프로필과 선택한 상대를 비교합니다. 다른 사람을 내 정보로 대신 사용하지 않습니다.</p><Link href="/saju" className="mt-3 inline-flex min-h-11 items-center font-bold text-primary underline">내 프로필 등록하기</Link></div></main>;
}
function RelationshipEntryRedirect({ selfId, otherId }: { selfId: string; otherId: string }) { const [, navigate] = useLocation(); useEffect(() => navigate(`/western/${selfId}/synastry/${otherId}/overview`, { replace: true }), [navigate, otherId, selfId]); return null; }
