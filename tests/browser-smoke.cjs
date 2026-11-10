// Smoke test real em Chromium, sem dados de clientes ou autenticação administrativa.
// Executado no CI em Next.js local, em vez de acessar a produção.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const base = process.env.BROWSER_BASE_URL || "http://127.0.0.1:3100";
const snapshots = path.resolve(process.cwd(), "artifacts/browser-smoke");
fs.mkdirSync(snapshots, { recursive: true });

async function ensureNoHorizontalOverflow(page, location, viewport) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 2,
    `${location} ${viewport}: overflow horizontal (${JSON.stringify(metrics)})`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const cases = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "iphone", width: 390, height: 844 },
    { name: "small-mobile", width: 320, height: 700 },
  ];
  try {
    for (const device of cases) {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        reducedMotion: "reduce", deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", err => errors.push(err.message));
      try {
        const home = await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
        assert.equal(home.status(), 200, "Landing deve responder HTTP 200");
        assert.ok(await page.getByRole("heading", { level: 1 }).count(), "Título principal da home ausente");
        const homeTheme = await page.evaluate(() => ({
          theme: document.documentElement.dataset.theme,
          surface: getComputedStyle(document.querySelector(".home-presentation-card")).backgroundColor,
          heading: getComputedStyle(document.querySelector(".enterprise-hero h1")).color,
        }));
        assert.equal(homeTheme.theme, "light", "Novo visitante deve ver tema claro");
        assert.equal(homeTheme.surface, "rgb(255, 255, 255)", "Vitrine deve usar painel branco empresarial");
        assert.equal(homeTheme.heading, "rgb(25, 37, 54)", "Título público deve usar a cor da identidade ERP");
        await ensureNoHorizontalOverflow(page, "Home", device.name);
        await page.screenshot({ path: path.join(snapshots, device.name + "-home.png"),
          fullPage: true });

        const login = await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 30000 });
        assert.equal(login.status(), 200, "Login deve responder HTTP 200");
        assert.ok(await page.getByRole("heading", { name: /Entre no seu ambiente/i }).isVisible());
        const forms = page.locator("form");
        assert.equal(await forms.count(), 2, "Entradas de cliente e administração devem estar separadas");
        assert.ok(await page.getByRole("button", { name: /Entrar como cliente/i }).isVisible());
        assert.ok(await page.getByRole("button", { name: /Entrar como administrador/i }).isVisible());
        assert.equal(await page.locator('input[type="email"]').count(), 2);
        assert.equal(await page.locator('input[type="password"]').count(), 2);
        for (const input of await page.locator('input[type="email"]').all()) {
          await input.fill("qa@example.invalid");
          assert.equal(await input.inputValue(), "qa@example.invalid");
        }
        const loginColors = await page.evaluate(() => ({
          panel: getComputedStyle(document.querySelector(".login-form-card")).backgroundColor,
          input: getComputedStyle(document.querySelector(".embedded-login-form .input")).backgroundColor,
        }));
        assert.equal(loginColors.panel, "rgb(255, 255, 255)", "Login deve usar os mesmos painéis do ERP");
        assert.equal(loginColors.input, "rgb(255, 255, 255)", "Formulário deve manter campos legíveis");
        await ensureNoHorizontalOverflow(page, "Login", device.name);
        await page.screenshot({ path: path.join(snapshots, device.name + "-login.png"),
          fullPage: true });

        assert.deepEqual(errors, [], "Erros de renderização JS nas páginas públicas");
        process.stdout.write("OK Chromium " + device.name + " (home e login sem overflow)\n");
      } finally {
        await context.close();
      }
    }
  } finally { await browser.close(); }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
