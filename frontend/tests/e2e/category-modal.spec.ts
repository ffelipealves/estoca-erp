import { expect, test, type Page } from "@playwright/test";

import {
  CLOSE_ACTIONS,
  delayMutations as delayResourceMutations,
  dialogOf,
  expectFormsOnlyInModal,
  expectNoModal,
  hammer,
  loginAsAdmin,
  requestSubmitMany,
} from "./support/modal-helpers";

const delayMutations = (page: Page, counts: Record<string, number>) =>
  delayResourceMutations(page, "categories", counts);

const rows = (page: Page) => page.locator("main ul.divide-y > li");
const rowNamed = (page: Page, name: string) =>
  rows(page).filter({ has: page.getByRole("heading", { name, exact: true }) });
const newButton = (page: Page) => page.getByRole("button", { name: "Nova categoria" });
const nameInput = (page: Page) => dialogOf(page).getByLabel("Nome");

async function openCreateModal(page: Page) {
  await newButton(page).click();
  await expect(dialogOf(page)).toHaveCount(1);
}

async function createCategory(page: Page, name: string) {
  await openCreateModal(page);
  await nameInput(page).fill(name);
  await dialogOf(page).getByRole("button", { name: "Criar categoria" }).click();
  await expectNoModal(page);
  await expect(rowNamed(page, name)).toHaveCount(1);
}

test.describe("modais de categoria", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, "/categorias");
    await expect(rows(page).first()).toBeVisible();
  });

  test("cadastrar abre em modal, com foco no nome e nada fora dele", async ({ page }) => {
    await openCreateModal(page);

    await expectFormsOnlyInModal(page);
    await expect(nameInput(page)).toBeFocused();
  });

  for (const [name, close] of CLOSE_ACTIONS) {
    test(`cadastro: fechar por ${name} descarta o rascunho e devolve o foco`, async ({ page }) => {
      const total = await rows(page).count();

      await openCreateModal(page);
      await nameInput(page).fill("Rascunho");
      await dialogOf(page).getByLabel("Descrição").fill("Rascunho da descrição");
      await close(page);

      await expectNoModal(page);
      await expect(newButton(page)).toBeFocused();
      await expect(rows(page)).toHaveCount(total);

      await openCreateModal(page);
      await expect(nameInput(page)).toHaveValue("");
      await expect(dialogOf(page).getByLabel("Descrição")).toHaveValue("");
    });

    test(`edição: fechar por ${name} descarta o rascunho e devolve o foco`, async ({ page }) => {
      const row = rows(page).first();
      const originalName = (await row.getByRole("heading").innerText()).trim();
      const editButton = row.getByRole("button", { name: "Editar" });

      await editButton.click();
      await nameInput(page).fill("RASCUNHO NÃO SALVO");
      await close(page);

      await expectNoModal(page);
      await expect(editButton).toBeFocused();
      await expect(row.getByRole("heading")).toHaveText(originalName);

      await editButton.click();
      await expect(nameInput(page)).toHaveValue(originalName);
    });
  }

  test("editar abre em modal com nome e descrição atuais e o foco no nome", async ({ page }) => {
    const row = rows(page).first();
    const originalName = (await row.getByRole("heading").innerText()).trim();

    await row.getByRole("button", { name: "Editar" }).click();

    await expectFormsOnlyInModal(page);
    await expect(nameInput(page)).toHaveValue(originalName);
    await expect(dialogOf(page).getByLabel("Descrição")).not.toHaveValue("");
    await expect(nameInput(page)).toBeFocused();
    await expect(dialogOf(page)).toContainText("Editar categoria");
  });

  test("selecionar texto e soltar o mouse fora não fecha o modal", async ({ page }) => {
    await openCreateModal(page);
    const box = await nameInput(page).boundingBox();
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
    const total = await rows(page).count();

    await openCreateModal(page);
    await nameInput(page).fill("Categoria A");
    const submit = dialogOf(page).getByRole("button", { name: /Criar categoria|Salvando/ });
    await submit.click();
    await expect(dialogOf(page).getByRole("button", { name: "Fechar", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    await expect(dialogOf(page)).toHaveCount(1);
    // Insiste durante o envio e durante a saída do modal.
    await hammer(submit);

    await expectNoModal(page);
    expect(counts.POST).toBe(1);
    await expect(rows(page)).toHaveCount(total + 1);
    await expect(page.getByText("Categoria criada")).toBeVisible();
    await expect(newButton(page)).toBeFocused();

    await openCreateModal(page);
    await nameInput(page).fill("Categoria B");
    await requestSubmitMany(dialogOf(page));
    await expectNoModal(page);
    expect(counts.POST).toBe(2);

    await openCreateModal(page);
    await nameInput(page).fill("Categoria C");
    for (let i = 0; i < 8; i += 1) await page.keyboard.press("Enter");
    await expectNoModal(page);
    expect(counts.POST).toBe(3);
    await expect(rows(page)).toHaveCount(total + 3);
  });

  test("edição: muitos cliques e envios simultâneos salvam uma só vez e atualizam a lista", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    await rows(page).first().getByRole("button", { name: "Editar" }).click();
    await nameInput(page).fill("Renomeada A");
    await hammer(dialogOf(page).getByRole("button", { name: /Salvar alterações|Salvando/ }));
    await expectNoModal(page);
    expect(counts.PUT).toBe(1);
    await expect(rowNamed(page, "Renomeada A")).toHaveCount(1);
    await expect(page.getByText("Categoria atualizada")).toBeVisible();

    await rowNamed(page, "Renomeada A").getByRole("button", { name: "Editar" }).click();
    await nameInput(page).fill("Renomeada B");
    await requestSubmitMany(dialogOf(page));
    await expectNoModal(page);
    expect(counts.PUT).toBe(2);
    await expect(rowNamed(page, "Renomeada B")).toHaveCount(1);
  });

  test("nome duplicado mantém o modal aberto, permite corrigir e o erro some ao reabrir", async ({
    page,
  }) => {
    const existingName = (await rows(page).first().getByRole("heading").innerText()).trim();
    const total = await rows(page).count();

    await openCreateModal(page);
    await nameInput(page).fill(existingName);
    await dialogOf(page).getByRole("button", { name: "Criar categoria" }).click();

    await expect(dialogOf(page).getByRole("alert")).toContainText("Já existe uma categoria com este nome");
    await expect(nameInput(page)).toBeFocused();
    await expect(rows(page)).toHaveCount(total);
    await expect(dialogOf(page).getByRole("button", { name: "Criar categoria" })).toBeEnabled();

    await nameInput(page).fill("Nome Corrigido");
    await dialogOf(page).getByRole("button", { name: "Criar categoria" }).click();
    await expectNoModal(page);
    await expect(rows(page)).toHaveCount(total + 1);

    await openCreateModal(page);
    await expect(dialogOf(page).getByRole("alert")).toHaveCount(0);
  });

  test("excluir: foco em Cancelar, X e Cancelar preservam a categoria e duplo clique exclui uma vez", async ({
    page,
  }) => {
    await createCategory(page, "Temporária");
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    const total = await rows(page).count();
    const deleteButton = rowNamed(page, "Temporária").getByRole("button", { name: "Excluir" });

    await deleteButton.click();
    await expect(dialogOf(page)).toContainText("Excluir Temporária?");
    await expect(dialogOf(page).getByRole("button", { name: "Cancelar" })).toBeFocused();
    await dialogOf(page).getByRole("button", { name: "Cancelar" }).click();
    await expectNoModal(page);
    await expect(deleteButton).toBeFocused();

    await deleteButton.click();
    await dialogOf(page).getByRole("button", { name: "Fechar", exact: true }).click();
    await expectNoModal(page);
    await expect(rows(page)).toHaveCount(total);

    await deleteButton.click();
    await dialogOf(page).getByRole("button", { name: "Excluir categoria" }).dblclick();
    await expect(dialogOf(page).getByRole("button", { name: "Excluindo…" })).toBeDisabled();
    await expect(dialogOf(page).getByRole("button", { name: "Fechar", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    await expect(dialogOf(page)).toHaveCount(1);

    await expectNoModal(page);
    expect(counts.DELETE).toBe(1);
    await expect(rows(page)).toHaveCount(total - 1);
    await expect(page.getByText("Categoria excluída")).toBeVisible();
  });

  test("categoria com produtos não oferece exclusão e explica como liberar", async ({ page }) => {
    const row = rows(page).first();
    const name = (await row.getByRole("heading").innerText()).trim();

    await row.getByRole("button", { name: "Excluir" }).click();

    await expect(dialogOf(page)).toContainText(`${name} ainda tem produtos`);
    await expect(dialogOf(page).getByRole("button", { name: "Excluir categoria" })).toHaveCount(0);
    await dialogOf(page).getByRole("link", { name: "Ver produtos da categoria" }).click();
    await expect(page).toHaveURL(/\/produtos\?categoria=/);
    await expect(page.locator("table tbody tr")).toHaveCount(4);
  });
});
