import re

with open('src/lib/dynamicCompatibility.ts', 'r') as f:
    content = f.read()

# Fix titles: Replace `title: "${...}"` with `title: ...`
# Also need to remove the `${` and `}`
content = re.sub(r'title: "\$\{(.*?)\}"', r'title: \1', content)

with open('src/lib/dynamicCompatibility.ts', 'w') as f:
    f.write(content)

print("Quotes fixed")
