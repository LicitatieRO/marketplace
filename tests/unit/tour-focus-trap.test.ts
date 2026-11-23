import { describe, expect, it } from "vitest";
import { shouldTourEnterAdvanceNext } from "@/lib/tour/focus-trap";

describe("tour focus trap helpers", () => {
  it("only treats Enter on dialog or Next as advance", () => {
    const dialog = { dataset: {} } as unknown as HTMLElement;
    const skip = { dataset: { testid: "tour-skip" } } as unknown as HTMLElement;
    const next = { dataset: { testid: "tour-next" } } as unknown as HTMLElement;

    const skipEvent = {
      key: "Enter",
      target: skip,
    } as unknown as KeyboardEvent;
    expect(shouldTourEnterAdvanceNext(skipEvent, dialog)).toBe(false);

    const nextEvent = { key: "Enter", target: next } as unknown as KeyboardEvent;
    expect(shouldTourEnterAdvanceNext(nextEvent, dialog)).toBe(true);

    const dialogEvent = { key: "Enter", target: dialog } as unknown as KeyboardEvent;
    expect(shouldTourEnterAdvanceNext(dialogEvent, dialog)).toBe(true);
  });
});
