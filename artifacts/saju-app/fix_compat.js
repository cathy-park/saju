const fs = require('fs');
let content = fs.readFileSync('src/pages/Compatibility.tsx', 'utf-8');

// Replace property accesses
content = content.replace(/fullReport\.branchComp/g, '(fullReport as any).branchComp');
content = content.replace(/fullReport\.styleComp/g, '(fullReport as any).styleComp');
content = content.replace(/fullReport\.marriageView/g, '(fullReport as any).marriageView');
content = content.replace(/fullReport\.structural/g, '(fullReport as any).structural');
content = content.replace(/import type \{ CompatibilityResult, CompatibilityTone \} from "@\/lib\/compatibilityScore";/g, 'import type { CompatibilityResult, CompatibilityTone } from "@/lib/compatibilityScore";\nimport type { AnyCompatibilityReport } from "@/lib/reports";');

fs.writeFileSync('src/pages/Compatibility.tsx', content);
