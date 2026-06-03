import re

with open('src/pages/Compatibility.tsx', 'r') as f:
    content = f.read()

# Make property accesses safe by using optional chaining
content = content.replace('(fullReport as any).branchComp.', '(fullReport as any).branchComp?.')
content = content.replace('(fullReport as any).styleComp.', '(fullReport as any).styleComp?.')
content = content.replace('(fullReport as any).marriageView.', '(fullReport as any).marriageView?.')
content = content.replace('(fullReport as any).structural.', '(fullReport as any).structural?.')

# For structural fields used in DEV debug
content = content.replace('fullReport.structural.', '(fullReport as any).structural?.')

with open('src/pages/Compatibility.tsx', 'w') as f:
    f.write(content)

print("Fixed crash")
