import { expect, test, type Page } from "@playwright/test";

const MUTATION_URL = "**/api/v1/products/**";
const MUTATION_DELAY_MS = 1_000;

async function loginAsAdminOnProducts(page: Page) {
  await page.goto("/");
  await page.locator("#email").waitFor({ timeout: 100_000 });
  await page.locator("#email").fill("admin@estoca.demo");
  await page.locator("#password").fill("demo123");
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await page
    .locator('nav[aria-label="Navegação principal"]')
    .waitFor({ state: "attached", timeout: 60_000 });
  await page
    .locator('nav[aria-label="Navegação principal"] button', { hasText: "Produtos" })
    .first()
    .click();
  await expect(page.locator("ul.divide-y > li").first()).toBeVisible();
}

/** Atrasa as mutações para que o estado "em andamento" seja observável. */
async function delayMutations(page: Page, counts: Record<string, number>) {
  await page.route(MUTATION_URL, async (route) => {
    const method = route.request().method();
    if (method === "PUT" || method === "DELETE") {
      counts[method] = (counts[method] ?? 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, MUTATION_DELAY_MS));
    }
    await route.continue();
  });
}

test.describe("modais de produto", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminOnProducts(page);
  });

  test("editar abre em modal e nada aparece no topo da tabela", async ({ page }) => {
    await page.locator("ul.divide-y > li").first().getByRole("button", { name: "Editar" }).click();

    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await expect(page.locator("dialog[open] form")).toHaveCount(1);
    await expect(page.locator("form:not(dialog form)")).toHaveCount(0);
    await expect(page.locator("dialog[open] input").first()).toBeFocused();
  });

  test("em tela baixa o foco inicial continua no primeiro campo", async ({ page }) => {
    await page.setViewportSize({ height: 480, width: 390 });
    await page.locator("ul.divide-y > li").first().getByRole("button", { name: "Editar" }).click();

    await expect(page.locator("dialog[open] input").first()).toBeFocused();
  });

  for (const [name, close] of [
    ["botão X", (page: Page) => page.getByRole("button", { name: "Fechar", exact: true }).click()],
    ["tecla Esc", (page: Page) => page.keyboard.press("Escape")],
    ["clique fora", (page: Page) => page.mouse.click(3, 3)],
    ["Cancelar", (page: Page) => page.getByRole("button", { name: "Cancelar" }).click()],
  ] as const) {
    test(`fechar por ${name} descarta o rascunho e devolve o foco`, async ({ page }) => {
      const row = page.locator("ul.divide-y > li").first();
      const editButton = row.getByRole("button", { name: "Editar" });
      const originalName = (await row.locator("p.truncate").innerText()).trim();

      await editButton.click();
      const nameInput = page.locator("dialog[open] input").first();
      await nameInput.fill("RASCUNHO NÃO SALVO");
      await close(page);

      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect(editButton).toBeFocused();
      await expect(row.locator("p.truncate")).toHaveText(originalName);

      await editButton.click();
      await expect(page.locator("dialog[open] input").first()).toHaveValue(originalName);
    });
  }

  test("selecionar texto e soltar o mouse fora não fecha o modal", async ({ page }) => {
    await page.locator("ul.divide-y > li").first().getByRole("button", { name: "Editar" }).click();
    const box = await page.locator("dialog[open] input").first().boundingBox();
    if (!box) throw new Error("campo Nome sem caixa de layout");

    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(3, 3);
    await page.mouse.up();

    await expect(page.locator("dialog[open]")).toHaveCount(1);
  });

  test("duplo clique em Salvar envia uma só requisição e o modal não fecha em andamento", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    const row = page.locator("ul.divide-y > li").first();
    await row.getByRole("button", { name: "Editar" }).click();
    await page.locator("dialog[open] input").first().fill("Produto Editado");
    await page.getByRole("button", { name: "Salvar alterações" }).dblclick();

    await expect(page.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Fechar", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    await expect(page.locator("dialog[open]")).toHaveCount(1);

    await expect(page.locator("dialog[open]")).toHaveCount(0);
    expect(counts.PUT).toBe(1);
    await expect(page.locator("ul.divide-y li p.truncate", { hasText: "Produto Editado" })).toHaveCount(1);
    await expect(page.getByText("foi atualizado")).toBeVisible();
  });

  test("salvar não reenvia com muitos cliques, Enter repetido ou envios no mesmo instante", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    const dialog = page.locator("dialog[open]");
    const editFirstRow = async (name: string) => {
      await page.locator("ul.divide-y > li").first().getByRole("button", { name: "Editar" }).click();
      await dialog.locator("input").first().fill(name);
    };

    await editFirstRow("Envio A");
    const saveButton = dialog.getByRole("button", { name: /Salvar|Salvando/ });
    for (let i = 0; i < 15; i += 1) {
      await saveButton.click({ force: true, noWaitAfter: true, timeout: 500 }).catch(() => {});
    }
    await expect(dialog).toHaveCount(0);
    expect(counts.PUT).toBe(1);

    await editFirstRow("Envio B");
    await dialog.locator("form").evaluate((form: HTMLFormElement) => {
      for (let i = 0; i < 5; i += 1) form.requestSubmit();
    });
    await expect(dialog).toHaveCount(0);
    expect(counts.PUT).toBe(2);

    await editFirstRow("Envio C");
    await dialog.locator("input").first().focus();
    for (let i = 0; i < 8; i += 1) await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    expect(counts.PUT).toBe(3);
  });

  test("erro da API mantém o modal aberto, permite corrigir e some ao reabrir", async ({
    page,
  }) => {
    const rows = page.locator("ul.divide-y > li");
    const otherSku = (await rows.nth(1).locator("p.font-mono").innerText())
      .replace(/^SKU\s+/i, "")
      .trim();
    const firstEdit = rows.first().getByRole("button", { name: "Editar" });

    await firstEdit.click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByPlaceholder("Ex.: CAFE-001").fill(otherSku);
    await dialog.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "Salvar alterações" })).toBeEnabled();

    await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
    await firstEdit.click();
    await expect(page.locator("dialog[open]").getByRole("alert")).toHaveCount(0);
  });

  test("excluir: cancelar e X preservam o produto; duplo clique exclui uma vez", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    const row = page.locator("ul.divide-y > li").first();
    const name = (await row.locator("p.truncate").innerText()).trim();
    const deleteButton = row.getByRole("button", { name: "Excluir" });
    const total = await page.locator("ul.divide-y > li").count();

    await deleteButton.click();
    await expect(page.locator("dialog[open]")).toContainText(`Excluir ${name}?`);
    await expect(page.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await deleteButton.click();
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.locator("ul.divide-y > li")).toHaveCount(total);

    await deleteButton.click();
    await page.getByRole("button", { name: "Excluir produto" }).dblclick();
    await expect(page.getByRole("button", { name: "Excluindo..." })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(1);

    await expect(page.locator("dialog[open]")).toHaveCount(0);
    expect(counts.DELETE).toBe(1);
    await expect(page.locator("ul.divide-y > li")).toHaveCount(total - 1);
    await expect(page.getByText("foi excluído do estoque")).toBeVisible();
  });
});
