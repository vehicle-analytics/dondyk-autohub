const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');
const lines = code.split('\n');

let inCommentBlock = false;
let commentBlockStart = 0;
let currentBlock = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('//')) {
        if (!inCommentBlock) {
            inCommentBlock = true;
            commentBlockStart = i + 1;
        }
        currentBlock.push(line);
    } else {
        if (inCommentBlock) {
            if (currentBlock.length > 5) {
                const text = currentBlock.join('\n');
                if (text.includes('{') || text.includes('(') || text.includes('=')) {
                    console.log(`Block at lines ${commentBlockStart}-${i}: ${currentBlock.length} lines`);
                }
            }
            inCommentBlock = false;
            currentBlock = [];
        }
    }
}
