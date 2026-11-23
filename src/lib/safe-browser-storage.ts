function browserStorage(kind: "localStorage" | "sessionStorage"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window[kind];
  } catch {
    return null;
  }
}

export function browserLocalStorage(): Storage | null {
  return browserStorage("localStorage");
}

export function browserSessionStorage(): Storage | null {
  return browserStorage("sessionStorage");
}

export function safeLocalStorageGetItem(key: string): string | null {
  const storage = browserLocalStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSetItem(key: string, value: string): void {
  const storage = browserLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // blocked or quota — no-op
  }
}

export function safeLocalStorageRemoveItem(key: string): void {
  const storage = browserLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // no-op
  }
}

export function safeSessionStorageGetItem(key: string): string | null {
  const storage = browserSessionStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSessionStorageSetItem(key: string, value: string): void {
  const storage = browserSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // no-op
  }
}

export function safeSessionStorageRemoveItem(key: string): void {
  const storage = browserSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // no-op
  }
}
