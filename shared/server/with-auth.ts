import { NextResponse } from 'next/server';
import { errorMessage, getAuthContext } from './auth';

type AuthContext = Awaited<ReturnType<typeof getAuthContext>>;
type SignedInContext = AuthContext & { user: NonNullable<AuthContext['user']> };

/** HTTP authentication boundary. Ownership checks and RLS remain in each feature. */
export function withAuth(
  handler: (request: Request, context: SignedInContext) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    try {
      const context = await getAuthContext();
      if (!context.user) {
        return NextResponse.json(
          { message: '로그인이 필요합니다.' },
          { status: 401 },
        );
      }
      return await handler(request, { ...context, user: context.user });
    } catch (error) {
      return NextResponse.json(
        { message: errorMessage(error) },
        { status: 503 },
      );
    }
  };
}
