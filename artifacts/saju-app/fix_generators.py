import re

with open('src/lib/reports/CoworkerReportGenerator.ts', 'r') as f:
    coworker = f.read()

# Add getRelationshipPattern, getStyleCompatDesc import if missing
if 'getRelationshipPattern' not in coworker:
    coworker = coworker.replace(
        'import { getTenGod } from "../tenGods";',
        'import { getTenGod } from "../tenGods";\nimport { getRelationshipPattern } from "../relationshipReport";'
    )
if 'getStyleCompatDesc' not in coworker:
    coworker = coworker.replace(
        'getHarmonyPoints,\n  getRelationshipTips,',
        'getHarmonyPoints,\n  getRelationshipTips,\n  getStyleCompatDesc,'
    )

# Add styleInfo evaluation before returns
style_info_snippet = """
  const styleInfo1 = getRelationshipPattern(s1, pillars1.day?.hangul?.[1] ?? "", el1);
  const styleInfo2 = getRelationshipPattern(s2, pillars2.day?.hangul?.[1] ?? "", el2);
"""
# inject before `let monthDesc = "";`
coworker = coworker.replace('  let monthDesc = "";', style_info_snippet + '  let monthDesc = "";')

# Fix workStyleComp and tips
coworker = coworker.replace(
    '''    workStyleComp: {
      person1Style: "보완 필요 (임시)", // TODO: 격국/관성 기반 스타일 추출 추가 가능
      person2Style: "보완 필요 (임시)",
      synergyDesc: "서로 다른 역량을 활용해 업무 시너지를 낼 수 있습니다."
    },''',
    '''    workStyleComp: {
      person1Style: styleInfo1.style,
      person2Style: styleInfo2.style,
      synergyDesc: getStyleCompatDesc(styleInfo1.style, styleInfo2.style).replace(/연애|이성|사랑/g, "업무")
    },'''
)
coworker = coworker.replace('getRelationshipTips("A", "B", tone)', 'getRelationshipTips(styleInfo1.style, styleInfo2.style, tone)')

with open('src/lib/reports/CoworkerReportGenerator.ts', 'w') as f:
    f.write(coworker)


with open('src/lib/reports/FamilyFriendReportGenerator.ts', 'r') as f:
    family = f.read()

if 'getStyleCompatDesc' not in family:
    family = family.replace(
        'getHarmonyPoints,\n  getRelationshipTips,',
        'getHarmonyPoints,\n  getRelationshipTips,\n  getStyleCompatDesc,'
    )

family = family.replace(
    'desc: `${relNoun} 관계에서 두 사람의 성향 차이와 공통점을 보여줍니다.`',
    'desc: getStyleCompatDesc(styleInfo1.style, styleInfo2.style).replace(/연애|이성/g, "관계").replace(/사랑/g, "애정")'
)

with open('src/lib/reports/FamilyFriendReportGenerator.ts', 'w') as f:
    f.write(family)

print("Generators fixed")
