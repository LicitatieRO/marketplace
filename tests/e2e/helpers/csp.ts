import { expect, type Page } from "@playwright/test";

const CSP_ERROR = /content security policy/i;

export function attachCspViolationCollector(page: Page) {
  const violations: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (CSP_ERROR.test(text)) {
      violations.push(text);
    }
  });

  page.on("pageerror", (error) => {
    if (CSP_ERROR.test(error.message)) {
      violations.push(error.message);
    }
  });

  return {
    assertClean(label: string) {
      expect(violations, `${label}\n${violations.join("\n")}`).toEqual([]);
    },
    async readDomViolations() {
      return page.evaluate(() => {
        const store = (window as unknown as { __cspViolations?: string[] })
          .__cspViolations;
        return store ?? [];
      });
    },
  };
}

export async function installCspViolationDomProbe(page: Page) {
  await page.addInitScript(() => {
  const target = window as unknown as { __cspViolations?: string[] };
  target.__cspViolations = [];
  document.addEventListener("securitypolicyviolation", (event) => {
    target.__cspViolations?.push(
      `${event.violatedDirective}: ${event.blockedURI || event.sourceFile || "inline"}`,
    );
  });
  });
}

export async function expectCspDocumentHeader(page: Page, path = "/") {
  const response = await page.goto(path);
  const csp =
    response?.headers()["content-security-policy"] ??
    response?.headers()["Content-Security-Policy"];
  expect(csp).toBeTruthy();
  expect(csp).toMatch(/'nonce-[^']+'/);
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("object-src 'none'");
  return csp ?? "";
}
