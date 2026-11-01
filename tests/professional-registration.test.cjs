const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");

const source=fs.readFileSync(path.resolve(__dirname,"../lib/professional-profile.ts"),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const moduleObject={exports:{}};
new Function("require","module","exports",js)(require,moduleObject,moduleObject.exports);
const {professionalCanServeAt,validInterval,hasProfessionalPermission}=moduleObject.exports;
const date=(t)=>new Date("2026-11-02T"+t+":00-03:00");

test("jornada e pausas permitem somente agendamentos cabíveis",()=>{
  const profile={
    workHours:[{day:1,start:"09:00",end:"18:00"}],
    breaks:[{id:"lunch",day:1,start:"12:00",end:"13:00"}],
  };
  assert.equal(professionalCanServeAt(profile,date("09:00"),date("09:30")),true);
  assert.equal(professionalCanServeAt(profile,date("11:45"),date("12:15")),false);
  assert.equal(professionalCanServeAt(profile,date("17:45"),date("18:15")),false);
  assert.equal(professionalCanServeAt(profile,new Date("2026-11-01T10:00:00-03:00"),
    new Date("2026-11-01T10:30:00-03:00")),false);
});
test("folga, feriado individual e serviço desabilitado bloqueiam reserva",()=>{
  const profile={leaves:[{id:"leave",from:"2026-11-02",to:"2026-11-04",reason:"Férias"}],
    enabledServices:["haircut"]};
  assert.equal(professionalCanServeAt(profile,date("10:00"),date("10:30"),["haircut"]),false);
  const working={...profile,leaves:[]};
  assert.equal(professionalCanServeAt(working,date("10:00"),date("10:30"),["beard"]),false);
  assert.equal(professionalCanServeAt(working,date("10:00"),date("10:30"),["haircut"]),true);
});
test("cadastros antigos herdam comportamento permitido e permissões individuais restringem",()=>{
  assert.equal(professionalCanServeAt(undefined,date("10:00"),date("10:30")),true);
  assert.equal(hasProfessionalPermission(undefined,"ADD_PRODUCT"),true);
  assert.equal(hasProfessionalPermission({permissions:["ADD_SERVICE"]},"ADD_PRODUCT"),false);
  assert.equal(hasProfessionalPermission({permissions:["ADD_SERVICE"]},"ADD_SERVICE"),true);
});
test("intervalos incorretos são rejeitados",()=>{
  assert.equal(validInterval("12:00","13:00"),true);
  assert.equal(validInterval("13:00","12:00"),false);
  assert.equal(validInterval("25:00","26:00"),false);
});
