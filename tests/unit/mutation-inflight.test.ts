import { describe, expect, it } from "vitest";
import { createMutationInflightGuard } from "@/lib/mutation-inflight";

describe("createMutationInflightGuard", () => {
  it("allows only one in-flight acquire until release", () => {
    const guard = createMutationInflightGuard();
    expect(guard.tryAcquire()).toBe(true);
    expect(guard.tryAcquire()).toBe(false);
    guard.release();
    expect(guard.tryAcquire()).toBe(true);
    guard.release();
  });
});