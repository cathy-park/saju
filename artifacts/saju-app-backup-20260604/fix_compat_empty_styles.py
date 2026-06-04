import re

with open('src/pages/Compatibility.tsx', 'r') as f:
    content = f.read()

# Replace style accesses
# In Compatibility.tsx, it's doing: 
# deRomance((fullReport as any).styleComp?.person1Style)
# We want to replace it with:
# deRomance((fullReport as any).styleComp?.person1Style || (fullReport as any).workStyleComp?.person1Style || (fullReport as any).dynamicsComp?.person1Style)

content = content.replace(
    'deRomance((fullReport as any).styleComp?.person1Style)',
    'deRomance((fullReport as any).styleComp?.person1Style || (fullReport as any).workStyleComp?.person1Style || (fullReport as any).dynamicsComp?.person1Style)'
)

content = content.replace(
    'deRomance((fullReport as any).styleComp?.person2Style)',
    'deRomance((fullReport as any).styleComp?.person2Style || (fullReport as any).workStyleComp?.person2Style || (fullReport as any).dynamicsComp?.person2Style)'
)

content = content.replace(
    'deRomance((fullReport as any).styleComp?.dynamicsDesc)',
    'deRomance((fullReport as any).styleComp?.dynamicsDesc || (fullReport as any).workStyleComp?.synergyDesc || (fullReport as any).dynamicsComp?.desc)'
)

with open('src/pages/Compatibility.tsx', 'w') as f:
    f.write(content)

print("Compatibility.tsx fixed")
