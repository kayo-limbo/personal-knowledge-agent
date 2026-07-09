const fs = require('fs');
let content = fs.readFileSync('tsconfig.json', 'utf8');
content = content.replace('"**/*.tsx"', '"**/*.tsx",\n    "**/*.d.ts"');
fs.writeFileSync('tsconfig.json', content, 'utf8');
console.log('Done');