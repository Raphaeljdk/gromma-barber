// Runs only against a separate preview and test tenant, never production.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const config=JSON.parse(fs.readFileSync(process.env.COMMISSION_QA_CONFIG||'/tmp/gromma-qa-config.json','utf8'));
if(config.baseUrl !== 'http://localhost:3000')throw Error('Only the local CI test server is permitted');
const payload=Buffer.from(JSON.stringify({userId:'commission-qa-owner',barberShopId:'commission-qa-shop',tenantCode:'COMMISSIONQA',email:'owner@example.invalid',role:'OWNER',exp:Date.now()+3600000})).toString('base64url');
const cookie=payload+'.'+crypto.createHmac('sha256',config.secret).update(payload).digest('base64url');
(async()=>{fs.mkdirSync('test-results',{recursive:true});const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'gromma_tenant_session',value:cookie,url:config.baseUrl,httpOnly:true,secure:false,sameSite:'Lax'}]);const page=await context.newPage();page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
await page.goto(config.baseUrl+'/erp/COMMISSIONQA/comissoes?start=2026-10-01&end=2026-10-31',{waitUntil:'networkidle'});console.log('QA page loaded',page.url());
await page.screenshot({path:'test-results/commission-desktop.png',fullPage:true});
assert.equal(await page.locator('#comissoes').count(),1);assert.equal(await page.locator('#relatorio-comissoes').count(),0);
const row=page.locator('#comissoes tbody tr').filter({hasText:'Profissional QA'});assert.ok((await row.innerText()).includes('75,00'));
for(const [name,width,height] of [['iphone',390,844],['android',412,915]]){await page.setViewportSize({width,height});await page.screenshot({path:'test-results/commission-'+name+'.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'page overflow '+name);await row.getByRole('button',{name:'Pagar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'visible'});const bounds=await page.getByRole('dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);await page.getByRole('button',{name:'Fechar pagamento'}).click();}
const pdfUrl=await row.getByRole('link',{name:'Emitir Folha em PDF'}).getAttribute('href');const pdf=await context.request.get(config.baseUrl+pdfUrl);assert.equal(pdf.status(),200);assert.equal(pdf.headers()['content-type'],'application/pdf');fs.writeFileSync('test-results/commission-preview.pdf',await pdf.body());
await page.setViewportSize({width:1440,height:1000});
const duplicate=await context.newPage();await duplicate.goto(page.url(),{waitUntil:'networkidle'});
await duplicate.locator('#comissoes').getByRole('button',{name:'Pagar',exact:true}).click();
await row.getByRole('button',{name:'Pagar',exact:true}).click();
await Promise.all([page.getByRole('dialog').getByRole('button',{name:'Confirmar pagamento'}).click(),duplicate.getByRole('dialog').getByRole('button',{name:'Confirmar pagamento'}).click()]);
await Promise.all([page.waitForURL(/commission(Ok|Error)=/),duplicate.waitForURL(/commission(Ok|Error)=/)]);
assert.equal([page.url(),duplicate.url()].filter(u=>u.includes('commissionOk=1')).length,1,'exactly one simultaneous payout succeeds');
assert.equal([page.url(),duplicate.url()].filter(u=>u.includes('commissionError=')).length,1,'duplicate rejected');
await page.goto(config.baseUrl+'/erp/COMMISSIONQA/comissoes?start=2026-10-01&end=2026-10-31',{waitUntil:'networkidle'});
assert.equal(await page.locator('#comissoes tbody tr').filter({hasText:'Profissional QA'}).count(),0);
await page.goto(config.baseUrl+'/erp/COMMISSIONQA/relatorio-comissoes?start=2026-10-01&end=2026-10-31',{waitUntil:'networkidle'});assert.equal(await page.locator('#comissoes').count(),0);const history=page.locator('#relatorio-comissoes tr').filter({hasText:'Profissional QA'});assert.equal(await history.count(),1);assert.ok((await history.innerText()).includes('Pago'));assert.equal(await page.getByRole('button',{name:'Pagar',exact:true}).count(),0);
const paidPdf=await history.getByRole('link',{name:'Reemitir PDF'}).getAttribute('href');const paid=await context.request.get(config.baseUrl+paidPdf);assert.equal(paid.status(),200);fs.writeFileSync('test-results/commission-paid.pdf',await paid.body());
const denied=await context.request.get(config.baseUrl+'/erp/COMMISSIONOTHER/comissoes/pdf?'+paidPdf.split('?')[1]);assert.notEqual(denied.headers()['content-type'],'application/pdf');
console.log('PASS: desktop, iPhone/Android viewports, dialog, payout, history, PDF and cross-tenant PDF access');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
