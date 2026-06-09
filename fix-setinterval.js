const fs = require('fs');

const files = [
  'src/components/superdashboard/ShipmentPipelinePanel.tsx',
  'src/components/district-reseller/DistrictStockOverview.tsx',
  'src/components/district-reseller/ACOPanel.tsx',
  'src/components/upazilla-reseller/IncomingDistrictStockPanel.tsx',
  'src/components/seller/dashboard/OrdersTab.tsx',
  'src/components/seller/dashboard/AddProduct/AIVerificationScreen.tsx'
];

let report = "\n## setInterval Fixes\n\n";

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Find useEffect with setInterval
  const intervalRegex = /(useEffect\(\(\) => \{\n)(\s*)(const \w+ = setInterval\(([\w]+|\(\) => \{[\s\S]*?\}),\s*(\d+)\);)([\s\S]*?)(\}, \[.*?\]\);)/g;
  
  content = content.replace(intervalRegex, (match, start, indent, intervalLine, funcOrBody, delay, remainingBody, end) => {
    const before = match;
    
    // Convert to recursive timeout
    let newStart = start + indent + "let timeoutId: NodeJS.Timeout;\n" + indent + "const poll = async () => {\n";
    let pollBody = "";
    if (funcOrBody.includes('=>')) {
      // It's an inline arrow function
      const innerBodyMatch = funcOrBody.match(/=> \{([\s\S]*)\}/);
      if (innerBodyMatch) {
        pollBody = innerBodyMatch[1].trim();
      } else {
        pollBody = funcOrBody.replace('() =>', '').trim();
      }
    } else {
      // It's a function reference
      pollBody = `${indent}  await ${funcOrBody}();`;
    }
    
    const newMiddle = `${indent}  ${pollBody}\n${indent}  timeoutId = setTimeout(poll, ${delay});\n${indent}};\n${indent}poll();\n`;
    
    // Remove the clearInterval if it exists in remainingBody
    let cleanedRemaining = remainingBody.replace(/return \(\) => clearInterval\(\w+\);/g, "return () => clearTimeout(timeoutId);");
    if (!cleanedRemaining.includes('return () => clearTimeout')) {
        cleanedRemaining = cleanedRemaining + indent + "return () => clearTimeout(timeoutId);\n" + indent.substring(0, indent.length - 2);
    }
    
    const after = newStart + newMiddle + cleanedRemaining + end;
    
    report += `### Fixed ${file}\n\n**BEFORE:**\n\`\`\`typescript\n${before}\n\`\`\`\n\n**AFTER:**\n\`\`\`typescript\n${after}\n\`\`\`\n\n`;
    
    return after;
  });

  fs.writeFileSync(file, content, 'utf8');
});

fs.appendFileSync('auto_report.md', report);
console.log("Interval fixes applied.");
