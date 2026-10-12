import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error('DATABASE_URL is not set');
const url = new URL(raw);
const output = process.argv[2] ?? '/home/ubuntu/finance-hub-archive/database/finance-hub.sql';
const args = [
  '--skip-lock-tables', '--routines', '--triggers', '--hex-blob',
  '--host', url.hostname,
  '--port', String(url.port || 3306),
  '--user', decodeURIComponent(url.username),
  url.pathname.replace(/^\//, ''),
];
const child = spawn('mysqldump', args, {
  env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const out = createWriteStream(output);
let stderr = '';
child.stdout.pipe(out);
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('close', (code) => {
  if (stderr) process.stderr.write(stderr);
  process.exitCode = code ?? 1;
});
