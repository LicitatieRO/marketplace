import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserLocalStorage,
  safeLocalStorageGetItem,
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
  safeSessionStorageGetItem,
  safeSessionStorageSetItem,
} from "@/lib/safe-browser-storage";
import {
  emptyTourStorage,
  mergeTourStorage,
  readTourStorage,
  setTourResume,
} from "@/lib/tour/storage";

describe("safe-browser-storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when localStorage access throws", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new DOMException("denied");
      },
    });
    expect(browserLocalStorage()).toBeNull();
    expect(safeLocalStorageGetItem("k")).toBeNull();
    expect(() => safeLocalStorageSetItem("k", "v")).not.toThrow();
    expect(() => safeLocalStorageRemoveItem("k")).not.toThrow();
  });

  it("swallows getItem and setItem throws", () => {
    const store = {
      getItem: () => {
        throw new DOMException("quota");
      },
      setItem: () => {
        throw new DOMException("quota");
      },
      removeItem: () => {
        throw new DOMException("quota");
      },
    };
    vi.stubGlobal("localStorage", store);
    vi.stubGlobal("window", { localStorage: store, sessionStorage: store });
    expect(safeLocalStorageGetItem("x")).toBeNull();
    expect(() => safeLocalStorageSetItem("x", "y")).not.toThrow();
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new DOMException("quota");
      },
      setItem: () => {
        throw new DOMException("quota");
      },
    });
    expect(safeSessionStorageGetItem("x")).toBeNull();
    expect(() => safeSessionStorageSetItem("x", "y")).not.toThrow();
  });
});

describe("tour storage with blocked localStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    const store = {
      getItem: () => {
        throw new DOMException("blocked");
      },
      setItem: () => {
        throw new DOMException("blocked");
      },
    };
    vi.stubGlobal("localStorage", store);
    vi.stubGlobal("window", { localStorage: store, sessionStorage: store });
  });

  it("reads default state without throwing", () => {
    expect(readTourStorage()).toEqual(emptyTourStorage());
  });

  it("write paths no-op without throwing", () => {
    expect(() => setTourResume("buyer", 2)).not.toThrow();
    expect(() => mergeTourStorage({ dismissed: true })).not.toThrow();
    expect(readTourStorage()).toEqual(emptyTourStorage());
  });
});
