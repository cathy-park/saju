import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { SHINSAL_COLOR, SHINSAL_DESC } from "@/lib/luckCycles";
import { getTenGodTw, getTenGodDescription } from "@/lib/tenGods";
import type { TenGod } from "@/lib/tenGods";
import { RELATION_DETAIL, RELATION_DESC, RELATION_COLORS } from "@/lib/branchRelations";
import type { RelationType } from "@/lib/branchRelations";

// ── Shinsal Detail Content ─────────────────────────────────────────

interface ShinsalDetail {
  meaning: string;
  personality: string;
  relationship: string;
  caution: string;
  advantage: string;
}

const SHINSAL_DETAIL: Record<string, ShinsalDetail> = {
  도화: {
    meaning: "매력과 인기, 이성운을 상징하는 별입니다. 사람을 끌어당기는 카리스마와 미적 감각이 뛰어납니다.",
    personality: "사교적이고 감성적이며 예술적 취향이 강합니다. 주변 사람들에게 호감을 줍니다.",
    relationship: "이성에게 인기가 많고 연애 기회가 풍부합니다. 다만 이성 관계가 복잡해지기도 합니다.",
    caution: "지나친 이성 관계나 감정에 치우치지 않도록 주의가 필요합니다.",
    advantage: "뛰어난 매력과 소통 능력으로 대인관계와 사회 활동에서 강점을 발휘합니다.",
  },
  홍염: {
    meaning: "붉은 불꽃처럼 정열적이고 화려한 기운을 가진 별입니다.",
    personality: "감정이 풍부하고 표현이 직접적입니다. 예술·연기·음악 분야와 인연이 깊습니다.",
    relationship: "연애에 있어 열정적이며 상대를 압도하는 매력이 있습니다.",
    caution: "감정 기복이 크고 충동적인 선택을 할 수 있으므로 냉정함을 유지하세요.",
    advantage: "열정과 창의성으로 예술·방송·연예 분야에서 두각을 나타낼 수 있습니다.",
  },
  역마: {
    meaning: "이동, 변화, 여행을 상징하는 별입니다. 한 곳에 머물기보다 끊임없이 움직이는 에너지입니다.",
    personality: "활동적이고 모험을 즐기며 새로운 것을 빠르게 받아들입니다.",
    relationship: "장거리 연애나 해외 인연의 가능성이 높습니다. 만남이 빠르게 이루어질 수 있습니다.",
    caution: "정착과 안정을 유지하는 것이 과제입니다. 급하게 결정하지 않도록 주의하세요.",
    advantage: "여행, 무역, 외국어, 이동이 많은 직업에서 강점을 발휘합니다.",
  },
  화개: {
    meaning: "종교, 예술, 학문, 고독의 기운을 지닌 별입니다. 정신적 깊이가 있습니다.",
    personality: "내면 세계가 풍부하고 철학적 사고를 즐깁니다. 혼자 있는 시간을 소중히 여깁니다.",
    relationship: "자신만의 세계가 강해 관계에서 거리를 두는 경향이 있습니다.",
    caution: "고립감을 느낄 수 있으니 열린 마음으로 소통하는 연습이 필요합니다.",
    advantage: "예술, 종교, 학문, 상담 분야에서 깊은 통찰력을 발휘합니다.",
  },
  천을귀인: {
    meaning: "하늘이 내린 귀인의 별입니다. 위기 상황에서 도움을 주는 사람이 나타납니다.",
    personality: "사람들과 잘 어울리며 언제나 도움을 받고 돌아오는 좋은 인연이 있습니다.",
    relationship: "좋은 인연을 만날 운이 강합니다. 상대방도 귀한 사람일 가능성이 높습니다.",
    caution: "귀인 복이 있더라도 스스로의 노력이 뒷받침되어야 빛을 발합니다.",
    advantage: "사람들의 도움을 받아 큰 일을 이루거나 위기를 넘기는 힘이 있습니다.",
  },
  문창귀인: {
    meaning: "학문과 지혜, 예술적 재능을 상징하는 별입니다.",
    personality: "두뇌가 명석하고 언어·글·예술 방면에 재능이 있습니다.",
    relationship: "지적 대화와 공감을 중시하며 비슷한 관심사를 가진 사람에게 끌립니다.",
    caution: "머리로만 판단하고 감정 표현에 소극적일 수 있습니다.",
    advantage: "글쓰기, 교육, 연구, 기획 분야에서 뛰어난 능력을 발휘합니다.",
  },
  문곡귀인: {
    meaning: "언변과 글재주, 지략을 상징하는 별입니다.",
    personality: "말 솜씨가 뛰어나고 설득력이 있습니다. 전략적 사고를 잘 합니다.",
    relationship: "대화로 관계를 풀어나가는 능력이 탁월합니다.",
    caution: "논리에 치우쳐 감성적 소통을 놓칠 수 있습니다.",
    advantage: "법조, 언론, 컨설팅, 협상 분야에 강합니다.",
  },
  금여: {
    meaning: "황금 수레의 별로, 우아함과 품위를 상징합니다.",
    personality: "품격 있는 취향과 세련된 매너를 지닙니다. 귀품이 느껴지는 사람입니다.",
    relationship: "이성에게 귀하고 격이 있는 인상을 줍니다. 좋은 배우자 인연과 연결됩니다.",
    caution: "지나친 완벽주의나 까다로움이 관계를 어렵게 할 수 있습니다.",
    advantage: "예술·패션·서비스 분야에서 자연스럽게 빛납니다.",
  },
  양인살: {
    meaning: "강인함과 결단력, 도전적 기운을 지닌 별입니다. 강력한 추진 에너지를 상징합니다.",
    personality: "의지가 강하고 직선적입니다. 역경을 이겨내는 힘이 있으며 강한 추진력을 발휘합니다.",
    relationship: "리더십이 강하여 관계에서 주도권을 잡으려는 경향이 있습니다. 갈등 가능성에 유의하세요.",
    caution: "공격적으로 보일 수 있으며 충동적 판단이 갈등을 일으킬 수 있습니다. 부드러움을 더하세요.",
    advantage: "군인, 경찰, 의료, 스포츠, 기술직에서 강한 결단력으로 두각을 나타냅니다.",
  },
  장성살: {
    meaning: "장군의 별로, 리더십과 성취, 명예를 상징합니다.",
    personality: "카리스마가 있고 조직을 이끄는 능력이 뛰어납니다.",
    relationship: "파트너에게 신뢰감을 주지만 권위적으로 느껴질 수 있습니다.",
    caution: "독단적 결정을 피하고 상대방의 의견도 경청하세요.",
    advantage: "경영, 정치, 군사, 리더십 분야에서 두각을 나타냅니다.",
  },
  반안살: {
    meaning: "안장의 별로, 안정과 축적을 상징합니다.",
    personality: "신중하고 보수적이며 실용적입니다. 꼼꼼하게 준비하는 성격입니다.",
    relationship: "안정적인 관계를 선호하며 신뢰를 중시합니다.",
    caution: "변화에 대한 저항이 클 수 있습니다. 유연성을 키우세요.",
    advantage: "재정 관리, 부동산, 안정적인 직업에서 능력을 발휘합니다.",
  },
  천덕귀인: {
    meaning: "하늘의 덕을 받은 별로, 큰 보호와 가호가 있습니다.",
    personality: "선한 마음씨와 덕스러운 성품을 지닙니다.",
    relationship: "주변 사람들로부터 자연스럽게 도움과 애정을 받습니다.",
    caution: "타인에게 의존하지 않고 스스로의 능력을 개발하는 것도 중요합니다.",
    advantage: "큰 위기를 피해가는 보호막 역할을 하며, 사람들에게 덕을 베풀 수 있습니다.",
  },
  월덕귀인: {
    meaning: "달의 덕을 받은 별로, 재난과 액운을 방어하는 힘이 있습니다.",
    personality: "온화하고 배려심이 깊습니다.",
    relationship: "주변을 편안하게 하는 분위기를 가지고 있습니다.",
    caution: "너무 양보만 하다가 자신의 것을 잃지 않도록 주의하세요.",
    advantage: "나쁜 기운을 완화시키고 관계를 부드럽게 이어주는 능력이 있습니다.",
  },
  백호살: {
    meaning: "백호대살로, 강렬한 에너지와 돌발적 사건을 상징합니다.",
    personality: "강렬하고 직접적인 성격입니다. 결단력이 있지만 충동적인 면도 있습니다.",
    relationship: "강한 카리스마로 이성을 끌어당기지만 갈등을 일으키기도 합니다.",
    caution: "사고, 수술, 혈관 관련 건강 이슈에 주의가 필요합니다. 충동적 행동을 삼가세요.",
    advantage: "군인, 외과의사, 경찰, 스포츠 등 강인함이 필요한 분야에서 두각을 나타냅니다.",
  },
  괴강살: {
    meaning: "독특하고 강직한 기운의 별입니다. 범상치 않은 개성을 지닙니다.",
    personality: "자기 원칙이 강하고 타협을 잘 하지 않습니다. 독창적인 사고를 합니다.",
    relationship: "독특한 매력이 있지만 고집이 강해 파트너와 갈등이 생길 수 있습니다.",
    caution: "융통성을 키우고 타인의 다양한 의견을 받아들이는 연습을 하세요.",
    advantage: "독립적인 분야나 창업, 예술, 연구 분야에서 독보적인 성과를 낼 수 있습니다.",
  },
  학당귀인: {
    meaning: "학문의 귀인으로, 지식·연구·교육의 기운을 담은 별입니다.",
    personality: "학습 능력이 뛰어나고 집중력이 강합니다. 지적 탐구를 즐깁니다.",
    relationship: "공통의 관심사와 지적 대화로 깊은 관계를 형성합니다.",
    caution: "지나친 완벽주의나 이론에 치우쳐 현실적 감각을 놓치지 않도록 하세요.",
    advantage: "교육·연구·학문·기술 분야에서 두각을 나타내며 전문가로 성장합니다.",
  },
  암록: {
    meaning: "숨은 녹봉의 별로, 드러나지 않는 재물과 비공식적 기회를 상징합니다.",
    personality: "보이지 않는 곳에서 기회를 포착하는 능력이 있습니다.",
    relationship: "표면에 드러나지 않는 인연이나 뒤에서 돕는 귀인이 있을 수 있습니다.",
    caution: "기회를 잡기 위한 적극적인 행동도 필요합니다. 지나친 수동적 자세는 피하세요.",
    advantage: "숨어 있는 재물운과 보이지 않는 지원이 뒤에서 작동합니다.",
  },
  복성귀인: {
    meaning: "복을 가져다 주는 귀인의 별로, 보호와 위기 회복력을 상징합니다.",
    personality: "위기 상황에서도 빠르게 회복하는 강인한 내면이 있습니다.",
    relationship: "주변에 나를 도와주는 사람들이 많이 모이는 운이 있습니다.",
    caution: "귀인 복에 의지하되 스스로의 능력도 갈고 닦는 것이 중요합니다.",
    advantage: "어려운 상황에서도 행운이 따라 위기를 극복하는 힘이 있습니다.",
  },
  국인귀인: {
    meaning: "나라의 귀인, 공직과 조직에서의 공식적 지원을 상징하는 별입니다.",
    personality: "조직과 공적 체계에서 능력을 발휘하는 기운이 있습니다.",
    relationship: "공적인 만남에서 귀인을 만나는 인연이 있습니다.",
    caution: "사적 관계와 공적 관계를 명확히 구분하는 것이 중요합니다.",
    advantage: "공무원, 공기업, 조직 내 승진 등 공식 경로에서 귀인의 도움을 받습니다.",
  },
  천관귀인: {
    meaning: "하늘이 내린 관직의 귀인으로, 명예와 지위를 상징하는 별입니다.",
    personality: "공적 분야에서 인정받고 지위가 높아지는 기운이 있습니다.",
    relationship: "권위 있는 사람과의 인연이나 사회적 지위가 높은 상대와의 만남이 있습니다.",
    caution: "권위에 집착하지 않고 겸손한 자세를 유지하는 것이 중요합니다.",
    advantage: "명예직, 관리직, 리더십이 필요한 자리에서 귀인의 보살핌을 받습니다.",
  },
  천주귀인: {
    meaning: "하늘의 주인 귀인으로, 강력한 보호와 축복을 상징하는 별입니다.",
    personality: "어떤 상황에서도 하늘의 보호를 받는 듯한 기운이 있습니다.",
    relationship: "인생의 중요한 순간마다 결정적 도움이 나타납니다.",
    caution: "지나친 의존보다는 자신의 노력도 함께 기울이는 것이 중요합니다.",
    advantage: "위기에서 구해주는 강력한 귀인의 기운이 삶 전반에 작동합니다.",
  },
  태극귀인: {
    meaning: "큰 전환과 복덕을 가져오는 귀인의 별입니다.",
    personality: "변화의 시기에 귀인을 만나 새로운 기회를 얻는 운이 있습니다.",
    relationship: "중요한 전환점에서 인연이 생기거나 관계가 크게 변화합니다.",
    caution: "변화를 두려워하지 말고 새로운 기회를 받아들이세요.",
    advantage: "삶의 전환기마다 좋은 사람들의 도움을 받을 수 있습니다.",
  },
  겁살: {
    meaning: "위협과 손재, 강탈의 기운을 가진 살입니다.",
    personality: "충동적이고 극단적인 상황에 놓이기 쉽습니다.",
    relationship: "갑작스러운 관계 변화나 배신의 가능성에 주의해야 합니다.",
    caution: "재물 손실, 강도, 사고에 주의하세요. 소중한 것을 잃지 않도록 경계하세요.",
    advantage: "위기 상황에서 강한 대처 능력을 발휘할 수 있습니다.",
  },
  재살: {
    meaning: "재난과 사고를 상징하는 살입니다.",
    personality: "위기 상황에 자주 노출되는 경향이 있습니다.",
    relationship: "관계에서 예상치 못한 어려움이 생길 수 있습니다.",
    caution: "건강, 사고, 법적 문제에 주의가 필요합니다. 방어적 대비가 중요합니다.",
    advantage: "위기 대처 능력과 회복력이 강해집니다.",
  },
  천살: {
    meaning: "하늘이 내리는 재액의 기운입니다.",
    personality: "예기치 못한 하늘의 시련을 맞이할 수 있습니다.",
    relationship: "관계에서 외부적 요인(환경, 사회)에 의한 방해가 있을 수 있습니다.",
    caution: "자연재해, 상위 권력과의 마찰에 주의하세요.",
    advantage: "큰 시련을 통해 더 강한 인내력과 지혜를 얻을 수 있습니다.",
  },
  지살: {
    meaning: "이동과 출행, 변동을 나타내는 살입니다.",
    personality: "자주 이사하거나 직업을 바꾸는 경향이 있습니다.",
    relationship: "거리가 있는 관계나 자주 만남이 끊기는 관계가 될 수 있습니다.",
    caution: "한 곳에서 뿌리를 내리는 것이 어려울 수 있습니다. 안정을 위한 노력이 필요합니다.",
    advantage: "다양한 경험과 넓은 인맥을 쌓을 수 있습니다.",
  },
  망신살: {
    meaning: "망신과 구설수, 명예 손상을 상징하는 살입니다.",
    personality: "예상치 못한 곳에서 망신을 당하거나 구설에 오를 수 있습니다.",
    relationship: "관계에서 오해나 스캔들이 생길 수 있습니다.",
    caution: "언행을 조심하고 공과 사를 명확히 하세요. SNS 등 공개적 발언에 주의하세요.",
    advantage: "이 경험을 통해 겸손함과 신중함을 배울 수 있습니다.",
  },
  육해살: {
    meaning: "여섯 가지 해악, 갈등과 충돌을 상징하는 살입니다.",
    personality: "인간관계에서 갈등이 잦고 오해가 생기기 쉽습니다.",
    relationship: "가까운 사람과 불화가 생기거나 관계가 틀어질 수 있습니다.",
    caution: "감정적으로 대응하지 않고 이성적으로 갈등을 풀어가세요.",
    advantage: "갈등을 겪으며 인간 관계를 보는 눈이 길러집니다.",
  },
  고신살: {
    meaning: "고독과 이별, 독립적 삶을 상징하는 별입니다.",
    personality: "독립적이며 혼자만의 시간을 즐깁니다. 외로움을 느낄 때도 있습니다.",
    relationship: "배우자나 파트너와의 이별, 기러기 생활의 가능성이 있습니다.",
    caution: "고립감에 빠지지 않도록 적극적으로 관계를 유지하는 노력이 필요합니다.",
    advantage: "강한 자립심과 독립적 능력으로 혼자서도 잘 헤쳐나갈 힘이 있습니다.",
  },
  과숙살: {
    meaning: "외로움과 독신 기운을 나타내는 별입니다.",
    personality: "혼자만의 공간을 중시하고 감정 표현을 아끼는 경향이 있습니다.",
    relationship: "결혼이 늦거나 혼자 지내는 기간이 길 수 있습니다.",
    caution: "감정을 너무 닫지 말고 적절한 표현으로 관계를 건강하게 유지하세요.",
    advantage: "깊은 내면과 자기 성찰 능력으로 인생의 본질을 꿰뚫는 통찰력이 있습니다.",
  },
  귀문관살: {
    meaning: "귀신 문의 살로, 신경 예민함, 이중성, 신비로운 기운을 상징합니다.",
    personality: "직감이 강하고 영적 감수성이 높습니다. 감정 기복이 있을 수 있습니다.",
    relationship: "독특하고 신비로운 매력이 있으나 관계가 복잡해질 수 있습니다.",
    caution: "신경과민, 불안, 우울에 주의하세요. 정신적 건강을 챙기는 것이 중요합니다.",
    advantage: "통찰력과 직감이 뛰어나 상담, 심리, 예술 분야에서 두각을 나타냅니다.",
  },
  현침살: {
    meaning: "바늘 같은 날카로운 기운으로, 집중력과 예리함을 상징합니다.",
    personality: "날카로운 분석력과 집중력이 뛰어납니다. 섬세하고 예민합니다.",
    relationship: "상대의 감정을 잘 읽지만 자신도 쉽게 상처받을 수 있습니다.",
    caution: "수술, 주사, 날카로운 도구 관련 사고에 주의하세요. 과로를 피하세요.",
    advantage: "의료, 법률, 분석, 기술직 분야에서 섬세하고 날카로운 능력을 발휘합니다.",
  },
  천복귀인: {
    meaning: "하늘의 복과 행운을 가져다주는 귀인의 별입니다.",
    personality: "삶 전반에 걸쳐 행운이 따르는 경향이 있습니다.",
    relationship: "좋은 인연을 끌어당기는 복덕이 있습니다.",
    caution: "타인의 도움에 감사하고 스스로도 덕을 쌓는 삶을 살면 더욱 빛납니다.",
    advantage: "위기 상황에서도 뜻밖의 행운이 찾아오는 복덕이 있습니다.",
  },
  천의성: {
    meaning: "하늘의 의술 별로, 치유와 봉사, 의료 기운을 상징합니다.",
    personality: "타인의 아픔에 공감하고 도우려는 마음이 강합니다.",
    relationship: "배려심이 깊어 주변 사람들이 의지합니다.",
    caution: "자신의 에너지가 소진되지 않도록 자기 관리를 게을리하지 마세요.",
    advantage: "의료, 상담, 사회복지, 교육 등 봉사 분야에서 큰 능력을 발휘합니다.",
  },
  관귀학관: {
    meaning: "관직·학문·명예를 아우르는 귀인의 별입니다. 공직·학업·사회적 지위와 깊이 연결됩니다.",
    personality: "성실하고 원칙적이며 명예를 소중히 여깁니다. 학문적 열의가 강합니다.",
    relationship: "사회적으로 인정받는 사람과의 인연이 깊고, 교육·공직 계통과 연이 있습니다.",
    caution: "명예나 체면에 지나치게 얽매이지 않도록 하세요. 유연성도 필요합니다.",
    advantage: "학업·시험·공직·자격증 취득에서 귀인의 도움이 발동합니다. 명예로운 성취가 가능합니다.",
  },
};

// ── Ten-God Group Detail ──────────────────────────────────────────

export interface TenGodGroupDetail {
  group: string;
  title: string;
  meaning: string;
  chartPoint: string;
  relationship: string;
  work: string;
  emotion: string;
  members: TenGod[];
  color: string;
}

export const TEN_GOD_GROUPS: TenGodGroupDetail[] = [
  {
    group: "비겁",
    title: "비겁 比劫 — 자아와 경쟁",
    meaning: "일간(나)과 같은 오행으로, 자아·경쟁·형제를 상징합니다. 비견(동성)과 겁재(이성)로 나뉩니다.",
    chartPoint: "비겁이 많으면 자기주장이 강하고 독립적입니다. 적으면 의지력이 부족할 수 있습니다.",
    relationship: "경쟁자나 라이벌 관계가 생기기 쉽습니다. 형제·자매와의 관계를 나타냅니다.",
    work: "자영업, 독립 사업, 스포츠 등 독립적인 분야에서 강점을 발휘합니다.",
    emotion: "자존심이 강하고 감정 표현에 자신감이 있습니다.",
    members: ["비견", "겁재"],
    color: "bg-green-100 text-green-800",
  },
  {
    group: "식상",
    title: "식상 食傷 — 표현과 창의",
    meaning: "일간이 생(生)하는 오행으로, 표현·창의·자녀를 상징합니다. 식신(동성 생)과 상관(이성 생)으로 나뉩니다.",
    chartPoint: "식상이 많으면 표현력이 풍부하고 창의적입니다. 적으면 표현이 서툴 수 있습니다.",
    relationship: "자녀운과 연결됩니다. 자신을 표현하는 방식이 이성 관계에 영향을 미칩니다.",
    work: "예술, 교육, 요식업, 연예, 기획 분야에서 두각을 나타냅니다.",
    emotion: "감정을 자유롭게 표현하며, 때로 충동적인 면이 있습니다.",
    members: ["식신", "상관"],
    color: "bg-red-100 text-red-800",
  },
  {
    group: "재성",
    title: "재성 財星 — 재물과 실행",
    meaning: "일간이 극(剋)하는 오행으로, 재물·아버지·아내(남성 기준)를 상징합니다.",
    chartPoint: "재성이 강하면 재물 운이 좋고 현실적입니다. 너무 많으면 탐욕이나 피로가 생깁니다.",
    relationship: "남성에게는 배우자 인연을 나타냅니다. 재물을 통한 만남이 이루어질 수 있습니다.",
    work: "사업, 금융, 유통, 영업 분야에서 능력을 발휘합니다.",
    emotion: "현실적이고 물질적 안정을 중시합니다.",
    members: ["편재", "정재"],
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    group: "관성",
    title: "관성 官星 — 명예와 규율",
    meaning: "일간을 극(剋)하는 오행으로, 직업·명예·남편(여성 기준)·자녀(남성 기준)를 상징합니다.",
    chartPoint: "관성이 강하면 책임감과 명예 의식이 강합니다. 너무 많으면 압박감을 느낄 수 있습니다.",
    relationship: "여성에게는 배우자 인연을 나타냅니다. 사회적 지위를 통한 인연이 생깁니다.",
    work: "공직, 법조, 경영, 교육, 의료 분야에서 뛰어납니다.",
    emotion: "원칙적이고 절제력이 강하지만, 때로는 지나치게 엄격할 수 있습니다.",
    members: ["편관", "정관"],
    color: "bg-gray-100 text-gray-700",
  },
  {
    group: "인성",
    title: "인성 印星 — 학문과 보호",
    meaning: "일간을 생(生)하는 오행으로, 학문·어머니·보호·명예를 상징합니다.",
    chartPoint: "인성이 강하면 학문적이고 보수적입니다. 너무 많으면 게으르거나 의존적이 될 수 있습니다.",
    relationship: "어머니·윗사람의 보살핌이 크게 작용합니다. 안정적인 관계를 선호합니다.",
    work: "교육, 연구, 행정, 의료, 종교 분야에서 강점을 보입니다.",
    emotion: "내성적이고 신중하며, 감정을 내면에서 처리하는 경향이 있습니다.",
    members: ["편인", "정인"],
    color: "bg-blue-100 text-blue-800",
  },
];

// ── Luck Item Detail ──────────────────────────────────────────────

interface LuckItemDetail {
  title: string;
  period: string;
  meaningBase: string;
  tips: string[];
}

export const TG_LUCK_MEANING: Record<string, { summary: string; relationship: string; work: string; tip: string }> = {
  비견: {
    summary: "자립과 경쟁의 기운이 강해지는 시기입니다.",
    relationship: "독립심이 강해져 파트너와 의견 충돌이 있을 수 있습니다.",
    work: "독립적인 프로젝트나 사업 시작에 적합한 시기입니다.",
    tip: "경쟁보다는 협력의 자세로 접근하면 더 좋은 결과를 얻을 수 있습니다.",
  },
  겁재: {
    summary: "경쟁이 심화되고 재물 변동이 클 수 있는 시기입니다.",
    relationship: "관계에서 긴장감이 생기고 갈등이 일어날 수 있습니다.",
    work: "무리한 투자나 사업 확장을 조심하세요.",
    tip: "재물 관리에 신중하고 충동적인 결정을 피하세요.",
  },
  식신: {
    summary: "창의력과 표현력이 풍부해지는 좋은 시기입니다.",
    relationship: "이성 인연이 활발해지고 좋은 만남이 이루어질 수 있습니다.",
    work: "창의적인 프로젝트, 신사업, 예술 활동에 좋은 시기입니다.",
    tip: "아이디어를 행동으로 옮기고, 자신의 매력을 표현하세요.",
  },
  상관: {
    summary: "표현 욕구가 강하고 변화를 원하는 시기입니다.",
    relationship: "감정 기복이 있고 관계에서 갈등이 생길 수 있습니다.",
    work: "혁신적인 아이디어는 좋지만 조직 내 마찰에 주의하세요.",
    tip: "말과 행동을 신중히 하고 감정 조절에 집중하세요.",
  },
  편재: {
    summary: "활동적인 재물 기운이 들어오는 시기입니다.",
    relationship: "이성과의 활발한 만남이 이루어질 수 있습니다.",
    work: "사업, 투자, 영업 활동에 유리한 시기입니다.",
    tip: "적극적인 행동이 이득을 가져오지만 지나친 욕심은 금물입니다.",
  },
  정재: {
    summary: "안정적인 재물 운이 들어오는 시기입니다.",
    relationship: "진지하고 안정적인 관계로 발전할 수 있습니다.",
    work: "꾸준한 노력이 좋은 결과를 만드는 시기입니다.",
    tip: "계획적이고 성실하게 임하면 좋은 성과를 얻을 수 있습니다.",
  },
  편관: {
    summary: "강한 에너지와 도전, 경쟁이 심화되는 시기입니다.",
    relationship: "강렬한 만남이 있을 수 있지만 갈등도 생길 수 있습니다.",
    work: "승부욕이 높아지므로 목표 지향적 활동에 집중하세요.",
    tip: "무리한 대결은 피하고, 에너지를 목표에 집중하세요.",
  },
  정관: {
    summary: "명예와 직업 운이 좋아지는 안정적인 시기입니다.",
    relationship: "공식적인 관계로 발전하거나 안정적인 인연을 만날 수 있습니다.",
    work: "공직, 승진, 합법적인 방법으로 성과를 내기 좋은 시기입니다.",
    tip: "원칙을 지키며 공식적인 일에 집중하세요.",
  },
  편인: {
    summary: "직관과 내면의 사유가 활발해지는 시기입니다.",
    relationship: "자신만의 세계에 빠져 관계에 소홀해질 수 있습니다.",
    work: "연구, 학습, 영적 탐구에 집중하기 좋습니다.",
    tip: "혼자만의 시간을 통해 통찰을 얻고, 관계에도 균형을 유지하세요.",
  },
  정인: {
    summary: "학문과 안정, 보호의 기운이 강해지는 시기입니다.",
    relationship: "안정적이고 보호받는 관계가 형성됩니다.",
    work: "학업, 자격증, 연구 활동에 집중하기 좋은 시기입니다.",
    tip: "배움과 계획에 집중하면 에너지가 잘 흘러갑니다.",
  },
};

// ── 원국 십성 체질 해석 (시기가 아닌 성향·특성) ──────────────────
export const TG_NATAL_MEANING: Record<string, {
  summary: string;
  traits: string;
  strengths: string;
  caution: string;
}> = {
  비견: {
    summary: "자아가 강하고 자립심이 넘칩니다. 나와 비슷한 기운이 많아 독립적으로 행동하는 성향이 강합니다.",
    traits: "주도적·경쟁적·자존심이 강함. 타인에게 기대기보다 스스로 해결하려 합니다.",
    strengths: "추진력과 자립심이 강해 혼자서도 충분히 일을 완수합니다. 목표 의식이 뚜렷합니다.",
    caution: "협력보다 경쟁 구도로 가기 쉽고, 고집이 세어 관계에서 갈등이 생길 수 있습니다.",
  },
  겁재: {
    summary: "승부욕과 추진력이 강한 반면, 재물 기복이 크고 충동적인 결정을 내리기 쉽습니다.",
    traits: "열정적·대담함·경쟁심이 강함. 빠른 결단력을 갖고 있습니다.",
    strengths: "강한 실행력과 에너지로 어려운 상황도 돌파해 나갑니다.",
    caution: "재물 관리가 어렵고 충동적 행동으로 손해를 볼 수 있습니다. 리스크 관리가 중요합니다.",
  },
  식신: {
    summary: "표현력과 창의성이 넘치는 기운을 타고났습니다. 즐기면서 결실을 맺는 능력이 있습니다.",
    traits: "예술적·사교적·여유로움. 맛있는 것, 즐거운 것을 좋아하는 풍요로운 감각을 가집니다.",
    strengths: "창의적인 분야에서 두각을 나타내며, 사람들에게 긍정적인 에너지를 줍니다.",
    caution: "너무 느긋해 기회를 놓치거나, 과한 욕심 없이 안주할 수 있습니다.",
  },
  상관: {
    summary: "틀에 얽매이지 않는 혁신적 사고를 가졌습니다. 기존 질서에 도전하는 반골 기질이 있습니다.",
    traits: "창의적·비판적·말재주가 뛰어남. 독창적인 아이디어와 표현 욕구가 강합니다.",
    strengths: "독창적 발상과 언변으로 새로운 길을 개척합니다. 예술·언론·교육에서 빛납니다.",
    caution: "위계질서와 충돌할 수 있고, 감정 표현이 과해 인간관계에서 마찰이 생기기 쉽습니다.",
  },
  편재: {
    summary: "활동적이고 외향적인 재물 기운을 타고났습니다. 사업 감각과 사람 끌어모으는 능력이 있습니다.",
    traits: "외향적·모험적·융통성이 있음. 유연하게 상황에 적응하고 기회를 포착합니다.",
    strengths: "다양한 인맥과 추진력으로 사업·영업·투자 분야에서 탁월한 성과를 냅니다.",
    caution: "재물이 들어오는 만큼 나가기 쉽고, 한 가지에 집중하지 못하는 산만함이 있습니다.",
  },
  정재: {
    summary: "꼼꼼하고 성실한 재물 관리 능력을 타고났습니다. 계획적으로 자산을 쌓는 데 뛰어납니다.",
    traits: "안정 지향적·신중함·책임감이 강함. 약속을 지키고 신뢰를 중요시합니다.",
    strengths: "꾸준한 노력으로 재물을 안정적으로 축적합니다. 신뢰받는 사람으로 인정받습니다.",
    caution: "변화에 대한 두려움이 있고, 지나치게 안정만 추구하면 성장 기회를 놓칠 수 있습니다.",
  },
  편관: {
    summary: "강한 카리스마와 추진력을 타고났습니다. 리더십이 강하고 도전을 즐기는 성향입니다.",
    traits: "결단력·통솔력·강인함. 어떤 상황에서도 흔들리지 않는 의지를 가집니다.",
    strengths: "역경을 딛고 성장하는 힘이 있으며, 조직을 이끄는 리더십이 탁월합니다.",
    caution: "지나친 고집과 강압적 태도가 주변과 갈등을 만들 수 있습니다. 유연함이 필요합니다.",
  },
  정관: {
    summary: "원칙과 체계를 중시하는 명예로운 기운을 타고났습니다. 규칙을 지키며 신뢰를 쌓습니다.",
    traits: "도덕적·체계적·책임감이 강함. 법과 윤리를 중시하고 공정한 태도를 유지합니다.",
    strengths: "조직 내에서 신뢰받으며 승진과 명예를 얻을 가능성이 높습니다.",
    caution: "지나치게 원칙만 고집하면 융통성이 없어 보이고, 변화에 적응하기 어려울 수 있습니다.",
  },
  편인: {
    summary: "예리한 직관력과 독창적인 사고를 타고났습니다. 남들이 보지 못하는 것을 보는 능력이 있습니다.",
    traits: "직관적·독창적·내향적. 혼자만의 사색을 즐기고 철학적 사고를 합니다.",
    strengths: "예술·연구·종교·영적 분야에서 탁월한 통찰과 창의성을 발휘합니다.",
    caution: "현실 감각이 부족해지거나, 지나친 의심과 고집으로 관계가 멀어질 수 있습니다.",
  },
  정인: {
    summary: "지식과 보호 본능이 강한 기운을 타고났습니다. 배움을 사랑하고 타인을 돌보는 마음이 깊습니다.",
    traits: "학구적·자애로움·안정 지향. 지식을 쌓고 나누는 것에 큰 보람을 느낍니다.",
    strengths: "학문적 탐구심과 포용력으로 주변에서 존경받습니다. 교육·의료·복지 분야에서 빛납니다.",
    caution: "지나친 의존성이 생기거나, 현실 실행보다 이론에 머무르는 경향이 있습니다.",
  },
};

// ── Bottom Sheet State Hook ───────────────────────────────────────

export type InfoSheetType =
  | { kind: "shinsal"; name: string; source?: "auto" | "manual" }
  | { kind: "luck"; luckType: "대운" | "세운" | "월운" | "일운"; ganZhiStr: string; ganZhiHanja: string; tenGod?: string | null; branchTenGod?: string | null; period?: string; dayStem?: string }
  | { kind: "tengod-group"; group: string; dayStem?: string }
  | { kind: "branchRelation"; relationType: RelationType; branches: string[] };

// ── Main InfoBottomSheet Component ────────────────────────────────

interface InfoBottomSheetProps {
  info: InfoSheetType | null;
  onClose: () => void;
}

export function InfoBottomSheet({ info, onClose }: InfoBottomSheetProps) {
  return (
    <Drawer open={!!info} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        {info && (
          <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 40px)" }}>
            <div className="pb-4">
              {info.kind === "shinsal" && <ShinsalSheet name={info.name} source={info.source} />}
              {info.kind === "luck" && <LuckSheet info={info} />}
              {info.kind === "tengod-group" && <TenGodGroupSheet group={info.group} dayStem={info.dayStem} />}
              {info.kind === "branchRelation" && <BranchRelationSheet relationType={info.relationType} branches={info.branches} />}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// ── Shinsal Sheet ─────────────────────────────────────────────────

function ShinsalSheet({ name, source }: { name: string; source?: "auto" | "manual" }) {
  const detail = SHINSAL_DETAIL[name];
  const color = SHINSAL_COLOR[name] ?? "bg-muted text-foreground border-border";
  const shortDesc = SHINSAL_DESC[name] ?? "";

  return (
    <>
      <DrawerHeader className="text-left pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-bold px-3 py-1 rounded-full border ${color}`}>{name}</span>
          {source === "manual" ? (
            <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">수동 추가됨</span>
          ) : (
            <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">자동 판별됨</span>
          )}
        </div>
        <DrawerTitle className="text-xl">{name} 神殺</DrawerTitle>
        <DrawerDescription>{shortDesc}</DrawerDescription>
      </DrawerHeader>
      <div className="px-4 space-y-3">
        {detail ? (
          <>
            <Section label="기본 의미" content={detail.meaning} color="sky" />
            <Section label="성향·성격 관점" content={detail.personality} color="amber" />
            <Section label="관계·연애 관점" content={detail.relationship} color="violet" />
            <div className="grid grid-cols-1 gap-2">
              <Section label="주의할 점" content={detail.caution} color="orange" />
              <Section label="강점·활용법" content={detail.advantage} color="green" />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">상세 해석 준비 중입니다.</p>
        )}
      </div>
    </>
  );
}

// ── Luck Sheet ────────────────────────────────────────────────────

function LuckSheet({ info }: { info: Extract<InfoSheetType, { kind: "luck" }> }) {
  const tgLuck = info.tenGod ? TG_LUCK_MEANING[info.tenGod] : null;
  const branchTgLuck = info.branchTenGod ? TG_LUCK_MEANING[info.branchTenGod] : null;
  const luckTypeDesc: Record<string, string> = {
    대운: "10년 주기 운의 흐름",
    세운: "해당 연도의 운세",
    월운: "이달의 운세 흐름",
    일운: "오늘의 일진 기운",
  };

  return (
    <>
      <DrawerHeader className="text-left pb-2">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[13px] font-bold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{info.luckType}</span>
          {info.tenGod && (
            <span className={`text-[13px] font-bold px-2.5 py-1 rounded-full ${getTenGodTw(info.tenGod, info.dayStem ?? "")}`}>
              천간 {info.tenGod}
            </span>
          )}
          {info.branchTenGod && (
            <span className={`text-[13px] font-bold px-2.5 py-1 rounded-full ${getTenGodTw(info.branchTenGod, info.dayStem ?? "")}`}>
              지지 {info.branchTenGod}
            </span>
          )}
        </div>
        <DrawerTitle className="text-2xl font-bold">{info.ganZhiStr}</DrawerTitle>
        <DrawerDescription>
          {info.ganZhiHanja} — {luckTypeDesc[info.luckType]}
          {info.period && ` · ${info.period}`}
        </DrawerDescription>
      </DrawerHeader>
      <div className="px-4 space-y-3">
        {tgLuck ? (
          <>
            <Section label="이 시기의 기운 (천간)" content={tgLuck.summary} color="sky" />
            <Section label="관계·연애 흐름" content={tgLuck.relationship} color="violet" />
            <Section label="일·직업 흐름" content={tgLuck.work} color="teal" />
            <Section label="이 시기를 잘 활용하려면" content={tgLuck.tip} color="green" />
          </>
        ) : (
          <Section
            color="sky"
            label="이 시기의 기운"
            content={`${info.ganZhiStr}(${info.ganZhiHanja}) 운기입니다. ${info.luckType === "일운" ? "오늘 하루의 일진으로, 이 기운에 맞는 활동을 선택하면 좋습니다." : "이 간지의 오행 흐름이 전반적인 운에 영향을 미칩니다."}`}
          />
        )}
        {branchTgLuck && (
          <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2.5 space-y-2">
            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide">지지 기운 — {info.branchTenGod}</p>
            <Section label="지지의 기운" content={branchTgLuck.summary} color="sky" />
            <Section label="관계·연애 측면" content={branchTgLuck.relationship} color="violet" />
            <Section label="일·직업 측면" content={branchTgLuck.work} color="teal" />
          </div>
        )}
        <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 mt-2">
          <p className="text-[13px] text-muted-foreground">※ 운세 해석은 참고용 분석으로, 절대적 예언이 아닙니다. 본인의 노력과 선택이 가장 중요합니다.</p>
        </div>
      </div>
    </>
  );
}

// ── Ten-God Group Sheet ───────────────────────────────────────────

function TenGodGroupSheet({ group, dayStem }: { group: string; dayStem?: string }) {
  const detail = TEN_GOD_GROUPS.find((g) => g.group === group);
  if (!detail) return null;

  return (
    <>
      <DrawerHeader className="text-left pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[13px] font-bold px-3 py-1 rounded-full ${detail.color}`}>{group}</span>
          {detail.members.map((m) => (
            <span key={m} className={`text-[13px] font-bold px-2 py-0.5 rounded-full ${getTenGodTw(m, dayStem ?? "")}`}>{m}</span>
          ))}
        </div>
        <DrawerTitle className="text-xl">{detail.title}</DrawerTitle>
        <DrawerDescription>{detail.meaning}</DrawerDescription>
      </DrawerHeader>
      <div className="px-4 space-y-3">
        <Section label="차트 해석 포인트" content={detail.chartPoint} color="sky" />
        <Section label="관계·연애 측면" content={detail.relationship} color="violet" />
        <Section label="일·직업 측면" content={detail.work} color="teal" />
        <Section label="감정·내면 측면" content={detail.emotion} color="amber" />
      </div>
    </>
  );
}

// ── Reusable Section ──────────────────────────────────────────────

type SectionColor = "sky" | "violet" | "teal" | "amber" | "orange" | "green" | "rose" | "default";

const SECTION_COLOR_MAP: Record<SectionColor, { bg: string; label: string }> = {
  sky:     { bg: "bg-sky-50 border-sky-100",       label: "text-sky-700" },
  violet:  { bg: "bg-violet-50 border-violet-100", label: "text-violet-700" },
  teal:    { bg: "bg-teal-50 border-teal-100",     label: "text-teal-700" },
  amber:   { bg: "bg-amber-50 border-amber-100",   label: "text-amber-700" },
  orange:  { bg: "bg-orange-50 border-orange-100", label: "text-orange-700" },
  green:   { bg: "bg-green-50 border-green-100",   label: "text-green-700" },
  rose:    { bg: "bg-rose-50 border-rose-100",     label: "text-rose-700" },
  default: { bg: "bg-muted/20 border-border/50",   label: "text-muted-foreground" },
};

function Section({
  label,
  content,
  color,
  highlight,
  warn,
  positive,
}: {
  label: string;
  content: string;
  color?: SectionColor;
  highlight?: boolean;
  warn?: boolean;
  positive?: boolean;
}) {
  const resolvedColor: SectionColor = color
    ?? (highlight ? "violet" : warn ? "orange" : positive ? "green" : "default");
  const { bg, label: labelColor } = SECTION_COLOR_MAP[resolvedColor];

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${bg}`}>
      <p className={`text-[13px] font-bold uppercase tracking-wide mb-1 ${labelColor}`}>{label}</p>
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
}

// ── Branch Relation Sheet ─────────────────────────────────────────

function BranchRelationSheet({ relationType, branches }: { relationType: RelationType; branches: string[] }) {
  const detail = RELATION_DETAIL[relationType];
  const shortDesc = RELATION_DESC[relationType] ?? "";
  const colorClass = RELATION_COLORS[relationType] ?? "bg-gray-100 text-gray-700";

  return (
    <>
      <DrawerHeader className="text-left pb-2">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-sm font-bold px-3 py-1 rounded-full border ${colorClass}`}>{relationType}</span>
          {branches.length > 0 && (
            <div className="flex gap-1">
              {branches.map((b, i) => (
                <span key={i} className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-muted text-foreground border border-border/60">{b}</span>
              ))}
            </div>
          )}
        </div>
        <DrawerTitle className="text-xl">
          {relationType === "천간합" || relationType === "천간충" ? `${relationType} 천간 관계` : `${relationType} 관계`}
        </DrawerTitle>
        <DrawerDescription>{shortDesc}</DrawerDescription>
      </DrawerHeader>
      <div className="px-4 space-y-3">
        {detail ? (
          <>
            <Section label="기본 의미" content={detail.meaning} color="sky" />
            <Section label="해석 관점" content={detail.interpretation} color="violet" />
            <Section label="도메인 영역" content={detail.domain} color="teal" />
            <Section label="주의할 점" content={detail.caution} color="orange" />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">상세 해석 준비 중입니다.</p>
        )}
      </div>
    </>
  );
}
