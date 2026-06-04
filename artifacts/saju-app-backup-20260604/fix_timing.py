import re

with open('src/lib/dynamicCompatibility.ts', 'r') as f:
    content = f.read()

# Signature
content = content.replace(
    'export function computeCombinedTimingFlow(\n  a: PersonCurrentFlow,\n  b: PersonCurrentFlow,\n  staticCompatScore: number,\n): CombinedTimingFlow {',
    'export function computeCombinedTimingFlow(\n  a: PersonCurrentFlow,\n  b: PersonCurrentFlow,\n  staticCompatScore: number,\n  relType?: string\n): CombinedTimingFlow {'
)

# Helper for title replacements
def replace_timing(content):
    # union title
    content = content.replace('올해는 결실과 결합의 시기 💍', '${relType === "coworker" ? "올해는 협력과 성과의 시기 🤝" : relType === "family" || relType === "friend" ? "올해는 신뢰와 공감의 시기 🍀" : "올해는 결실과 결합의 시기 💍"}')
    content = content.replace('마음이 안착하는 결실기 🍀', '${relType === "coworker" ? "기반이 안정되는 성장기 🌱" : relType === "family" || relType === "friend" ? "마음이 편안해지는 안정기 🍀" : "마음이 안착하는 결실기 🍀"}')
    content = content.replace('장기적 결실 지지기', '${relType === "coworker" ? "장기적 협력 지지기" : relType === "family" || relType === "friend" ? "장기적 유대 지지기" : "장기적 결실 지지기"}')
    
    # words replace 
    content = content.replace('배우자궁을 모두 좋게 결합(합)해 줍니다', '${relType === "coworker" ? "사회궁(월지)을 모두 좋게 결합해 줍니다" : relType === "family" || relType === "friend" ? "일지를 모두 따뜻하게 결합해 줍니다" : "배우자궁을 모두 좋게 결합(합)해 줍니다"}')
    content = content.replace('배우자궁과 따뜻하게 결합(${unionRel})합니다', '${relType === "coworker" ? "사회궁(월지)과 따뜻하게 결합(${unionRel})합니다" : relType === "family" || relType === "friend" ? "일지와 따뜻하게 결합(${unionRel})합니다" : "배우자궁과 따뜻하게 결합(${unionRel})합니다"}')
    content = content.replace('배우자궁과 부딪히거나', '${relType === "coworker" ? "사회궁(월지)과 부딪히거나" : relType === "family" || relType === "friend" ? "일지와 부딪히거나" : "배우자궁과 부딪히거나"}')
    content = content.replace('배우자궁에 예민한 자극', '${relType === "coworker" ? "사회궁(월지)에 예민한 자극" : relType === "family" || relType === "friend" ? "일지에 예민한 자극" : "배우자궁에 예민한 자극"}')
    content = content.replace('배우자궁을 따뜻하게 지지하여', '${relType === "coworker" ? "사회궁(월지)을 든든하게 지지하여" : relType === "family" || relType === "friend" ? "일지를 따뜻하게 지지하여" : "배우자궁을 따뜻하게 지지하여"}')
    content = content.replace('평생의 약속이나 결혼 이야기를 구체화하기에 완벽한 타이밍입니다', '${relType === "coworker" ? "중요한 프로젝트나 협력 관계를 구체화하기에 완벽한 타이밍입니다" : relType === "family" || relType === "friend" ? "서로에 대한 이해와 유대감이 깊어지는 완벽한 타이밍입니다" : "평생의 약속이나 결혼 이야기를 구체화하기에 완벽한 타이밍입니다"}')
    return content

content = replace_timing(content)

with open('src/lib/dynamicCompatibility.ts', 'w') as f:
    f.write(content)

print("Dynamic timing fixed")
