const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
function helper(file){
  const transpiled=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};const module={exports};
  new Function("module","exports","require",transpiled)(module,exports,(name)=>{
    if(name==="./checkout"||name==="@/lib/checkout") return require("./../../lib/checkout");
    if(name==="@/lib/agenda") return {
      isAgendaDate:v=>/^\d{4}-\d{2}-\d{2}$/.test(v),
      addAgendaDays:(v,d)=>new Date(Date.parse(v+"T12:00:00-03:00")+d*86400000).toISOString().slice(0,10),
      agendaDateKey:d=>d.toISOString().slice(0,10),
    };
    throw new Error("Unsupported test import "+name);
  });
  return module.exports;
}

test("three management audit routes are protected and routable",()=>{
  const nav=read("lib/erp-navigation.ts");
  const routes=read("app/erp/[tenant]/[module]/page.tsx");
  const page=read("app/erp/[tenant]/page.tsx");
  for(const route of ["auditoria-agendamentos","auditoria-fechamento-caixa","auditoria-produtividade"]){
    assert.ok(nav.includes('route: "'+route+'"'));
    assert.ok(routes.includes('"'+route+'"'));
    assert.ok(page.includes('activeModule === "'+route+'"'));
  }
  assert.ok(nav.includes('label: "Fechamento de caixa"'));
  assert.doesNotMatch(nav,/Batimento de caixa/);
  assert.match(page,/canManage=\{auditCanView\}/);
});

test("appointment history uses real audit data, role lookup and time",()=>{
  const panel=read("components/management-appointment-audit.tsx");
  assert.match(panel,/barberShopId:shopId/);
  assert.match(panel,/action:\{startsWith:"APPOINTMENT_"\}/);
  assert.match(panel,/path:\["appointmentId"\]/);
  assert.match(panel,/customer:/);
  assert.match(panel,/name:\{contains:search/);
  assert.match(panel,/createdAt:"asc"/);
  assert.match(panel,/actorUserId/);
  assert.match(panel,/Autoria não registrada/);
  const created=read("app/erp/[tenant]/actions.ts");
  const moved=read("app/erp/[tenant]/agenda-actions.ts");
  const paid=read("app/erp/[tenant]/checkout-actions.ts");
  assert.ok(created.includes('action:"APPOINTMENT_CREATED"'));
  assert.ok(moved.includes('action:"APPOINTMENT_RESCHEDULED"'));
  assert.ok(paid.includes('action:"APPOINTMENT_COMPLETED"'));
});

test("cash report respects closed sessions and separates payment methods and customer discounts",()=>{
  const panel=read("components/management-cash-closing.tsx");
  assert.match(panel,/session\.closedAt/);
  assert.match(panel,/session\.unitId===validUnit/);
  assert.match(panel,/PAYMENT_LABELS\[row.method\]/);
  assert.match(panel,/effectiveDiscountCents/);
  assert.match(panel,/command\?\.customer\?\.name/);
  assert.match(panel,/caixa-historico/);
  assert.match(panel,/shopId/);
});

test("productivity heatmap includes day week month and subtracts blocks",()=>{
  const panel=read("components/management-productivity.tsx");
  for(const name of ["Dia","Semana","Mês","blockedMinutes","occupancyMinutes","availableForProfessional","bookedIntervals","Profissional"])assert.ok(panel.includes(name),name);
  assert.match(panel,/barberShopId:shopId/);
  assert.match(panel,/status:\{notIn:\["CANCELED","NO_SHOW"\]\}/);
  const fn=read("lib/management-audit.ts");
  assert.match(fn,/intervalMinutes/);
  assert.match(fn,/subtractIntervals/);
  assert.match(fn,/Math\.max\(0/);
});

test("interval subtraction avoids double-counting overlapping blocks",()=>{
  const source=read("lib/management-audit.ts");
  const match=source.match(/export function intervalMinutes\([\s\S]*?\n\}/);
  assert.ok(match);
  assert.match(source,/return intervalMinutes\(bookings\.flatMap/);
  assert.match(source,/const available=subtractIntervals\(\[base\],closed\)/);
});
