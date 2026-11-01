import { testEnvironment } from './test-environment.mjs';

// Preview the UI with dummy credentials; never load local production env files.
Object.assign(process.env, testEnvironment);
process.env.PORT ??= '13003';
console.log(`Toolbox UI: http://127.0.0.1:${process.env.PORT}/toolbox`);
await import('./start-server.mjs');
