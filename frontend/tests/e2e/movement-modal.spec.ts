import { expect, test, type Page } from "@playwright/test";

import {
  CLOSE_ACTIONS,
  delayMutations as delayResourceMutations,
  loginAsAdmin,
} from "./support/modal-helpers";

const delayMutations = (page: Page, counts: Record<string, number>) =>
  delayResourceMutations(page, "stock-movements", counts);

const dialogOf = (page: Page) => page.locator("dialog[open]");
const productSelect = (page: Page) => dialogOf(page).locator("select");
const quantityInput = (page: Page) => dialogOf(page).locator('input[type="number"]');
const noteInput = (page: Page) => dialogOf(page).locator("textarea");
const newButton = (page: Page) => page.getByRole("button", { name: "+ Nova movimentação" });

async function openModal(page: Page) {
  await newButton(page).click();
  await expect(dialogOf(page)).toHaveCount(1);
}

async function historyTotal(page: Page): Promise<number> {
  const text = await page.getByText(/registros? no histórico/).innerText();
  return Number(text.match(/^(\d+)/)?.[1]);
}

/** Saldo do produto selecionado, lido da opção do select ("Nome · saldo N"). */
async function selectedBalance(page: Page): Promise<number> {
  const label = await productSelect(page).locator("option:checked").innerText();
  return Number(label.match(/saldo (\d+)/)?.[1]);
}

async function chooseType(page: Page, label: "Entrada" | "Saída" | "Ajuste") {
  await dialogOf(page).locator("label", { hasText: label }).first().click();
}

test.describe("modal de movimentação", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, "Movimentações");
    await expect(page.locator("ol.divide-y > li").first()).toBeVisible();
  });

  test("abre em modal, com foco no produto e nada no topo da lista", async ({ page }) => {
    await openModal(page);

    await expect(page.locator("dialog[open] form")).toHaveCount(1);
    await expect(page.locator("form:not(dialog form)")).toHaveCount(0);
    await expect(productSelect(page)).toBeFocused();
    await expect(page.getByRole("button", { name: "Fechar formulário" })).toHaveCount(0);
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

      const overflow = await dialogOf(page).evaluate((dialog) => {
        const content = dialog.querySelector("div") as HTMLElement;
        const box = dialog.getBoundingClientRect();
        const outside = [...dialog.querySelectorAll("select, input, textarea, button")].filter(
          (element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.left < box.left - 1 || rect.right > box.right + 1);
          },
        );
        return { horizontal: content.scrollWidth > content.clientWidth + 1, outside: outside.length };
      });

      expect(overflow, `largura ${width}`).toEqual({ horizontal: false, outside: 0 });
      await page.keyboard.press("Escape");
      await expect(dialogOf(page)).toHaveCount(0);
    }
  });

  for (const [name, close] of CLOSE_ACTIONS) {
    test(`fechar por ${name} descarta o rascunho e devolve o foco`, async ({ page }) => {
      const total = await historyTotal(page);

      await openModal(page);
      await chooseType(page, "Saída");
      await quantityInput(page).fill("3");
      await noteInput(page).fill("RASCUNHO NÃO SALVO");
      await close(page);

      await expect(dialogOf(page)).toHaveCount(0);
      await expect(newButton(page)).toBeFocused();
      expect(await historyTotal(page)).toBe(total);

      await openModal(page);
      await expect(dialogOf(page).getByRole("radio", { name: /Entrada/ })).toBeChecked();
      await expect(quantityInput(page)).toHaveValue("1");
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
    const initialBalance = await selectedBalance(page);
    await quantityInput(page).fill("2");
    const submit = dialogOf(page).getByRole("button", { name: /Registrar movimentação|Registrando/ });
    for (let i = 0; i < 15; i += 1) {
      await submit.click({ force: true, noWaitAfter: true, timeout: 500 }).catch(() => {});
    }
    await expect(page.getByRole("button", { name: "Fechar", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(3, 3);
    await expect(dialogOf(page)).toHaveCount(1);

    await expect(dialogOf(page)).toHaveCount(0);
    expect(counts.POST).toBe(1);
    await expect(page.getByText(`Entrada registrada. Saldo final: ${initialBalance + 2}.`)).toBeVisible();
    await expect(newButton(page)).toBeFocused();

    await openModal(page);
    await quantityInput(page).fill("2");
    await dialogOf(page)
      .locator("form")
      .evaluate((form: HTMLFormElement) => {
        for (let i = 0; i < 5; i += 1) form.requestSubmit();
      });
    await expect(dialogOf(page)).toHaveCount(0);
    expect(counts.POST).toBe(2);

    await openModal(page);
    await quantityInput(page).fill("2");
    await quantityInput(page).focus();
    for (let i = 0; i < 8; i += 1) await page.keyboard.press("Enter");
    await expect(dialogOf(page)).toHaveCount(0);
    expect(counts.POST).toBe(3);

    await openModal(page);
    expect(await selectedBalance(page)).toBe(initialBalance + 6);
    await page.keyboard.press("Escape");
    await expect(page.getByText(/registros? no histórico/)).toHaveText(`${total + 3} registros no histórico`);
  });

  test("ajuste define o saldo absoluto", async ({ page }) => {
    await openModal(page);
    await chooseType(page, "Ajuste");
    await expect(quantityInput(page)).toHaveValue(String(await selectedBalance(page)));
    await quantityInput(page).fill("7");
    await dialogOf(page).getByRole("button", { name: "Registrar movimentação" }).click();

    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page.getByText("Ajuste registrado. Saldo final: 7.")).toBeVisible();
  });

  test("saída acima do saldo é barrada no formulário e nada é enviado", async ({ page }) => {
    const counts: Record<string, number> = {};
    await delayMutations(page, counts);

    await openModal(page);
    await chooseType(page, "Saída");
    await quantityInput(page).fill(String((await selectedBalance(page)) + 1));

    await expect(dialogOf(page).getByRole("alert")).toContainText("A saída supera o saldo disponível");
    await expect(dialogOf(page).getByRole("button", { name: "Registrar movimentação" })).toBeDisabled();
    await dialogOf(page).locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.waitForTimeout(500);
    expect(counts.POST ?? 0).toBe(0);
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
    await quantityInput(page).fill("2");
    await dialogOf(page).getByRole("button", { name: "Registrar movimentação" }).click();

    await expect(dialogOf(page).getByRole("alert")).toContainText("Saldo insuficiente");
    await expect(dialogOf(page)).toHaveCount(1);
    await expect(dialogOf(page).getByRole("button", { name: "Registrar movimentação" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Fechar", exact: true })).toBeEnabled();

    await dialogOf(page).getByRole("button", { name: "Registrar movimentação" }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(page.getByText(/Entrada registrada\. Saldo final: \d+\./)).toBeVisible();

    await openModal(page);
    await expect(dialogOf(page).getByRole("alert")).toHaveCount(0);
  });
});
