import { describe, expect, it } from "vitest";
import {
  OPTIONAL_CONTENT_STORAGE_KEY,
  allowsOptionalContent,
  parseOptionalContent,
  readOptionalContentFromStorage,
} from "@/lib/optional-content";
describe("optional content preference", () => {
  it("defaults to disallowing embeds when unset", () => {
    expect(allowsOptionalContent(null)).toBe(false);
    expect(allowsOptionalContent(parseOptionalContent("rejected"))).toBe(false);
  });
  it("allows embeds only after explicit acceptance", () => {
    expect(allowsOptionalContent(parseOptionalContent("accepted"))).toBe(true);
  });
  it("reads from storage adapter", () => {
    const bag = new Map<string, string>();
    expect(
      readOptionalContentFromStorage((key) => bag.get(key) ?? null),
    ).toBeNull();
    bag.set(OPTIONAL_CONTENT_STORAGE_KEY, "accepted");
    expect(readOptionalContentFromStorage((key) => bag.get(key) ?? null)).toBe(
      "accepted",
    );
  });
});