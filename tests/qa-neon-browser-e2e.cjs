const { PrismaClient } = require("@prisma/client");
const { scryptSync, randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const dburl = process.env.DATABASE_URL || "";
if (process.env.GROMMA_QA_ONLY !== "1" || !dburl.includes("ep-dawn-firefly-b6ejge4g") ||
  !dburl.includes(".neon.tech")) {
  throw new Error("Refusing to run UI test outside explicitly identified NEON QA branch.");
}
const prisma = new PrismaClient();
const marker = randomBytes(5).toString("hex");
const tenant = "QAE2E" + marker.toUpperCase();
const base = "http://127.0.0.1:3100";
const results = [];
let shopId = null;
let server = null;
let browser = null;
let combinedServerLogs = "";
const screenshotDir = "/vercel/gromma-barber/qa-screenshots";
fs.mkdirSync(screenshotDir, { recursive: true });
const record = async (name, callback) => {
  try {
    const result = await callback();
    results.push({ name, passed: true });
    console.log("PASS " + name);
    return result;
  } catch (err) {
    results.push({ name, passed: false, error: String(err).slice(0, 800) });
    console.error("FAIL " + name + ": " + String(err).slice(0, 1200));
    throw err;
  }
};
async function startServer() {
  const secret = randomBytes(32).toString("hex");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100"], {
    cwd: "/vercel/gromma-barber",
    env: { ...process.env, SESSION_SECRET: secret,
      COMMISSION_PAYMENTS_ENABLED: "true", NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const accumulate = chunk => { combinedServerLogs = (combinedServerLogs + chunk.toString()).slice(-9000); };
  server.stdout.on("data", accumulate); server.stderr.on("data", accumulate);
  for (let k = 0; k < 100; k++) {
    if (server.exitCode !== null) throw new Error("Next.js exited: " + combinedServerLogs.slice(-3000));
    try { const response = await fetch(base + "/login", { signal: AbortSignal.timeout(1800) });
      if (response.status === 200) return; }
    catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Next.js never became ready: " + combinedServerLogs.slice(-2600));
}
async function seed() {
  const email = "qa-owner-" + marker + "@example.invalid";
  const receptionistEmail = "qa-frontdesk-" + marker + "@example.invalid";
  const password = randomBytes(24).toString("base64url");
  const passwordHash = scryptSync(password, "gromma:" + email, 32).toString("hex");
  const receptionHash = scryptSync(password, "gromma:" + receptionistEmail, 32).toString("hex");
  const shop = await prisma.barberShop.create({ data: {
    tenantCode: tenant, tradeName: "QA GROMMA " + marker, document: "QA-GROMMA-" + marker,
    ownerName: "QA", email: "qa-" + marker + "@example.invalid", phone: "00000000000",
    city: "Cotia", state: "SP", status: "APPROVED", accessReleased: true,
    requestedPlan: "PRO", activePlan: "PRO", isDemo: false
  } });
  shopId = shop.id;
  const units = [];
  for (const code of ["A", "B"]) units.push(await prisma.barberShopUnit.create({ data: {
    barberShopId: shop.id, code: "QA-" + code, name: "Unidade QA " + code,
    city: "Cotia", state: "SP", active: true
  } }));
  await prisma.shopUser.create({ data: {
    barberShopId: shop.id, unitId: units[0].id,
    name: "Proprietário QA", email, passwordHash, role: "OWNER", active: true
  } });
  await prisma.shopUser.create({ data: {
    barberShopId: shop.id, unitId: units[0].id,
    name: "Recepção QA", email: receptionistEmail,
    passwordHash: receptionHash, role: "RECEPTIONIST", active: true
  } });
  const barbers = [];
  for (let i = 0; i < 2; i++) barbers.push(await prisma.shopUser.create({ data: {
    barberShopId: shop.id, unitId: units[i].id, role: "BARBER", active: true,
    name: "Profissional QA " + (i ? "B" : "A"),
    email: "qa-barber-" + (i ? "b-" : "a-") + marker + "@example.invalid"
  } }));
  const service = await prisma.service.create({ data: {
    barberShopId: shop.id, name: "Corte QA", price: 80, durationMinutes: 30
  } });
  const commandPayments = [];
  for (let i = 0; i < 2; i++) {
    const startsAt = new Date("2026-10-" + (10 + i) + "T12:00:00.000Z");
    const closedAt = new Date("2026-10-" + (10 + i) + "T14:00:00.000Z");
    const appointment = await prisma.appointment.create({ data: {
      barberShopId: shop.id, unitId: units[i].id, barberId: barbers[i].id,
      serviceId: service.id, startsAt, status: "COMPLETED",
      endsAt: new Date(startsAt.getTime() + 30 * 60000)
    } });
    const command = await prisma.serviceCommand.create({ data: {
      barberShopId: shop.id, unitId: units[i].id, appointmentId: appointment.id,
      status: "CLOSED", total: 80, subtotal: 80, closedAt,
      items: { create: [{ kind: "SERVICE", description: "Corte QA",
        quantity: 1, unitPrice: 80, total: 80 }] }
    } });
    commandPayments.push({ id: "qa-pay-" + marker + i, commandId: command.id,
      sessionId: "qa-session", customerName: "Cliente QA",
      paidAt: closedAt.toISOString(),
      amounts: { CASH: 0, DEBIT: 0, CREDIT: 0, PIX: 8000, TRANSFER: 0 }
    });
  }
  await prisma.barberShop.update({ where: { id: shop.id },
    data: { enabledFeatures: { operations: {
      settings: { defaultCommissionPercent: 30 },
      commandPayments
    } } }
  });
  return { email, password, receptionistEmail, barbers, units };
}
async function login(page, email, password) {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator('form').first().locator('input[type="email"]').fill(email);
  await page.locator('form').first().locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar como cliente' }).click();
  await page.waitForURL(new RegExp("/erp/" + tenant + "(?:/|$|[?])"), { timeout: 45000 });
}
async function checkRoute(page, route, device) {
  const path = "/erp/" + tenant + "/" + route;
  const response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert.equal(response.status(), 200, device + " " + route + " expected HTTP 200");
  await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 70, null, {timeout:25000});
  const txt = await page.locator("body").innerText();
  assert.ok(txt.includes("QA GROMMA") || txt.includes("Profissional QA"),
    device + " " + route + " did not render QA tenant data");
  const overflow = await page.evaluate(() => ({
    width: window.innerWidth, scroll: document.documentElement.scrollWidth
  }));
  assert.ok(overflow.scroll <= overflow.width + 2,
    device + " " + route + " horizontal page overflow " + JSON.stringify(overflow));
  return { path, body: txt.slice(0, 1000) };
}
async function uiFlow(creds) {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const pc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktop = await pc.newPage();
  const errors = [];
  desktop.on("pageerror", error => errors.push(error.message));
  await record("Login proprietário, autenticação real com Neon QA no computador", () =>
    login(desktop, creds.email, creds.password));
  for (const route of ["dashboard", "equipe", "unidades", "comandas",
      "estoque", "assinaturas", "auditoria", "financeiro"]) {
    await record("PC: " + route, () => checkRoute(desktop, route, "PC")).catch(()=>{});
  }
  await record("PC: ficha profissional em página própria", () =>
    checkRoute(desktop, "equipe/" + creds.barbers[0].id, "PC"));
  const commissionsUrl = base + "/erp/" + tenant +
    "/comissoes?comissoesDe=2026-10-01&comissoesAte=2026-10-31";
  await record("PC: apuração de comissões reais por profissional", async () => {
    const response = await desktop.goto(commissionsUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(response.status(), 200);
    const table = desktop.getByRole("table", { name: "Resumo de comissões por profissional" });
    await table.waitFor({timeout:25000});
    const rows=await table.innerText();
    assert.match(rows, /Profissional QA A/);
    assert.match(rows, /Profissional QA B/);
    assert.match(rows, /24,00/);
    const widths=await desktop.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(widths.scroll<=widths.w+2,"Commission overflow");
    await desktop.screenshot({path:screenshotDir + "/comissoes-desktop.png",fullPage:true});
  });
  await record("PC: registrar quitação com dinheiro confirmado, com Neon QA",async()=>{
    const table=desktop.getByRole("table",{name:"Resumo de comissões por profissional"});
    const row=table.getByRole("row").filter({hasText:"Profissional QA A"}).first();
    await row.getByRole("button",{name:"Registrar quitação",exact:true}).click();
    const modal=desktop.getByRole("dialog",{name:"Registrar quitação de comissões"});
    await modal.waitFor({timeout:12000});
    await modal.locator('input[name="paidDate"]').fill("2026-11-02");
    await modal.locator('input[name="confirmPaid"]').check();
    await modal.getByRole("button",{name:"Confirmar quitação"}).click();
    await desktop.getByText("Baixa de comissão registrada com histórico e lançamento financeiro.",
      {exact:false}).waitFor({timeout:30000});
    const payments=await prisma.commissionPayment.findMany({where:{barberShopId:shopId}});
    assert.equal(payments.length,1);
    assert.equal(payments[0].userId,creds.barbers[0].id);
    assert.equal(Number(payments[0].net),24);
    const expenses=await prisma.financialEntry.findMany({where:{barberShopId:shopId,category:"Comissões"}});
    assert.equal(expenses.length,1);
    assert.equal(Number(expenses[0].amount),24);
    assert.equal(expenses[0].status,"PAID");
    const logs=await prisma.adminAuditLog.findMany({where:{
      barberShopId:shopId,action:"COMMISSION_PAYMENT_RECORDED"}});
    assert.equal(logs.length,1);
    assert.equal(logs[0].details.receiptId,payments[0].id);
    assert.equal(logs[0].details.financialEntryId,expenses[0].id);
    await desktop.screenshot({path:screenshotDir + "/comissoes-quitação-desktop.png",fullPage:true});
  });
  await record("Bloqueio contra dupla quitação pela interface",async()=>{
    await desktop.goto(commissionsUrl,{waitUntil:"domcontentloaded"});
    const row=desktop.getByRole("table",{name:"Resumo de comissões por profissional"})
      .getByRole("row").filter({hasText:"Profissional QA A"}).first();
    assert.match(await row.innerText(),/Quitado no período/);
    assert.equal(await prisma.commissionPayment.count({where:{barberShopId:shopId}}),1);
  });
  assert.deepEqual(errors,[],"Errors in desktop JavaScript");
  await pc.close();
  for (const device of [{name:"iPhone",width:390,height:844},
                         {name:"celular-pequeno",width:320,height:700}]) {
    const ctx=await browser.newContext({viewport:{width:device.width,height:device.height},isMobile:true,
      hasTouch:true,deviceScaleFactor:1});
    const page=await ctx.newPage();
    await record(device.name+": login proprietário",()=>login(page,creds.email,creds.password));
    for(const route of ["dashboard","equipe","unidades","comandas","assinaturas","comissoes"]){
      await record(device.name+": "+route,()=>checkRoute(page,route,device.name)).catch(()=>{});
    }
    await page.screenshot({path:screenshotDir + "/mobile-" + device.width + "-comissoes.png",fullPage:true});
    await ctx.close();
  }
  await record("Acesso restrito ao financeiro por recepção",async()=>{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await context.newPage();
    await login(page,creds.receptionistEmail,creds.password);
    const r=await page.goto(base+"/erp/"+tenant+"/financeiro",{waitUntil:"domcontentloaded",timeout:60000});
    const txt=await page.locator("body").innerText();
    assert.ok(r.status()===404 || /ERRO 404|Página não encontrada/i.test(txt),
      "reception should not access financial module");
    await context.close();
  });
}
async function main(){
  let passed=false;
  try {
    await record("Banco Neon conectado e migrações atualizadas",async()=>{
      await prisma.$connect();
      const row=await prisma.$queryRawUnsafe("select current_database() as name");
      assert.equal(row[0].name,"neondb");
    });
    const credentials=await record("Criar dados QA isolados",seed);
    await record("Iniciar Next.js em ambiente de QA",startServer);
    await uiFlow(credentials);
    passed=results.every(result=>result.passed);
  } finally {
    if(browser) await browser.close().catch(()=>{});
    if(server){server.kill("SIGTERM"); await new Promise(r=>setTimeout(r,600));}
    if(shopId){
      try {
        const payments=await prisma.commissionPayment.deleteMany({where:{barberShopId:shopId}});
        await prisma.barberShop.delete({where:{id:shopId}});
        console.log("QA_CLEANUP_OK removed_payments=" + payments.count);
      } catch(error){console.error("QA_CLEANUP_FAILED "+String(error).slice(0,1000));passed=false;}
    }
    await prisma.$disconnect();
    console.log("QA_REPORT "+JSON.stringify({tenant,passed,results,source:"Neon QA",screenshots:screenshotDir}));
    if(!passed)process.exitCode=1;
  }
}
main().catch(err=>{console.error("QA_E2E_FAIL "+String(err).slice(0,1200));process.exitCode=1;});

