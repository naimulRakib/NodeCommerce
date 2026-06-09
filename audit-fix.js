const fs = require('fs');
const path = require('path');

const DIRECTORIES = [
  'src/components/aco',
  'src/components/seller',
  'src/components/buyer',
  'src/components/upazilla-reseller',
  'src/components/district-reseller',
  'src/components/local-reseller',
  'src/components/superdashboard',
  'src/components/shared'
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

let files = [];
DIRECTORIES.forEach(dir => {
  if (fs.existsSync(dir)) {
    files = getAllFiles(dir, files);
  }
});

let mountedFixes = 0;
let timeoutFixes = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Pattern 2: setInterval -> recursive setTimeout
  // For RealtimeActionCenter, ACONegotiationPanel, TruckIncomingPanel, etc.
  // Actually, we've manually implemented recursive setTimeout in recently created files.
  // But older files might have setInterval.
  const setIntervalRegex = /const\s+(\w+)\s*=\s*setInterval\(\s*\(\)\s*=>\s*\{([\s\S]*?)fetch[\s\S]*?\}\s*,\s*(\d+)\s*\);/g;
  
  if (content.match(/setInterval/)) {
    // This is safer to do manually for complex files, but we can try simple regex if it fits.
    // Given the risk of breaking existing code, let's just log them and fix the known simple ones.
    console.log(`[Pattern 2] setInterval found in: ${file}`);
  }

  // Pattern 1: Missing isMounted
  // If it has useEffect and fetch, but no 'mounted' or 'isMounted'
  if (content.includes('useEffect(') && (content.includes('fetch(') || content.includes('axios.')) && !content.match(/isMounted|mounted/)) {
    console.log(`[Pattern 1] Missing isMounted in: ${file}`);
    
    // We can auto-inject a simple version if it's a very standard pattern, but React AST parsing is better.
    // For now, let's replace the whole file content for simple known cases if we had specific AST tools.
  }

  // ESLint Fixes via Regex for the specific files
  if (file.includes('DemandPanel.jsx') && file.includes('district-reseller')) {
    content = content.replace('const fetchData = useCallback(async () => {', 'const fetchData = async () => {');
    content = content.replace('  }, [districtResellerId, fetchData]);', '  }, [districtResellerId]);');
    // wrap properly
    content = content.replace('const fetchData = async () => {', 'const fetchData = useCallback(async () => {');
    content = content.replace('    } finally {\n      setLoading(false);\n    }\n  };\n\n  useEffect', '    } finally {\n      setLoading(false);\n    }\n  }, [districtResellerId]);\n\n  useEffect');
    content = content.replace('  }, [districtResellerId]);\n\n  const toggleProduct', '  }, [districtResellerId, fetchData]);\n\n  const toggleProduct');
    changed = true;
  }
  
  if (file.includes('DistrictStockOverview.tsx')) {
    // Add fetchBoth to useEffect deps
    content = content.replace('  }, [districtResellerId]);', '  }, [districtResellerId, fetchBoth]);');
    // wrap fetchBoth in useCallback
    if (!content.includes('useCallback(async () =>')) {
      content = content.replace('const fetchBoth = async () => {', 'const fetchBoth = useCallback(async () => {');
      content = content.replace('    } finally {\n      setLoading(false);\n    }\n  };', '    } finally {\n      setLoading(false);\n    }\n  }, [districtResellerId]);');
      if (!content.includes('useCallback')) {
        content = content.replace('useEffect, useState', 'useEffect, useState, useCallback');
      }
      changed = true;
    }
  }

  if (file.includes('ACONegotiationPanel.tsx')) {
    content = content.replace('  }, [sellerId]);', '  }, [sellerId, fetchNegotiations]);');
    if (!content.includes('useCallback(async () =>')) {
      content = content.replace('const fetchNegotiations = async () => {', 'const fetchNegotiations = useCallback(async () => {');
      content = content.replace('      if (isMounted.current) setLoading(false);\n    }\n  };', '      if (isMounted.current) setLoading(false);\n    }\n  }, [sellerId]);');
      content = content.replace('import React, { useState, useEffect, useRef }', 'import React, { useState, useEffect, useRef, useCallback }');
      changed = true;
    }
  }

  if (file.includes('TruckIncomingPanel.tsx')) {
    content = content.replace('  }, [upazillaId]);', '  }, [upazillaId, fetchIncomingTrucks]);');
    if (!content.includes('useCallback(async () =>')) {
      content = content.replace('const fetchIncomingTrucks = async () => {', 'const fetchIncomingTrucks = useCallback(async () => {');
      content = content.replace('      if (isMounted.current) setLoading(false);\n    }\n  };', '      if (isMounted.current) setLoading(false);\n    }\n  }, [upazillaId]);');
      content = content.replace('import React, { useState, useEffect, useRef }', 'import React, { useState, useEffect, useRef, useCallback }');
      changed = true;
    }
  }

  if (file.includes('SendStockModal.tsx') && file.includes('upazilla-reseller')) {
    content = content.replace('  }, [isOpen, sellerProductId, upazillaResellerId]);', '  }, [isOpen, sellerProductId, upazillaResellerId, handleClose]);');
    changed = true;
  }
  
  if (file.includes('SellerForm.tsx')) {
    content = content.replace('  }, [user, step]);', '  }, [user, step, form]);');
    changed = true;
  }
  
  if (file.includes('PheromoneLayer.tsx')) {
    // The 'demandPheromones' logical expression could make the dependencies of useMemo Hook change on every render
    // Move it inside the useMemo callback
    if (content.includes('const demandPheromones = pheromoneData?.demand || [];')) {
      content = content.replace('const demandPheromones = pheromoneData?.demand || [];\n  const routePheromones = pheromoneData?.route || [];\n', '');
      content = content.replace('demandPheromones.map', '(pheromoneData?.demand || []).map');
      content = content.replace('routePheromones.map', '(pheromoneData?.route || []).map');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log("Auto-fixes applied.");
