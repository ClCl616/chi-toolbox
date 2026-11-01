import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { isSnapshot } from '../model';
import { getAuthContext } from '@/shared/server/auth';
import { isLmsOwner, sameSiteRequest } from './access-policy';

async function access(request: Request): Promise<Response | null> {
  // Production mode takes precedence over a mistakenly retained local flag.
  if (process.env.TOOLBOX_LMS_ENABLED === '1') {
    if (
      !process.env.TOOLBOX_LMS_OWNER_EMAIL?.trim() ||
      !process.env.TOOLBOX_LMS_DATA
    )
      return json({ error: 'LMS 연결 설정이 필요합니다.' }, 503);
    if (!sameSiteRequest(request, process.env.NEXT_PUBLIC_SITE_URL ?? ''))
      return json({ error: '허용되지 않은 요청입니다.' }, 403);
    try {
      const { user } = await getAuthContext();
      if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
      if (!isLmsOwner(user, process.env.TOOLBOX_LMS_OWNER_EMAIL))
        return json(
          { error: '이 계정에는 LMS가 연결되어 있지 않습니다.' },
          403,
        );
      return null;
    } catch {
      return json({ error: '로그인 상태를 확인하지 못했습니다.' }, 503);
    }
  }
  if (localAllowed(request)) return null;
  return request.method === 'GET'
    ? json({ enabled: false, snapshot: null, readIds: [] })
    : json({ error: 'Local access only' }, 403);
}

function localAllowed(request: Request) {
  if (process.env.TOOLBOX_LMS_LOCAL !== '1') return false;
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  if (
    !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) ||
    !['127.0.0.1', 'localhost'].includes(url.hostname)
  )
    return false;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  return request.method === 'GET'
    ? !origin || origin === url.origin
    : origin === url.origin;
}
const root = () => resolve(process.env.TOOLBOX_LMS_DATA ?? 'work/lms');
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Origin, Host',
    },
  });
}
async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(join(root(), file), 'utf8'));
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return null;
    throw error;
  }
}
async function snapshot() {
  const data = await readJson('snapshot.json');
  if (data !== null && !isSnapshot(data)) throw new Error('Invalid snapshot');
  return data;
}
async function reads() {
  const data = await readJson('read.json');
  if (data === null) return [];
  if (!Array.isArray(data) || !data.every((id) => typeof id === 'string'))
    throw new Error('Invalid read state');
  return data as string[];
}
export async function GET(request: Request) {
  const denied = await access(request);
  if (denied) return denied;
  try {
    return json({
      enabled: true,
      snapshot: await snapshot(),
      readIds: await reads(),
    });
  } catch {
    return json(
      { error: 'LMS 정보를 읽지 못했습니다. 마지막 확인 정보를 유지합니다.' },
      503,
    );
  }
}
let writeQueue = Promise.resolve();
export async function POST(request: Request) {
  const denied = await access(request);
  if (denied) return denied;
  try {
    const body = await request.text();
    if (body.length > 65536) return json({ error: 'Request too large' }, 413);
    const parsed: unknown = JSON.parse(body);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('ids' in parsed) ||
      !Array.isArray(parsed.ids) ||
      parsed.ids.length > 500 ||
      !parsed.ids.every((id) => typeof id === 'string')
    )
      return json({ error: 'Invalid read IDs' }, 400);
    const ids = parsed.ids as string[];
    let result: string[] = [];
    const task = writeQueue.then(async () => {
      const data = await snapshot();
      const valid = new Set(data?.events.map((event) => event.id) ?? []);
      result = [
        ...new Set([...(await reads()), ...ids.filter((id) => valid.has(id))]),
      ];
      await mkdir(root(), { recursive: true });
      const temp = join(root(), 'read.json.tmp');
      await writeFile(temp, JSON.stringify(result), {
        encoding: 'utf8',
        mode: 0o600,
      });
      await rename(temp, join(root(), 'read.json'));
    });
    writeQueue = task.catch(() => {});
    await task;
    return json({ readIds: result });
  } catch {
    return json({ error: '읽음 상태를 저장하지 못했습니다.' }, 503);
  }
}
