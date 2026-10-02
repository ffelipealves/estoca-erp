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
  delayResourceMutations(page, "stock-movements", counts);

const productSelect = (page: Page) => dialogOf(page).getByRole("combobox", { name: "Produto" });
const quantityInput = (page: Page) => dialogOf(page).locator("#mov-qty");
const noteInput = (page: Page) => dialogOf(page).getByLabel("Observação");
// "Registrar movimentação" no desktop, "Movimentar" no celular.
const openButton = (page: Page) =>
  page.getByRole("button", { name: /^(Registrar movimentação|Movimentar)/ });

async function openModal(page: Page) {
  await openButton(page).click();
  await expect(dialogOf(page)).toHaveCount(1);
}

async function chooseProduct(page: Page, name: string | RegExp) {
  await pickOption(page, productSelect(page), name);
}

async function chooseType(page: Page, label: "Entrada" | "Saída" | "Ajuste") {
  await dialogOf(page).getByRole("radio", { name: label }).check({ force: true });
}

async function historyTotal(page: Page): Promise<number> {
  const text = await page.locator('p[aria-live="polite"]').filter({ hasText: /movimentaç/ }).innerText();
  return Number(text.match(/^(\d+)/)?.[1]);
}

/** Saldo atual do produto escolhido, lido do visor do modal. */
async function readoutBalance(page: Page): Promise<number> {
  const text = await dialogOf(page).locator("#mov-readout p.readout").first().innerText();
  return Number(text.replace(/\D/g, ""));
}

test.describe("modal de movimentação", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, "/movimentacoes");
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("abre em modal, com foco no produto e nada fora dele", async ({ page }) => {
    await openModal(page);

    await expectFormsOnlyInModal(page);
    await expect(productSelect(page)).toBeFocused();
  });

  test("a tecla M abre o modal de qualquer área", async ({ page }) => {
    await page.locator("main h1").click();
    await page.keyboard.press("m");

    await expect(dialogOf(page)).toContainText("Registrar movimentação");
    await expect(productSelect(page)).toBeFocused();
  });

  test("em tela baixa o foco inicial continua no produto", async ({ page }) => {
    await page.setViewportSize({ height: 480, width: 390 });
    await openModal(page);

    await expect(productSelect(page)).toBeFocused();
  });

  test("o formulário cabe no modal sem rolagem horizontal", async ({ page }) => {
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ height: 900, width });
      await openModal(page);
      await chooseProduct(page, /Alicate universal/);
      await chooseType(page, "Ajuste");

      const overflow = await dialogOf(page).evaluate((dialog) => {
        const body = dialog.querySelector('[data-slot="dialog-body"]') as HTMLElement;
        const box = dialog.getBoundingClientRect();
        const outside = [...dialog.querySelectorAll("button, input, textarea, [role=combobox]")].filter(
          (element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.left < box.left - 1 || rect.right > box.right + 1);
          },
        );
        return { horizontal: body.scrollWidth > body.clientWidth + 1, outside: outside.length };
      });

      expect(overflow, `largura ${width}`).toEqual({ horizontal: false, outside: 0 });
      await page.keyboard.press("Escape");
      await expectNoModal(page);
    }
  });

  for (const [name, close] of CLOSE_ACTIONS) {
    test(`fechar por ${name} descarta o rascunho e devolve o foco`, async ({ page }) => {
      const total = await historyTotal(page);

      await openModal(page);
      await chooseProduct(page, /Alicate universal/);
      await chooseType(page, "Saída");
      await quantityInput(page).fill("3");
      await noteInput(page).fill("RASCUNHO NÃO SALVO");
      await close(page);

      await expectNoModal(page);
      await expect(openButton(page)).toBeFocused();
      expect(await historyTotal(page)).toBe(total);

      await openModal(page);
      await expect(productSelect(page)).toContainText("Escolha o produto");
      await expect(dialogOf(page).getByRole("radio", { name: "Entrada" })).toBeChecked();
      await expect(quantityInput(page)).toHaveValue("");
      await expect(noteInput(page)).toHaveValue("");
    });
  }

  test("selecionar texto e soltar o mouse fora não fecha o modal", async ({ page }) => {
    await openModal(page);
    const box = await noteInput(page).boundingBox();
    if (!box) throw new Error("campo Observação sem caixa de layout");

    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(3, 3);
    await page.mouse.up();

    await expect(dialogOf(page)).toHaveCount(1);
  });

  test("cliques repetidos, envios simultâneos e Enter repetido registram uma só entrada cada", async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);
    const total = await historyTotal(page);

    await openModal(page);
    await chooseProduct(page, /Arruela lisa/);
    const initialBalance = await readoutBalance(page);
    await quantityInput(page).fill("2");
    const submit = dialogOf(page).getByRole("button", { name: /Confirmar entrada|Registrando/ });
    await submit.click();
    await expect(dialogOf(page).getByRole("button", { name: "Fechar", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    await expect(dialogOf(page)).toHaveCount(1);
    // Insiste durante o envio e durante a saída do modal.
    await hammer(submit);

    await expectNoModal(page);
    expect(counts.POST).toBe(1);
    const newest = page.locator("table tbody tr").first();
    await expect(newest).toContainText("Arruela lisa");
    await expect(newest).toContainText(String(initialBalance + 2));
    await expect(openButton(page)).toBeFocused();

    await openModal(page);
    await chooseProduct(page, /Arruela lisa/);
    await quantityInput(page).fill("2");
    await requestSubmitMany(dialogOf(page));
    await expectNoModal(page);
    expect(counts.POST).toBe(2);

    await openModal(page);
    await chooseProduct(page, /Arruela lisa/);
    await quantityInput(page).fill("2");
    await quantityInput(page).focus();
    for (let i = 0; i < 8; i += 1) await page.keyboard.press("Enter");
    await expectNoModal(page);
    expect(counts.POST).toBe(3);

    await openModal(page);
    await chooseProduct(page, /Arruela lisa/);
    expect(await readoutBalance(page)).toBe(initialBalance + 6);
    await page.keyboard.press("Escape");
    await expect.poll(() => historyTotal(page)).toBe(total + 3);
  });

  test("ajuste define o saldo absoluto e o histórico mostra a diferença", async ({ page }) => {
    await openModal(page);
    await chooseProduct(page, /Alicate universal/);
    const before = await readoutBalance(page);
    await chooseType(page, "Ajuste");
    await quantityInput(page).fill("7");
    await expect(dialogOf(page).locator("#mov-readout")).toContainText(
      `diferença de ${7 - before >= 0 ? "+" : "−"}${Math.abs(7 - before)}`,
    );
    await dialogOf(page).getByRole("button", { name: "Confirmar ajuste" }).click();

    await expectNoModal(page);
    await expect(page.getByText("saldo agora é 7.")).toBeVisible();
    const newest = page.locator("table tbody tr").first();
    await expect(newest).toContainText("=7");
    await expect(newest).toContainText(`era ${before}`);
  });

  test("saída acima do saldo é barrada no formulário e nada é enviado", async ({ page }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    await openModal(page);
    await chooseProduct(page, /Alicate universal/);
    await chooseType(page, "Saída");
    await quantityInput(page).fill(String((await readoutBalance(page)) + 1));
    await quantityInput(page).blur();

    await expect(dialogOf(page).getByRole("alert")).toContainText("Saldo insuficiente");
    const submit = dialogOf(page).getByRole("button", { name: "Confirmar saída" });
    await expect(submit).toHaveAttribute("aria-disabled", "true");
    await submit.click({ force: true });
    await requestSubmitMany(dialogOf(page));
    await page.waitForTimeout(500);
    expect(counts.POST ?? 0).toBe(0);
    await expect(dialogOf(page)).toHaveCount(1);
  });

  test("erro da API (simulado) mantém o modal aberto, permite tentar de novo e some ao reabrir", async ({
    page,
  }) => {
    let fail = true;
    await page.route("**/api/v1/stock-movements", async (route) => {
      if (route.request().method() === "POST" && fail) {
        fail = false;
        await route.fulfill({
          body: JSON.stringify({ code: "business_rule_error", detail: "Saldo insuficiente para esta saída" }),
          contentType: "application/json",
          status: 422,
        });
        return;
      }
      await route.continue();
    });

    await openModal(page);
    await chooseProduct(page, /Arruela lisa/);
    await quantityInput(page).fill("2");
    await dialogOf(page).getByRole("button", { name: "Confirmar entrada" }).click();

    await expect(dialogOf(page).getByRole("alert")).toContainText("Saldo insuficiente");
    await expect(dialogOf(page)).toHaveCount(1);
    await expect(dialogOf(page).getByRole("button", { name: "Confirmar entrada" })).toBeEnabled();
    await expect(dialogOf(page).getByRole("button", { name: "Fechar", exact: true })).toBeEnabled();

    await dialogOf(page).getByRole("button", { name: "Confirmar entrada" }).click();
    await expectNoModal(page);
    await expect(page.getByText("Entrada registrada")).toBeVisible();

    await openModal(page);
    await expect(dialogOf(page).getByRole("alert")).toHaveCount(0);
  });
});
