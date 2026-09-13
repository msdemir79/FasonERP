const fs = require('fs');

const content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
const lines = content.split('\n');

const outLines = [];
let i = 0;

while (i < lines.length) {
  if (lines[i].trim() === '// Cash Flow Chart Data') {
    // skip the next 33 lines (which is the block)
    i += 33;
  } else {
    outLines.push(lines[i]);
    i++;
  }
}

fs.writeFileSync('src/components/Dashboard.tsx', outLines.join('\n'));
