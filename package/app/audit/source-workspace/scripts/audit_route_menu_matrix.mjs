import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routesTsv = fs.readFileSync(path.join(root, 'audit/inventory/routes.tsv'), 'utf8').trim().split('\n').slice(1);
const routeRows = routesTsv.map((line) => {
  const [routePath, component] = line.split('\t');
  return { routePath, component, hasParameter: routePath.includes('/:') };
});
const app = fs.readFileSync(path.join(root, 'client/src/App.tsx'), 'utf8');
const currentPaths = new Set([...app.matchAll(/<Route\s+path=\{?"([^"\n]+)"\}?/g)].map((match) => match[1]));
const missingCurrentRoutes = routeRows.filter(({ routePath }) => !currentPaths.has(routePath)).map(({ routePath }) => routePath);
const extraCurrentRoutes = [...currentPaths].filter((routePath) => !routeRows.some((row) => row.routePath === routePath));
const protectedPaths = [...app.matchAll(/<Route\s+path=\{?"([^"\n]+)"\}?\s+component=\{\(\)\s*=>\s*<ProtectedRoute/g)].map((match) => match[1]);
const parameterRoutes = routeRows.filter((row) => row.hasParameter).map((row) => row.routePath);
const explicitNotFoundPreserved = currentPaths.has('/404');
const finalFallbackPreserved = /<Route\s+component=\{NotFound\}\s*\/>/.test(app);
const menuRows = fs.readFileSync(path.join(root, 'audit/inventory/menu-components.tsv'), 'utf8').trim().split('\n').slice(1)
  .map((line) => line.trim()).filter((line) => line && !line.includes('/ui/'));
const missingMenuComponents = menuRows.filter((relative) => !fs.existsSync(path.join(root, relative)));
const menuTargetsByComponent = menuRows.map((relative) => {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const targets = [...new Set([...source.matchAll(/["'`]((?:\/[A-Za-z0-9_:\/-]+))["'`]/g)].map((match) => match[1]))]
    .filter((target) => target !== '/');
  return { component: relative, targets };
});
const menuHandler = fs.readFileSync(path.join(root, 'client/src/lib/menuItemHandler.ts'), 'utf8');
const configPaths = new Map([...menuHandler.matchAll(/['"]([^'"]+)['"]\s*:\s*\{([^{}]*)\}/gs)]
  .map((match) => [match[1], match[2].match(/path:\s*['"]([^'"]+)['"]/)?.[1]])
  .filter(([, target]) => target));
const encodedTargetsByComponent = menuRows.map((relative) => {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const codes = [...new Set([...source.matchAll(/code:\s*'([^']+)'/g)].map((match) => match[1]))];
  const targets = codes.map((code) => ({ code, target: configPaths.get(code) ?? `/menu-item/${code}`, fallback: !configPaths.has(code) }));
  return { component: relative, targets };
});
const routeCovers = (target) => {
  const base = target.split('?')[0];
  return [...currentPaths].some((routePath) => routePath === base || new RegExp(`^${routePath.replace(/:[^/]+/g, '[^/]+')}$`).test(base));
};
const directMenuTargets = menuTargetsByComponent.flatMap(({ component, targets }) => targets.map((target) => ({ component, target, kind: 'direct' })));
const encodedMenuTargets = encodedTargetsByComponent.flatMap(({ component, targets }) => targets.map((entry) => ({ component, ...entry, kind: entry.fallback ? 'fallback' : 'configured' })));
const unresolvedMenuTargets = [...directMenuTargets, ...encodedMenuTargets].filter(({ target }) => !routeCovers(target));
const menuTargetCount = directMenuTargets.length + encodedMenuTargets.length;

const result = {
  baselineRouteCount: routeRows.length,
  currentRouteCount: currentPaths.size,
  missingCurrentRoutes,
  extraCurrentRoutes,
  parameterRoutes,
  protectedPaths,
  explicitNotFoundPreserved,
  finalFallbackPreserved,
  baselineMenuComponentCount: menuRows.length,
  missingMenuComponents,
  menuTargetCount,
  menuTargetsByComponent,
  encodedTargetsByComponent,
  unresolvedMenuTargets,
  pass: missingCurrentRoutes.length === 0 && missingMenuComponents.length === 0 && unresolvedMenuTargets.length === 0 && explicitNotFoundPreserved && finalFallbackPreserved,
};
console.log(JSON.stringify(result, null, 2));
