import { redirect } from 'next/navigation';
import { v2ReturnPath } from '@/features/auth/return-path';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (typeof params.returnTo === 'string')
    query.set('returnTo', v2ReturnPath(params.returnTo));
  if (typeof params.error === 'string') query.set('error', params.error);
  redirect('/v2/login' + (query.size ? '?' + query : ''));
}
