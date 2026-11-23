import { describe, expect, it, vi } from "vitest";
import { handleTourDialogTabKey } from "@/lib/tour/focus-trap";

describe("tour focus trap helpers", () => {
  it("wraps Tab forward at the last focusable", () => {
    const first = { focus: vi.fn(), offsetParent: {} } as unknown as HTMLElement;
    const last = { focus: vi.fn(), offsetParent: {} } as unknown as HTMLElement;
    const container = {
      querySelectorAll: () => [first, last],
    } as unknown as HTMLElement;
    vi.stubGlobal("document", {
      activeElement: last,
    });
    const event = {
      key: "Tab",
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    handleTourDialogTabKey(event, container);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
