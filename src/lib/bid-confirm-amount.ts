/** Submitted bid amount is always the confirm-step snapshot, never the live draft field. */
export function placeBidAmountMinor(
  confirmSnapshotMinor: number | null,
  _draftMinor?: number | null,
): number | null {
  void _draftMinor;
  if (confirmSnapshotMinor === null || !Number.isFinite(confirmSnapshotMinor)) {
    return null;
  }
  return confirmSnapshotMinor;
}
