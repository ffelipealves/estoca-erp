/**
 * Grava GIFs curtos das funcionalidades que um print estático não mostra.
 *
 *   npm run demos
 *   BASE_URL=http://localhost:3000 npm run demos
 *
 * O Playwright grava a interação em vídeo e o ffmpeg converte para GIF, que é o
 * único formato que o GitHub anima inline a partir de um arquivo do próprio
 * repositório — um .mp4 commitado e referenciado com sintaxe de imagem não toca.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { chromium } from "@playwright/test";

const run = promisify(execFile);

const BASE_URL = process.env.BASE_URL ?? "https://estoca-erp.vercel.app";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(ROOT, "docs", "demos");
const VIEWPORT = { height: 750, width: 1200 };
const DEMO_PASSWORD = "demo123";

const GIF_WIDTH = 900;
const GIF_FPS = 12;

async function toGif(webmPath, name, startAt) {
  const gifPath = join(OUT_DIR, `${name}.gif`);
  const filters = [
    `fps=${GIF_FPS}`,
    `scale=${GIF_WIDTH}:-1:flags=lanczos`,
    "split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
  ].join(",");

  await run("ffmpeg", [
    "-y",
    "-loglevel", "error",
    "-i", webmPath,
    // `-ss` DEPOIS de `-i`: antes seria busca por keyframe, imprecisa no webm de
    // taxa variável que o Playwright grava, e a abertura da sessão sobrava.
    "-ss", String(Math.max(startAt, 0)),
    "-vf", filters,
    "-loop", "0",
    gifPath,
  ]);
  return gifPath;
}

async function login(page, email) {
  await page.waitForSelector("#email", { timeout: 180_000 });
  await page.fill("#email", email);
  await page.fill("#password", DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await page.waitForSelector("header", { timeout: 60_000 });
}

async function goToSection(page, label) {
  await page
    .locator('nav[aria-label="Navegação principal"] button', { hasText: label })
    .first()
    .click();
  await page.waitForTimeout(1200);
}

/**
 * Roda um roteiro num contexto próprio e devolve o GIF.
 *
 * `readyAt` marca quanto tempo passou até a aplicação aparecer, para o ffmpeg
 * descartar exatamente esse trecho — o cold start do Render varia demais para
 * um corte fixo.
 */
async function record(browser, { email, name, script }) {
  const videoDir = await mkdtemp(join(tmpdir(), "estoca-demo-"));
  const context = await browser.newContext({
    locale: "pt-BR",
    recordVideo: { dir: videoDir, size: VIEWPORT },
    viewport: VIEWPORT,
  });
  const page = await context.newPage();
  const startedAt = Date.now();

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await login(page, email);
  await page.waitForTimeout(400);

  // O roteiro decide onde a demonstração começa: o login e a navegação até a
  // tela certa não interessam, e o cold start do Render varia demais para um
  // corte fixo.
  let readyAt = (Date.now() - startedAt) / 1000;
  const markStart = () => {
    readyAt = (Date.now() - startedAt) / 1000;
  };

  await script(page, markStart);
  await page.waitForTimeout(900);

  const video = page.video();
  await context.close();
  const webmPath = await video.path();

  const gifPath = await toGif(webmPath, name, readyAt);
  await rm(videoDir, { force: true, recursive: true });
  console.log(`  ✓ ${name}.gif`);
  return gifPath;
}

const DEMOS = [
  {
    email: "admin@estoca.demo",
    name: "catalogo-ordenacao-e-filtros",
    async script(page, markStart) {
      await goToSection(page, "Produtos");
      markStart();
      await page.waitForTimeout(1200);
      const header = (label) =>
        page.locator("button", { hasText: new RegExp(`^${label}$`) }).first();

      await header("Preço").click();
      await page.waitForTimeout(1100);
      await header("Preço").click();
      await page.waitForTimeout(1100);
      await header("Saldo").click();
      await page.waitForTimeout(1300);

      await page.selectOption("select", { label: "Eletrônicos" });
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: /abaixo do mínimo/i }).click();
      await page.waitForTimeout(1600);
      await page.getByRole("button", { name: /limpar filtros/i }).click();
      await page.waitForTimeout(1200);
    },
  },
  {
    email: "admin@estoca.demo",
    name: "registrar-ajuste-de-estoque",
    async script(page, markStart) {
      await goToSection(page, "Movimentações");
      markStart();
      await page.getByRole("button", { name: "+ Nova movimentação" }).click();
      await page.waitForTimeout(1000);

      // O ajuste é a regra menos óbvia: o número digitado vira o saldo.
      await page.locator("label", { hasText: "Ajuste" }).first().click();
      await page.waitForTimeout(1200);
      await page.locator('input[type="number"]').first().fill("42");
      await page.waitForTimeout(1800);

      await page.getByRole("button", { name: "Registrar movimentação" }).click();
      // Espera o aviso de sucesso, não um texto exato: o Render pode responder
      // devagar depois de hibernar.
      await page
        .locator('[role="status"]', { hasText: /registrad/i })
        .first()
        .waitFor({ timeout: 90_000 });
      await page.waitForTimeout(1600);
    },
  },
  {
    email: "operador@estoca.demo",
    name: "operador-sem-permissao",
    async script(page, markStart) {
      await goToSection(page, "Produtos");
      await page.waitForTimeout(900);
      markStart();
      await page
        .locator('button[aria-disabled="true"]', { hasText: "Editar" })
        .first()
        .click({ force: true });
      await page.waitForTimeout(2200);
      await page
        .getByRole("button", { name: /novo produto/i })
        .click({ force: true });
      await page.waitForTimeout(2000);
    },
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  // O Chromium formata `<input type="date">` pelo idioma da aplicação, não pelo
  // `locale` do contexto — daí o argumento e a variável de ambiente.
  const browser = await chromium.launch({
    args: ["--lang=pt-BR"],
    env: { ...process.env, LANG: "pt_BR.UTF-8", LANGUAGE: "pt_BR:pt" },
  });
  console.log(`Gravando de ${BASE_URL}`);

  for (const demo of DEMOS) {
    await record(browser, demo);
  }

  await browser.close();
  console.log(`\n${DEMOS.length} GIFs em docs/demos/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
