import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/server/supabase';
import { safeReturnPath, requestOrigin } from '@/lib/security';

const RECOVERY_TYPE = 'recovery';

function redirectVerification(origin: string) {
  return NextResponse.redirect(new URL('/account?error=verification', origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const db = await getSupabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(
          safeReturnPath(url.searchParams.get('next'), url.searchParams.get('redirectTo')),
          origin,
        ),
      );
    }
    return redirectVerification(origin);
  }
  const tokenHash = url.searchParams.get('token_hash');
  if (tokenHash) {
    const otpType = url.searchParams.get('type');
    if (otpType !== RECOVERY_TYPE) return redirectVerification(origin);
    const db = await getSupabase();
    const { error } = await db.auth.verifyOtp({
      type: RECOVERY_TYPE,
      token_hash: tokenHash,
    });
    if (error) return redirectVerification(origin);
    return NextResponse.redirect(
      new URL(
        safeReturnPath(url.searchParams.get('next'), url.searchParams.get('redirectTo')),
        origin,
      ),
    );
  }
  return redirectVerification(origin);
}
