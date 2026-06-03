import re

with open('src/pages/Compatibility.tsx', 'r') as f:
    content = f.read()

# find: computeCombinedTimingFlow(flowA, flowB, result.score)
# replace with: computeCombinedTimingFlow(flowA, flowB, result.score, (p2 as (PersonRecord & { relationshipType?: RelationshipType }) | null)?.relationshipType)

content = content.replace(
    'computeCombinedTimingFlow(flowA, flowB, result.score)',
    'computeCombinedTimingFlow(flowA, flowB, result.score, (p2 as any)?.relationshipType)'
)

with open('src/pages/Compatibility.tsx', 'w') as f:
    f.write(content)

print("Fixed call")
