import re

# 1. Fix Compatibility.tsx
with open('src/pages/Compatibility.tsx', 'r') as f:
    compat = f.read()

# Fix "결혼 관점 해석" only for lover/spouse
compat = compat.replace(
    'const show = rel === "lover" || rel === "spouse" || rel === "other";',
    'const show = rel === "lover" || rel === "spouse";'
)

# Fix "배우자궁 비교" title and condition
# currently: {isPersonalLove && ( ... <p className="... mb-2">배우자궁 비교</p>
# change to: {(isPersonalLove || mode === "me_other" && (rel === "family" || rel === "friend" || rel === "other")) && ( ... <p> {isPersonalLove ? "배우자궁 비교" : "내면(일지) 비교"} </p>
compat = compat.replace(
    '{isPersonalLove && (',
    '{(isPersonalLove || (!isPersonalLove && (fullReport as any).branchComp)) && ('
)
compat = compat.replace(
    '<p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">배우자궁 비교</p>',
    '<p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{isPersonalLove ? "배우자궁 비교" : "내면(일지) 비교"}</p>'
)

# Add "사회궁(월지) 비교" block for coworkers right after the branchComp block
month_branch_block = """
                {/* 사회궁(월지) 비교 (동료) */}
                {!isPersonalLove && (fullReport as any).monthBranchComp && (
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">사회궁(월지) 비교</p>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex-1 rounded-xl border px-3 py-3 text-center" style={getElCardStyleLite(charToElement((fullReport as any).monthBranchComp?.myMonth))}>
                          <p className="inline-flex w-full items-center justify-center gap-0.5 text-[13px] text-muted-foreground">
                            <GenderSymbol gender={myGender} />
                            {myName} 월지
                          </p>
                          <span className="text-2xl font-bold" style={getBranchColor((fullReport as any).monthBranchComp?.myMonth)}>
                            {(fullReport as any).monthBranchComp?.myMonth}{charToElement((fullReport as any).monthBranchComp?.myMonth) ?? ""}
                          </span>
                      </div>
                      <div className="text-center">
                        <span className="text-lg text-muted-foreground">↔</span>
                      </div>
                      <div className="flex-1 rounded-xl border px-3 py-3 text-center" style={getElCardStyleLite(charToElement((fullReport as any).monthBranchComp?.otherMonth))}>
                          <p className="inline-flex w-full items-center justify-center gap-0.5 text-[13px] text-muted-foreground">
                            <GenderSymbol gender={otherGender} />
                            {otherName} 월지
                          </p>
                          <span className="text-2xl font-bold" style={getBranchColor((fullReport as any).monthBranchComp?.otherMonth)}>
                            {(fullReport as any).monthBranchComp?.otherMonth}{charToElement((fullReport as any).monthBranchComp?.otherMonth) ?? ""}
                          </span>
                      </div>
                    </div>
                    <div className="ds-inline-detail-nested space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {(fullReport as any).monthBranchComp?.relations?.map((r: string, i: number) => (
                          <span key={i} className="ds-badge font-bold shadow-none border-border">
                            {r}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-foreground">{(fullReport as any).monthBranchComp?.desc}</p>
                    </div>
                  </div>
                )}
"""
# inject this block by replacing the end of branchComp block
# We find:
#                       <p className="text-sm text-foreground">{(fullReport as any).branchComp?.stability}</p>
#                     </div>
#                   </div>
#                 )}
# And append month_branch_block.
compat = compat.replace(
    '                      <p className="text-sm text-foreground">{(fullReport as any).branchComp?.stability}</p>\n                    </div>\n                  </div>\n                )}',
    '                      <p className="text-sm text-foreground">{(fullReport as any).branchComp?.stability}</p>\n                    </div>\n                  </div>\n                )}\n' + month_branch_block
)

with open('src/pages/Compatibility.tsx', 'w') as f:
    f.write(compat)

# 2. Fix FamilyFriendReportGenerator.ts to include branchComp
with open('src/lib/reports/FamilyFriendReportGenerator.ts', 'r') as f:
    family = f.read()

if 'BRANCH_REL_COMPAT' not in family:
    family = family.replace(
        '  getStyleCompatDesc,\n  branchRel,',
        '  getStyleCompatDesc,\n  branchRel,\n  BRANCH_REL_COMPAT,'
    )

branchCompCode = """
  const dayBranchRelLabel = dayBranchRels.length > 0 ? dayBranchRels[0] : "없음";
  const branchComp = BRANCH_REL_COMPAT[dayBranchRelLabel] ?? BRANCH_REL_COMPAT["없음"];
"""
family = family.replace('  const crossBranch = getCrossBranchAnalysis', branchCompCode + '\n  const crossBranch = getCrossBranchAnalysis')

branchCompRetCode = """
    branchComp: {
      myBranch: b1,
      otherBranch: b2,
      relations: dayBranchRels,
      tone: branchComp.tone,
      desc: branchComp.desc.replace(/연인|결혼|배우자/g, relNoun).replace(/사랑/g, "애정"),
      stability: branchComp.stability.replace(/연인|결혼|배우자/g, relNoun).replace(/사랑/g, "애정"),
    },
"""
family = family.replace('    dynamicsComp: {', branchCompRetCode + '    dynamicsComp: {')

with open('src/lib/reports/FamilyFriendReportGenerator.ts', 'w') as f:
    f.write(family)

print("Review fixes applied")
