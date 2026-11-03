import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { testEnvironment } from './test-environment.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const port = '13002';
const base = `http://127.0.0.1:${port}`;
const suite = ['toolbox', 'lms', 'dev-login'].includes(process.argv[2])
  ? process.argv[2]
  : 'workspaces';
try {
  await fetch(`${base}/api/health`);
  throw new Error('Test port is already in use. Stop its owner first.');
} catch (error) {
  if (error.message.includes('already in use')) throw error;
}
const lmsData =
  suite === 'lms'
    ? await mkdtemp(join(tmpdir(), 'chi-toolbox-lms-test-'))
    : null;
const suiteEnvironment = {
  ...testEnvironment,
  TOOLBOX_LMS_ENABLED: '0',
  TOOLBOX_LMS_LOCAL: lmsData ? '1' : '0',
  ...(lmsData ? { TOOLBOX_LMS_DATA: lmsData } : {}),
};
const server = spawn(process.execPath, ['scripts/start-server.mjs'], {
  env: { ...suiteEnvironment, PORT: port },
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
  const runner = spawn(process.execPath, [`tests/browser/${suite}.mjs`], {
    env: { ...suiteEnvironment, TEST_BASE_URL: base },
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
  if (lmsData) await rm(lmsData, { recursive: true, force: true });
}
