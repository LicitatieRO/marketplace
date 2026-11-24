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
  const currentIndex = nodes.findIndex((node) => node === active);
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
