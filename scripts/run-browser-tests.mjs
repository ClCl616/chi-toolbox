import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { testEnvironment } from './test-environment.mjs';
const port = '13002';
const base = `http://127.0.0.1:${port}`;
try {
  await fetch(`${base}/api/health`);
  throw new Error('Test port is already in use. Stop its owner first.');
} catch (error) {
  if (error.message.includes('already in use')) throw error;
}
const server = spawn(process.execPath, ['scripts/start-server.mjs'], {
  env: { ...testEnvironment, PORT: port },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (x) => {
  output += x;
});
server.stderr.on('data', (x) => {
  output += x;
});
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      ready = (await fetch(`${base}/api/health`)).ok;
    } catch {}
    if (ready) break;
    await sleep(250);
  }
  if (!ready) throw new Error('Test server did not become ready.');
  const runner = spawn(process.execPath, ['tests/browser/workspaces.mjs'], {
    env: { ...testEnvironment, TEST_BASE_URL: base },
    stdio: 'inherit',
  });
  const [code] = await once(runner, 'exit');
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
}
