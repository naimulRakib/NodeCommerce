const fs = require('fs');

const files = [
  'src/components/seller/AcoShipmentsPanel.tsx',
  'src/components/seller/StockOrdersPanel.tsx',
  'src/components/buyer/ProductDetailClient.tsx',
  'src/components/buyer/SearchBar.tsx',
  'src/components/upazilla-reseller/AcoShipmentsPanel.tsx',
  'src/components/upazilla-reseller/AvailableStockPanel.tsx',
  'src/components/upazilla-reseller/NegotiationPanel.tsx',
  'src/components/upazilla-reseller/SellersPanel.tsx',
  'src/components/upazilla-reseller/SendStockModal.tsx',
  'src/components/district-reseller/ACOPanel.tsx',
  'src/components/district-reseller/NationalSurplusView.tsx',
  'src/components/district-reseller/SendStockModal.tsx',
  'src/components/district-reseller/UpazillaAvailableStockView.tsx',
  'src/components/local-reseller/DemandPanel.tsx',
  'src/components/superdashboard/GlobalACOControl.tsx',
  'src/components/superdashboard/MultiProductPheromoneLayer.tsx',
  'src/components/superdashboard/ShipmentPipelinePanel.tsx'
];

let report = "# Memory Leak Fix Report\n\n";

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Find useEffect with fetch
  // This is a naive regex but works for our simple useEffects
  const effectRegex = /(useEffect\(\(\) => \{\n)(\s*)(fetch[\s\S]*?\n\s*\})([\s\S]*?)(\}, \[.*?\]\);)/g;
  
  content = content.replace(effectRegex, (match, start, indent, fetchBody, endBody, end) => {
    // We found a fetch body, let's inject mounted flag
    if (match.includes('isMounted') || match.includes('mounted')) return match;
    
    const before = match;
    
    // Inject let mounted = true;
    const newStart = start + indent + "let mounted = true;\n" + indent;
    
    // Find state setters like set*(...)
    // Wait, it's easier to just do:
    let newFetchBody = fetchBody;
    // Replace setData(...) with if (mounted) setData(...)
    newFetchBody = newFetchBody.replace(/(set[A-Z]\w*\()/g, "if (mounted) $1");
    
    // Inject cleanup
    const newEndBody = endBody + "\n" + indent + "return () => { mounted = false; };\n" + indent.substring(0, indent.length - 2);
    
    const after = newStart + newFetchBody + newEndBody + end;
    
    report += `### Fixed ${file}\n\n**BEFORE:**\n\`\`\`typescript\n${before}\n\`\`\`\n\n**AFTER:**\n\`\`\`typescript\n${after}\n\`\`\`\n\n`;
    
    return after;
  });

  // A different common pattern is an async function inside useEffect
  const effectAsyncRegex = /(useEffect\(\(\) => \{\n)(\s*)(const \w+ = async \(\) => \{[\s\S]*?\n\s*\};\n\s*\w+\(\);)([\s\S]*?)(\}, \[.*?\]\);)/g;
  
  content = content.replace(effectAsyncRegex, (match, start, indent, fetchBody, endBody, end) => {
    if (match.includes('isMounted') || match.includes('mounted')) return match;
    const before = match;
    const newStart = start + indent + "let mounted = true;\n" + indent;
    let newFetchBody = fetchBody.replace(/(set[A-Z]\w*\()/g, "if (mounted) $1");
    const newEndBody = endBody + "\n" + indent + "return () => { mounted = false; };\n" + indent.substring(0, indent.length - 2);
    const after = newStart + newFetchBody + newEndBody + end;
    report += `### Fixed ${file}\n\n**BEFORE:**\n\`\`\`typescript\n${before}\n\`\`\`\n\n**AFTER:**\n\`\`\`typescript\n${after}\n\`\`\`\n\n`;
    return after;
  });

  fs.writeFileSync(file, content, 'utf8');
});

fs.writeFileSync('auto_report.md', report);
console.log("Auto-fixes applied.");
