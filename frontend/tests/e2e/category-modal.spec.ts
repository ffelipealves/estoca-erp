import { expect, test, type Page } from "@playwright/test";

import {
  CLOSE_ACTIONS,
  delayMutations as delayResourceMutations,
  loginAsAdmin,
} from "./support/modal-helpers";

const delayMutations = (page: Page, counts: Record<string, number>) =>
  delayResourceMutations(page, "categories", counts);

const NAME_PLACEHOLDER = "Ex.: Bebidas";

const cards = (page: Page) => page.locator("ul.gap-px > li");
const dialogOf = (page: Page) => page.locator("dialog[open]");
const cardNameOf = (page: Page, name: string) =>
  cards(page).filter({ has: page.getByText(name, { exact: true }) });

async function openCreateModal(page: Page) {
  await page.getByRole("button", { name: "+ Nova categoria" }).click();
  await expect(dialogOf(page)).toHaveCount(1);
}

async function createCategory(page: Page, name: string) {
  await openCreateModal(page);
  await dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER).fill(name);
  await dialogOf(page).getByRole("button", { name: "Cadastrar categoria" }).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(cardNameOf(page, name)).toHaveCount(1);
}

test.describe("modais de categoria", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, "Categorias");
    await expect(cards(page).first()).toBeVisible();
  });

  test("cadastrar abre em modal, com foco no nome e nada no topo da lista", async ({ page }) => {
    await openCreateModal(page);

    await expect(page.locator("dialog[open] form")).toHaveCount(1);
    await expect(page.locator("form:not(dialog form)")).toHaveCount(0);
    await expect(dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER)).toBeFocused();
    await expect(page.getByRole("button", { name: "Fechar formulário" })).toHaveCount(0);
  });

  for (const [name, close] of CLOSE_ACTIONS) {
    test(`cadastro: fechar por ${name} descarta o rascunho e devolve o foco`, async ({ page }) => {
      const total = await cards(page).count();
      const newButton = page.getByRole("button", { name: "+ Nova categoria" });

      await openCreateModal(page);
      await dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER).fill("Rascunho");
      await close(page);

      await expect(dialogOf(page)).toHaveCount(0);
      await expect(newButton).toBeFocused();
      await expect(cards(page)).toHaveCount(total);

      await openCreateModal(page);
      await expect(dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER)).toHaveValue("");
    });

    test(`edição: fechar por ${name} descarta o rascunho e devolve o foco`, async ({ page }) => {
      const card = cards(page).first();
      const originalName = (await card.locator("p.font-display").innerText()).trim();
      const editButton = card.getByRole("button", { name: "Editar" });

      await editButton.click();
      await dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER).fill("RASCUNHO NÃO SALVO");
      await close(page);

      await expect(dialogOf(page)).toHaveCount(0);
      await expect(editButton).toBeFocused();
      await expect(card.locator("p.font-display")).toHaveText(originalName);

      await editButton.click();
      await expect(dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER)).toHaveValue(originalName);
    });
  }

  test("editar abre em modal com o nome atual e o foco no campo", async ({ page }) => {
    const card = cards(page).first();
    const originalName = (await card.locator("p.font-display").innerText()).trim();

    await card.getByRole("button", { name: "Editar" }).click();

    await expect(page.locator("form:not(dialog form)")).toHaveCount(0);
    await expect(dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER)).toHaveValue(originalName);
    await expect(dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER)).toBeFocused();
    await expect(dialogOf(page)).toContainText("Editar categoria");
  });

  test("selecionar texto e soltar o mouse fora não fecha o modal", async ({ page }) => {
    await openCreateModal(page);
    const box = await dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER).boundingBox();
    if (!box) throw new Error("campo Nome sem caixa de layout");

    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(3, 3);
    await page.mouse.up();

    await expect(dialogOf(page)).toHaveCount(1);
  });

  test("cadastro: muitos cliques, envios simultâneos e Enter repetido criam uma só categoria", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);
    const total = await cards(page).count();
    const nameInput = () => dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER);

    await openCreateModal(page);
    await nameInput().fill("Categoria A");
    const submit = dialogOf(page).getByRole("button", { name: /Cadastrar categoria|Cadastrando/ });
    for (let i = 0; i < 15; i += 1) {
      await submit.click({ force: true, noWaitAfter: true, timeout: 500 }).catch(() => {});
    }
    await expect(page.getByRole("button", { name: "Fechar", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    await expect(dialogOf(page)).toHaveCount(1);

    await expect(dialogOf(page)).toHaveCount(0);
    expect(counts.POST).toBe(1);
    await expect(cards(page)).toHaveCount(total + 1);
    await expect(page.getByText("Categoria A foi adicionada ao catálogo.")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Nova categoria" })).toBeFocused();

    await openCreateModal(page);
    await nameInput().fill("Categoria B");
    await dialogOf(page)
      .locator("form")
      .evaluate((form: HTMLFormElement) => {
        for (let i = 0; i < 5; i += 1) form.requestSubmit();
      });
    await expect(dialogOf(page)).toHaveCount(0);
    expect(counts.POST).toBe(2);

    await openCreateModal(page);
    await nameInput().fill("Categoria C");
    for (let i = 0; i < 8; i += 1) await page.keyboard.press("Enter");
    await expect(dialogOf(page)).toHaveCount(0);
    expect(counts.POST).toBe(3);
    await expect(cards(page)).toHaveCount(total + 3);
  });

  test("edição: muitos cliques e envios simultâneos salvam uma só vez e atualizam a lista", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);
    const editFirst = async (name: string) => {
      await cards(page).first().getByRole("button", { name: "Editar" }).click();
      await dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER).fill(name);
    };

    await editFirst("Renomeada A");
    const save = dialogOf(page).getByRole("button", { name: /Salvar|Salvando/ });
    for (let i = 0; i < 15; i += 1) {
      await save.click({ force: true, noWaitAfter: true, timeout: 500 }).catch(() => {});
    }
    await expect(dialogOf(page)).toHaveCount(0);
    expect(counts.PUT).toBe(1);
    await expect(cardNameOf(page, "Renomeada A")).toHaveCount(1);
    await expect(page.getByText("Renomeada A foi atualizada.")).toBeVisible();

    await cardNameOf(page, "Renomeada A").getByRole("button", { name: "Editar" }).click();
    await dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER).fill("Renomeada B");
    await dialogOf(page)
      .locator("form")
      .evaluate((form: HTMLFormElement) => {
        for (let i = 0; i < 5; i += 1) form.requestSubmit();
      });
    await expect(dialogOf(page)).toHaveCount(0);
    expect(counts.PUT).toBe(2);
  });

  test("nome duplicado mantém o modal aberto, permite corrigir e o erro some ao reabrir", async ({
    page,
  }) => {
    const existingName = (await cards(page).first().locator("p.font-display").innerText()).trim();
    const total = await cards(page).count();

    await openCreateModal(page);
    await dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER).fill(existingName);
    await dialogOf(page).getByRole("button", { name: "Cadastrar categoria" }).click();

    await expect(dialogOf(page).getByRole("alert")).toBeVisible();
    await expect(dialogOf(page)).toHaveCount(1);
    await expect(cards(page)).toHaveCount(total);
    await expect(dialogOf(page).getByRole("button", { name: "Cadastrar categoria" })).toBeEnabled();

    await dialogOf(page).getByPlaceholder(NAME_PLACEHOLDER).fill("Nome Corrigido");
    await dialogOf(page).getByRole("button", { name: "Cadastrar categoria" }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(cards(page)).toHaveCount(total + 1);

    await openCreateModal(page);
    await expect(dialogOf(page).getByRole("alert")).toHaveCount(0);
  });

  test("excluir: foco em Cancelar, X e Cancelar preservam a categoria e duplo clique exclui uma vez", async ({
    page,
  }) => {
    await createCategory(page, "Temporária");
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    const total = await cards(page).count();
    const deleteButton = cardNameOf(page, "Temporária").getByRole("button", { name: "Excluir" });

    await deleteButton.click();
    await expect(dialogOf(page)).toContainText("Excluir Temporária?");
    await expect(page.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(deleteButton).toBeFocused();

    await deleteButton.click();
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(cards(page)).toHaveCount(total);

    await deleteButton.click();
    await page.getByRole("button", { name: "Excluir categoria" }).dblclick();
    await expect(page.getByRole("button", { name: "Excluindo..." })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Fechar", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    await expect(dialogOf(page)).toHaveCount(1);

    await expect(dialogOf(page)).toHaveCount(0);
    expect(counts.DELETE).toBe(1);
    await expect(cards(page)).toHaveCount(total - 1);
    await expect(page.getByText("Temporária foi excluída do catálogo.")).toBeVisible();
  });

  test("categoria com produtos não oferece exclusão", async ({ page }) => {
    await expect(page.getByText("Em uso · exclusão bloqueada").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Excluir" })).toHaveCount(0);
  });
});
