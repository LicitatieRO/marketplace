const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableElementsIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (node) => node.offsetParent !== null || node === document.activeElement,
  );
}

export function handleTourDialogTabKey(
  event: KeyboardEvent,
  container: HTMLElement,
): void {
  if (event.key !== "Tab") return;
  const nodes = focusableElementsIn(container);
  if (nodes.length === 0) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  const currentIndex = active instanceof HTMLElement ? nodes.indexOf(active) : -1;
  if (event.shiftKey) {
    if (currentIndex <= 0) {
      event.preventDefault();
      nodes[nodes.length - 1]?.focus();
    }
  } else if (currentIndex === -1 || currentIndex >= nodes.length - 1) {
    event.preventDefault();
    nodes[0]?.focus();
  }
}

export function shouldTourEnterAdvanceNext(
  event: KeyboardEvent,
  dialog: HTMLElement | null,
): boolean {
  if (event.key !== "Enter" || !dialog) return false;
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (target === dialog) return true;
  return target.dataset?.testid === "tour-next";
}
