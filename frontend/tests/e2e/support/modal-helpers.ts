import { expect, type Page } from "@playwright/test";

const MUTATION_DELAY_MS = 1_000;

export type Section = "Produtos" | "Categorias";

export async function loginAsAdmin(page: Page, section: Section) {
  await page.goto("/");
  await page.locator("#email").waitFor({ timeout: 100_000 });
  await page.locator("#email").fill("admin@estoca.demo");
  await page.locator("#password").fill("demo123");
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await page
    .locator('nav[aria-label="Navegação principal"]')
    .waitFor({ state: "attached", timeout: 60_000 });
  await page
    .locator('nav[aria-label="Navegação principal"] button', { hasText: section })
    .first()
    .click();
}

/** Atrasa as mutações de um recurso para que o estado "em andamento" seja observável. */
export async function delayMutations(
  page: Page,
  resource: "products" | "categories",
  counts: Record<string, number>,
) {
  await page.route(`**/api/v1/${resource}**`, async (route) => {
    const method = route.request().method();
    if (method === "PUT" || method === "DELETE" || method === "POST") {
      counts[method] = (counts[method] ?? 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, MUTATION_DELAY_MS));
    }
    await route.continue();
  });
}

export const CLOSE_ACTIONS = [
  ["botão X", (page: Page) => page.getByRole("button", { name: "Fechar", exact: true }).click()],
  ["tecla Esc", (page: Page) => page.keyboard.press("Escape")],
  ["clique fora", (page: Page) => page.mouse.click(3, 3)],
  ["Cancelar", (page: Page) => page.getByRole("button", { name: "Cancelar" }).click()],
] as const;

export async function expectNoModal(page: Page) {
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}
