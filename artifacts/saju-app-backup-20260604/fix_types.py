import re

with open('src/lib/reports/types.ts', 'r') as f:
    content = f.read()

# Add branchComp to FamilyFriendCompatibilityReport
replacement = """export interface FamilyFriendCompatibilityReport extends BaseCompatibilityReport {
  type: "family" | "friend" | "other";
  branchComp: {
    myBranch: string;
    otherBranch: string;
    relations: string[];
    tone: string;
    desc: string;
    stability: string;
  };
  dynamicsComp: {"""
content = content.replace('export interface FamilyFriendCompatibilityReport extends BaseCompatibilityReport {\n  type: "family" | "friend" | "other";\n  dynamicsComp: {', replacement)

with open('src/lib/reports/types.ts', 'w') as f:
    f.write(content)

print("Types fixed")
