import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const routerDirectory = path.join(root, 'server/routers');
const files = [path.join(root, 'server/routers.ts'), ...fs.readdirSync(routerDirectory)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => path.join(routerDirectory, name))];

const rows = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  const routerNames = [...source.matchAll(/const\s+(\w+Router)\s*=\s*router\(/g)].map((match) => match[1]);
  const procedurePattern = /^\s*([A-Za-z0-9_]+):\s*(publicProcedure|protectedProcedure|adminProcedure)([\s\S]{0,1600}?)(?=^\s*[A-Za-z0-9_]+:\s*(?:publicProcedure|protectedProcedure|adminProcedure)|^\s*\}\);)/gm;
  for (const match of source.matchAll(procedurePattern)) {
    const [, name, access, body] = match;
    const operation = body.includes('.mutation(') ? 'mutation' : body.includes('.query(') ? 'query' : 'unknown';
    rows.push({
      file: relative,
      routerCandidates: routerNames,
      procedure: name,
      access,
      operation,
      hasInputSchema: body.includes('.input('),
      hasStatusField: /\b(status|available|unavailable|unavailableReason|limitation)\b/.test(body),
      hasSourceField: /\b(source|sourceUrl|fetchedAt|queriedAt|observationAt|observationDate)\b/.test(body),
    });
  }
}

const summary = {
  scannedFiles: files.length,
  procedures: rows.length,
  byAccess: Object.fromEntries(['publicProcedure', 'protectedProcedure', 'adminProcedure'].map((key) => [key, rows.filter((row) => row.access === key).length])),
  byOperation: Object.fromEntries(['query', 'mutation', 'unknown'].map((key) => [key, rows.filter((row) => row.operation === key).length])),
  statusAwareProcedures: rows.filter((row) => row.hasStatusField).length,
  sourceAwareProcedures: rows.filter((row) => row.hasSourceField).length,
};

const output = { generatedAt: new Date().toISOString(), summary, rows };
const outputPath = path.join(root, 'audit/runtime/interface-contract-matrix.json');
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ ...summary, outputPath }, null, 2));
