import { expect, type Page } from "@playwright/test";

export const POC_PERSONA_LABEL_RO = {
  guest: "Vizitator",
  owner: "Proprietar",
  buyer: "Cumpărător",
  dual: "Dual (vizitator + autentificat)",
} as const;

export type PocPersonaKey = keyof typeof POC_PERSONA_LABEL_RO;

/** Open the closed Demo chip and pick a staging POC persona (Romanian default UI). */
export async function switchPocDemoPersona(
  page: Page,
  persona: PocPersonaKey,
  options?: { waitForSwitchApi?: boolean },
) {
  const switcher = page.getByTestId("poc-account-switcher");
  await expect(switcher).toBeVisible();
  const trigger = switcher.locator(".demo-switcher-fab-trigger");
  await expect(trigger).toBeVisible();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
    await expect(switcher.locator(".demo-switcher-fab-panel")).toBeVisible();
  }
  const personaButton = switcher.getByRole("button", {
    name: POC_PERSONA_LABEL_RO[persona],
    exact: true,
  });
  await expect(personaButton).toBeVisible();
  if (options?.waitForSwitchApi) {
    const switchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/poc/switch-account") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    );
    await personaButton.click();
    expect((await switchResponse).ok()).toBe(true);
  } else {
    await personaButton.click();
  }
}
