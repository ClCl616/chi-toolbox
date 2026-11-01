import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const source = resolve(process.env.DJU_NOTIFIER_ROOT ?? '../DJU-LMS-Notifier');
const python =
  process.env.TOOLBOX_LMS_PYTHON ??
  join(source, '.venv', 'Scripts', 'python.exe');
if (!existsSync(python) || !existsSync(join(source, 'src/dju_lms_notifier')))
  throw new Error(
    'Set DJU_NOTIFIER_ROOT and TOOLBOX_LMS_PYTHON to the existing Notifier installation.',
  );
const child = spawn(
  python,
  [
    '-B',
    'workers/lms/worker.py',
    '--source',
    source,
    '--data-dir',
    resolve(process.env.TOOLBOX_LMS_DATA ?? 'work/lms'),
    ...process.argv.slice(2),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONIOENCODING: 'utf-8',
    },
  },
);
process.on('SIGINT', () => child.kill());
const [code] = await once(child, 'exit');
process.exitCode = code ?? 1;
