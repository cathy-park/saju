// 21단계 — 셸(버튼 문구·열림 박스 스타일)을 자미두수 EvidenceToggle 기준의 공용
// EvidenceDisclosure로 통일했다(사주·자미두수와 동일한 "[왜 이런 결과인가요?]" /
// "근거 숨기기" 문구·spacing). 이 파일을 import하던 5개 서양점성술 evidence 컴포넌트는
// 그대로 두어도(재수출) 자동으로 새 셸을 쓰게 된다.
export { EvidenceDisclosure as WesternEvidenceDisclosure } from "@/components/EvidenceDisclosure";
