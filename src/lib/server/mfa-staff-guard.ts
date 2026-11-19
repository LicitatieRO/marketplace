import 'server-only';

type WorkspaceProfile = { is_staff?: boolean };

export function resolveIsStaffForMfaUnenroll(
  workspace: { profile?: WorkspaceProfile } | null | undefined,
  workspaceError: { message?: string } | null | undefined,
): boolean {
  if (workspaceError || !workspace?.profile) {
    console.error('mfa.unenroll_staff_resolution_failed', {
      reason: workspaceError ? 'workspace_rpc_error' : 'profile_missing',
    });
    return true;
  }
  return workspace.profile.is_staff === true;
}
