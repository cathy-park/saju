import re

with open('src/pages/Compatibility.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'fullReport\.branchComp', '(fullReport as any).branchComp', content)
content = re.sub(r'fullReport\.styleComp', '(fullReport as any).styleComp', content)
content = re.sub(r'fullReport\.marriageView', '(fullReport as any).marriageView', content)
content = re.sub(r'fullReport\.structural', '(fullReport as any).structural', content)
content = re.sub(
    r'import type \{ CompatibilityResult, CompatibilityTone \} from "@/lib/compatibilityScore";',
    'import type { CompatibilityResult, CompatibilityTone } from "@/lib/compatibilityScore";\nimport type { AnyCompatibilityReport } from "@/lib/reports";',
    content
)
content = re.sub(r'const fullReport =', 'const fullReport: AnyCompatibilityReport | null =', content)

with open('src/pages/Compatibility.tsx', 'w') as f:
    f.write(content)

print("Done")
