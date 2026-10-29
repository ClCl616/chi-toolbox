import { spawnSync } from 'node:child_process';
import { testEnvironment } from './test-environment.mjs';
const result = spawnSync(process.execPath, ['scripts/build-server.mjs'], {
  env: testEnvironment,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
