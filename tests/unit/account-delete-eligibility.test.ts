import { describe, expect, it } from "vitest";
import { isAccountDeleteConfirmationValid } from "@/lib/account-delete-confirmation";

describe("isAccountDeleteConfirmationValid", () => {
  it("accepts matching email case-insensitively", () => {
    expect(
      isAccountDeleteConfirmationValid("Member@Example.test", "member@example.test"),
    ).toBe(true);
  });

  it("accepts keyword confirmations", () => {
    expect(isAccountDeleteConfirmationValid("ȘTERGE", "a@b.test")).toBe(true);
    expect(isAccountDeleteConfirmationValid("DELETE", "a@b.test")).toBe(true);
  });

  it("rejects empty or wrong values", () => {
    expect(isAccountDeleteConfirmationValid("", "a@b.test")).toBe(false);
    expect(isAccountDeleteConfirmationValid("delete", "a@b.test")).toBe(false);
  });
});
