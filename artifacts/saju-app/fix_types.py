import re

def fix_coworker():
    with open('src/lib/reports/CoworkerReportGenerator.ts', 'r') as f:
        c = f.read()
    c = c.replace('.map(s =>', '.map((s: string) =>')
    with open('src/lib/reports/CoworkerReportGenerator.ts', 'w') as f:
        f.write(c)

def fix_family():
    with open('src/lib/reports/FamilyFriendReportGenerator.ts', 'r') as f:
        c = f.read()
    c = c.replace('.map(s =>', '.map((s: string) =>')
    with open('src/lib/reports/FamilyFriendReportGenerator.ts', 'w') as f:
        f.write(c)

def fix_compat():
    with open('src/pages/Compatibility.tsx', 'r') as f:
        c = f.read()
    # 1123: .map((raw) => ({ raw, type: normalizeRelationType(raw) }))
    c = c.replace('.map((raw) =>', '.map((raw: string) =>')
    # 1124: .filter((x): x is { raw: string; type: RelationType } => !!x.type)
    # 1125: .map(({ raw, type }, i) => (
    c = c.replace('.map(({ raw, type }, i) =>', '.map(({ raw, type }: { raw: string; type: RelationType }, i: number) =>')
    with open('src/pages/Compatibility.tsx', 'w') as f:
        f.write(c)

fix_coworker()
fix_family()
fix_compat()
print("Fixed")
