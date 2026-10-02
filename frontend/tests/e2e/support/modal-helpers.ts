import { expect, type Locator, type Page } from "@playwright/test";

const MUTATION_DELAY_MS = 1_000;

export type Area = "/produtos" | "/categorias" | "/movimentacoes";

/** Entra como administrador numa sandbox nova e abre a área pedida. */
export async function loginAsAdmin(page: Page, area: Area) {
  await page.goto("/entrar");
  await page.locator("#email").waitFor({ timeout: 100_000 });
  await page.getByRole("button", { name: "Entrar como Administrador" }).click();
  await page.waitForURL("**/painel", { timeout: 60_000 });
  // A sessão e o login vivem no sessionStorage da aba: navegar direto mantém os dois.
  await page.goto(area);
}

/** Atrasa as mutações de um recurso para que o estado "em andamento" seja observável. */
export async function delayMutations(
  page: Page,
  resource: "products" | "categories" | "stock-movements",
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

/** O modal aberto, seja de formulário ou de confirmação. */
export function dialogOf(page: Page): Locator {
  return page.locator('[data-slot="dialog-content"]');
}

export const CLOSE_ACTIONS = [
  ["botão X", (page: Page) => dialogOf(page).getByRole("button", { name: "Fechar", exact: true }).click()],
  ["tecla Esc", (page: Page) => page.keyboard.press("Escape")],
  ["clique fora", (page: Page) => page.mouse.click(3, 3)],
  ["Cancelar", (page: Page) => dialogOf(page).getByRole("button", { name: "Cancelar" }).click()],
] as const;

export async function expectNoModal(page: Page) {
  await expect(dialogOf(page)).toHaveCount(0);
}

/** Nenhum formulário fora do modal: o cadastro não volta a aparecer no topo da tela. */
export async function expectFormsOnlyInModal(page: Page) {
  await expect(dialogOf(page).locator("form")).toHaveCount(1);
  const outside = await page.evaluate(
    () =>
      [...document.querySelectorAll("form")].filter(
        (form) => form.getAttribute("role") !== "search" && !form.closest('[data-slot="dialog-content"]'),
      ).length,
  );
  expect(outside).toBe(0);
}

/** Escolhe uma opção num select do Radix e espera a lista fechar. */
export async function pickOption(page: Page, trigger: Locator, option: string | RegExp) {
  await trigger.click();
  await page.getByRole("option", { name: option }).click();
  await page.locator('[data-slot="select-content"]').waitFor({ state: "detached" });
}

/** Clica várias vezes sem esperar: simula a pessoa insistindo no botão de envio. */
export async function hammer(button: Locator, times = 15) {
  for (let i = 0; i < times; i += 1) {
    await button.click({ force: true, noWaitAfter: true, timeout: 500 }).catch(() => {});
  }
}

export async function requestSubmitMany(dialog: Locator, times = 5) {
  await dialog.locator("form").evaluate((form: HTMLFormElement, n) => {
    for (let i = 0; i < n; i += 1) form.requestSubmit();
  }, times);
}
