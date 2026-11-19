import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { assertSameOrigin, requestOrigin, RequestError } from '@/lib/security';
import {
  clientIpForMfaRateLimit,
  warnMfaVerifyMissingClientIp,
} from '@/lib/server/client-ip';
import {
  MFA_UNENROLL_SESSION_REFRESH,
  recordMfaFactorUnenrolledAudit,
  unenrollMfaFactor,
} from '@/lib/server/mfa-unenroll';
import { resolveIsStaffForMfaUnenroll } from '@/lib/server/mfa-staff-guard';
import {
  MFA_VERIFY_DENIED,
  MFA_VERIFY_UNAVAILABLE,
  mfaVerifyReserveAttempt,
  mfaVerifyResetOnSuccess,
} from '@/lib/server/mfa-verify-rate-limit';
import { requireUser } from '@/lib/server/auth';
import { failure, json, readJson } from '@/lib/server/http';

const mfaActionSchema = z
  .object({
    action: z.enum(['enroll', 'verify', 'list', 'unenroll']),
    factorId: z.uuid().optional(),
    code: z.string().regex(/^\d{6}$/).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers, requestOrigin(request.url));
    const { db, user } = await requireUser();
    const input = mfaActionSchema.parse(await readJson(request));

    if (input.action === 'list') {
      const { data, error } = await db.auth.mfa.listFactors();
      if (error) throw new RequestError('Unable to read MFA factors.');
      return json({ data });
    }

    if (input.action === 'enroll') {
      const { data, error } = await db.auth.mfa.enroll({
        factorType: 'totp',
        // GoTrue requires unique names per user, including verified backup factors.
        friendlyName: `LicitatieRO authenticator ${randomUUID()}`,
      });
      if (error) throw new RequestError('Unable to enroll authenticator.');
      return json({ data });
    }

    if (input.action === 'unenroll') {
      if (!input.factorId) {
        throw new RequestError('Authenticator factor required.');
      }
      const [{ data: workspace, error: workspaceError }, { data: claims }] =
        await Promise.all([db.rpc('get_workspace'), db.auth.getClaims()]);
      const isStaff = resolveIsStaffForMfaUnenroll(workspace, workspaceError);
      const aal = String(claims?.claims?.aal || 'aal1');
      const result = await unenrollMfaFactor(db, input.factorId, {
        aal,
        isStaff,
      });
      await recordMfaFactorUnenrolledAudit(user.id, input.factorId);
      return json({
        data: {
          removed: true,
          sessionRefreshFailed: result.sessionRefreshFailed,
          ...(result.sessionRefreshFailed
            ? { message: MFA_UNENROLL_SESSION_REFRESH }
            : {}),
        },
      });
    }

    if (!input.factorId || !input.code) {
      throw new RequestError('Authenticator factor and six-digit code required.');
    }
    const clientIp = clientIpForMfaRateLimit(request.headers);
    if (!clientIp) warnMfaVerifyMissingClientIp();
    const reservation = await mfaVerifyReserveAttempt(
      user.id,
      input.factorId,
      clientIp,
    );
    if (reservation === 'unavailable') {
      throw new RequestError(MFA_VERIFY_UNAVAILABLE, 503);
    }
    if (reservation === 'denied') {
      throw new RequestError(MFA_VERIFY_DENIED, 403);
    }
    const { data, error } = await db.auth.mfa.challengeAndVerify({
      factorId: input.factorId,
      code: input.code,
    });
    if (error) throw new RequestError(MFA_VERIFY_DENIED, 403);
    await mfaVerifyResetOnSuccess(user.id, input.factorId);
    return json({ data: { verified: Boolean(data) } });
  } catch (e) {
    return failure(e);
  }
}
