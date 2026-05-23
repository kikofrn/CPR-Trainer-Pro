const fs = require('fs');

const logFile = "C:\\Users\\FranciscoCarrero\\.gemini\\antigravity\\brain\\d9696a9e-d242-4418-b413-9f59e4d13d90\\.system_generated\\logs\\transcript.jsonl";
const lines = fs.readFileSync(logFile, 'utf8').split('\n');

const recoveredLines = {};
let maxLine = 0;

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const json = JSON.parse(line);
        if (json.type === "VIEW_FILE" && json.status === "DONE" && json.content.includes("Total Lines: 3570")) {
            const content = json.content;
            const textLines = content.split('\n');
            let isCodeSection = false;
            
            for (const textLine of textLines) {
                if (textLine.includes("The following code has been modified to include a line number")) {
                    isCodeSection = true;
                    continue;
                }
                
                if (isCodeSection) {
                    const match = textLine.match(/^(\d+):\s(.*)$/);
                    if (match) {
                        const lineNum = parseInt(match[1], 10);
                        const code = match[2];
                        recoveredLines[lineNum] = code;
                        if (lineNum > maxLine) maxLine = lineNum;
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error parsing JSON line:", e);
    }
}

console.log("Total unique lines recovered:", Object.keys(recoveredLines).length);
console.log("Max line number:", maxLine);

let missingLines = [];
let output = [];
for (let i = 1; i <= maxLine; i++) {
    if (recoveredLines[i] !== undefined) {
        output.push(recoveredLines[i]);
    } else {
        missingLines.push(i);
        output.push(`// MISSING LINE ${i}`);
    }
}

if (missingLines.length > 0) {
    console.log("Missing lines:", missingLines.join(", "));
} else {
    console.log("All lines successfully recovered!");
}

fs.writeFileSync("App.tsx.elite", output.join('\n'));
console.log("Written to App.tsx.elite");
