import { expect, test, type Page } from "@playwright/test";

import {
  CLOSE_ACTIONS,
  delayMutations as delayResourceMutations,
  dialogOf,
  expectFormsOnlyInModal,
  expectNoModal,
  hammer,
  loginAsAdmin,
  pickOption,
  requestSubmitMany,
} from "./support/modal-helpers";

const delayMutations = (page: Page, counts: Record<string, number>) =>
  delayResourceMutations(page, "products", counts);

const rows = (page: Page) => page.locator("table tbody tr");
const nameOf = (page: Page, index = 0) => rows(page).nth(index).locator("td").first().locator("p").first();
const skuOf = (page: Page, index = 0) => rows(page).nth(index).locator("td").first().locator("p.sku");
const editButton = (page: Page, index = 0) => rows(page).nth(index).getByRole("button", { name: /^Editar / });
const deleteButton = (page: Page, index = 0) => rows(page).nth(index).getByRole("button", { name: /^Excluir / });
const newButton = (page: Page) => page.getByRole("button", { name: "Novo produto" });

async function openCreateModal(page: Page) {
  await newButton(page).click();
  await expect(dialogOf(page)).toHaveCount(1);
}

async function fillNewProduct(page: Page, product: { name: string; price: string; sku: string }) {
  const dialog = dialogOf(page);
  await dialog.getByLabel("Nome").fill(product.name);
  await dialog.getByLabel("SKU").fill(product.sku);
  await pickOption(page, dialog.getByRole("combobox", { name: "Categoria" }), "Fixação");
  await dialog.getByLabel("Preço unitário").fill(product.price);
  await dialog.getByLabel("Limite de estoque baixo").fill("5");
}

test.describe("modais de produto", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, "/produtos");
    await expect(rows(page).first()).toBeVisible();
  });

  test("editar abre em modal, com foco no nome e nada fora dele", async ({ page }) => {
    await editButton(page).click();

    await expectFormsOnlyInModal(page);
    await expect(dialogOf(page).getByLabel("Nome")).toBeFocused();
    await expect(dialogOf(page)).toContainText("Editar produto");
  });

  test("em tela baixa o foco inicial continua no primeiro campo", async ({ page }) => {
    await page.setViewportSize({ height: 480, width: 390 });
    await page.getByRole("button", { name: /^Editar / }).first().click();

    await expect(dialogOf(page).getByLabel("Nome")).toBeFocused();
  });

  for (const [name, close] of CLOSE_ACTIONS) {
    test(`fechar por ${name} descarta o rascunho e devolve o foco`, async ({ page }) => {
      const originalName = (await nameOf(page).innerText()).trim();

      await editButton(page).click();
      await dialogOf(page).getByLabel("Nome").fill("RASCUNHO NÃO SALVO");
      await close(page);

      await expectNoModal(page);
      await expect(editButton(page)).toBeFocused();
      await expect(nameOf(page)).toHaveText(originalName);

      await editButton(page).click();
      await expect(dialogOf(page).getByLabel("Nome")).toHaveValue(originalName);
    });
  }

  test("selecionar texto e soltar o mouse fora não fecha o modal", async ({ page }) => {
    await editButton(page).click();
    const box = await dialogOf(page).getByLabel("Nome").boundingBox();
    if (!box) throw new Error("campo Nome sem caixa de layout");

    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(3, 3);
    await page.mouse.up();

    await expect(dialogOf(page)).toHaveCount(1);
  });

  test("duplo clique em Salvar envia uma só requisição e o modal não fecha em andamento", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    await editButton(page).click();
    await dialogOf(page).getByLabel("Nome").fill("Produto Editado");
    await dialogOf(page).getByRole("button", { name: "Salvar alterações" }).dblclick();

    await expect(dialogOf(page).getByRole("button", { name: "Salvando…" })).toBeDisabled();
    await expect(dialogOf(page).getByRole("button", { name: "Fechar", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    await expect(dialogOf(page)).toHaveCount(1);

    await expectNoModal(page);
    expect(counts.PUT).toBe(1);
    await expect(rows(page).filter({ hasText: "Produto Editado" })).toHaveCount(1);
    await expect(page.getByText("Produto atualizado")).toBeVisible();
  });

  test("salvar não reenvia com muitos cliques, Enter repetido ou envios no mesmo instante", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    const editFirstRow = async (name: string) => {
      await editButton(page).click();
      await dialogOf(page).getByLabel("Nome").fill(name);
    };

    await editFirstRow("Envio A");
    await hammer(dialogOf(page).getByRole("button", { name: /Salvar alterações|Salvando/ }));
    await expectNoModal(page);
    expect(counts.PUT).toBe(1);

    await editFirstRow("Envio B");
    await requestSubmitMany(dialogOf(page));
    await expectNoModal(page);
    expect(counts.PUT).toBe(2);

    await editFirstRow("Envio C");
    await dialogOf(page).getByLabel("Nome").focus();
    for (let i = 0; i < 8; i += 1) await page.keyboard.press("Enter");
    await expectNoModal(page);
    expect(counts.PUT).toBe(3);
  });

  test("erro da API mantém o modal aberto, aponta o campo e some ao reabrir", async ({ page }) => {
    const otherSku = (await skuOf(page, 1).innerText()).trim();

    await editButton(page).click();
    await dialogOf(page).getByLabel("SKU").fill(otherSku);
    await dialogOf(page).getByRole("button", { name: "Salvar alterações" }).click();

    await expect(dialogOf(page).getByRole("alert")).toContainText("Já existe um produto com este SKU");
    await expect(dialogOf(page).getByLabel("SKU")).toBeFocused();
    await expect(dialogOf(page).getByRole("button", { name: "Salvar alterações" })).toBeEnabled();

    await dialogOf(page).getByRole("button", { name: "Fechar", exact: true }).click();
    await expectNoModal(page);
    await editButton(page).click();
    await expect(dialogOf(page).getByRole("alert")).toHaveCount(0);
  });

  test("excluir: cancelar e X preservam o produto; exige confirmação e duplo clique exclui uma vez", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    const name = (await nameOf(page).innerText()).trim();
    const total = await rows(page).count();

    await deleteButton(page).click();
    await expect(dialogOf(page)).toContainText(`Excluir ${name}?`);
    await expect(dialogOf(page).getByRole("checkbox")).toBeFocused();
    await dialogOf(page).getByRole("button", { name: "Cancelar" }).click();
    await expectNoModal(page);
    await expect(deleteButton(page)).toBeFocused();

    await deleteButton(page).click();
    await dialogOf(page).getByRole("button", { name: "Fechar", exact: true }).click();
    await expectNoModal(page);
    await expect(rows(page)).toHaveCount(total);

    await deleteButton(page).click();
    const confirm = dialogOf(page).getByRole("button", { name: "Excluir produto e histórico" });
    await expect(confirm).toBeDisabled();
    await dialogOf(page).getByRole("checkbox").check();
    await confirm.dblclick();
    await expect(dialogOf(page).getByRole("button", { name: "Excluindo…" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialogOf(page)).toHaveCount(1);

    await expectNoModal(page);
    expect(counts.DELETE).toBe(1);
    await expect(rows(page)).toHaveCount(total - 1);
    await expect(page.getByText("Produto excluído")).toBeVisible();
  });

  test("cadastrar abre em modal, com foco no nome e nada fora dele", async ({ page }) => {
    await openCreateModal(page);

    await expectFormsOnlyInModal(page);
    await expect(dialogOf(page).getByLabel("Nome")).toBeFocused();
  });

  for (const [name, close] of CLOSE_ACTIONS) {
    test(`cadastro: fechar por ${name} descarta o rascunho e devolve o foco`, async ({ page }) => {
      const total = await rows(page).count();

      await openCreateModal(page);
      await fillNewProduct(page, { name: "Rascunho", price: "9,90", sku: "RASC-1" });
      await close(page);

      await expectNoModal(page);
      await expect(newButton(page)).toBeFocused();
      await expect(rows(page)).toHaveCount(total);

      await openCreateModal(page);
      await expect(dialogOf(page).getByLabel("Nome")).toHaveValue("");
      await expect(dialogOf(page).getByLabel("SKU")).toHaveValue("");
    });
  }

  test("cadastro: muitos cliques, envios simultâneos e Enter repetido criam um só produto", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);
    const total = await rows(page).count();

    await openCreateModal(page);
    await fillNewProduct(page, { name: "Produto Novo A", price: "12,50", sku: "NOVO-A" });
    const submit = dialogOf(page).getByRole("button", { name: /Cadastrar produto|Salvando/ });
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
    await expect(page.getByText("Produto cadastrado")).toBeVisible();
    await expect(newButton(page)).toBeFocused();

    await openCreateModal(page);
    await fillNewProduct(page, { name: "Produto Novo B", price: "3,00", sku: "NOVO-B" });
    await requestSubmitMany(dialogOf(page));
    await expectNoModal(page);
    expect(counts.POST).toBe(2);

    await openCreateModal(page);
    await fillNewProduct(page, { name: "Produto Novo C", price: "4,00", sku: "NOVO-C" });
    await dialogOf(page).getByLabel("Nome").focus();
    for (let i = 0; i < 8; i += 1) await page.keyboard.press("Enter");
    await expectNoModal(page);
    expect(counts.POST).toBe(3);
    await expect(rows(page)).toHaveCount(total + 3);
  });

  test("cadastro: SKU duplicado mantém o modal aberto, permite corrigir e o erro some ao reabrir", async ({
    page,
  }) => {
    const existingSku = (await skuOf(page).innerText()).trim();
    const total = await rows(page).count();

    await openCreateModal(page);
    await fillNewProduct(page, { name: "Produto Duplicado", price: "5,00", sku: existingSku });
    await dialogOf(page).getByRole("button", { name: "Cadastrar produto" }).click();

    await expect(dialogOf(page).getByRole("alert")).toContainText("Já existe um produto com este SKU");
    await expect(dialogOf(page)).toHaveCount(1);
    await expect(rows(page)).toHaveCount(total);
    await expect(dialogOf(page).getByRole("button", { name: "Cadastrar produto" })).toBeEnabled();

    await dialogOf(page).getByLabel("SKU").fill("SKU-CORRIGIDO");
    await dialogOf(page).getByRole("button", { name: "Cadastrar produto" }).click();
    await expectNoModal(page);
    await expect(rows(page)).toHaveCount(total + 1);

    await openCreateModal(page);
    await expect(dialogOf(page).getByRole("alert")).toHaveCount(0);
  });
});
