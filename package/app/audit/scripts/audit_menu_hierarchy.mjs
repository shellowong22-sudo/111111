import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const components = fs.readFileSync(path.join(root, 'audit/inventory/menu-components.tsv'), 'utf8').trim().split('\n').slice(1)
  .map((line) => line.trim()).filter((line) => line && !line.includes('/ui/'));

const rows = components.map((relative) => {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const items = [...source.matchAll(/\{\s*num:\s*(\d+)\s*,\s*code:\s*['"]([^'"]*)['"]\s*,\s*name:\s*['"]([^'"]+)['"]/g)]
    .map((match) => ({ ordinal: Number(match[1]), code: match[2] || null, name: match[3] }));
  const headings = [...source.matchAll(/<(?:span|div)[^>]*>([^<>]{2,80})<\/(?:span|div)>/g)]
    .map((match) => match[1].trim()).filter((text) => /[\u4e00-\u9fffA-Za-z]/.test(text)).slice(0, 16);
  const visibilitySignals = [...new Set([...source.matchAll(/\b(user|role|admin|isAdmin|isAuthenticated|useAuth)\b/g)].map((match) => match[1]))];
  return {
    component: relative,
    itemCount: items.length,
    items,
    headings,
    visibilitySignals,
    usesIndirectMenuHandler: source.includes('handleMenuItemClick'),
    usesLocationNavigation: source.includes('setLocation('),
  };
});

const summary = {
  menuComponents: rows.length,
  menusWithNumberedItems: rows.filter((row) => row.itemCount > 0).length,
  numberedItems: rows.reduce((sum, row) => sum + row.itemCount, 0),
  menusWithVisibilitySignals: rows.filter((row) => row.visibilitySignals.length > 0).length,
  menusUsingIndirectHandler: rows.filter((row) => row.usesIndirectMenuHandler).length,
  menusUsingLocationNavigation: rows.filter((row) => row.usesLocationNavigation).length,
};

const output = { generatedAt: new Date().toISOString(), summary, rows };
const outputPath = path.join(root, 'audit/runtime/menu-hierarchy-matrix.json');
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ ...summary, outputPath }, null, 2));
