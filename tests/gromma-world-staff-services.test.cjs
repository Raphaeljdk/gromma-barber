const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

test("time zones are IANA-valid worldwide and persist without Brazil-only allowlist",()=>{
 const action=read("app/erp/[tenant]/business-data-actions.ts");
 const ws=read("lib/erp-workspace.ts");
 const data=read("components/business-data-section.tsx");
 const picker=read("components/business-timezone-select.tsx");
 assert.match(action,/isValidBusinessTimeZone\(timeZone\)/);
 assert.match(ws,/isValidBusinessTimeZone\(String\(operations\.businessTimeZone/);
 assert.match(data,/<BusinessTimeZoneSelect defaultValue/);
 assert.match(picker,/availableBusinessTimeZones/);
 assert.doesNotMatch(action,/const allowedTimeZones/);
});
test("international language selector is accessible, persisted and honest about partial translation",()=>{
 const page=read("app/erp/[tenant]/page.tsx");
 const picker=read("components/erp-language-picker.tsx");
 assert.match(page,/<ErpLanguagePicker\/>/);
 for(const lang of ["pt-BR","en","es","fr","de","it"])
  assert.ok(picker.includes('id:"'+lang+'"'),"Missing "+lang);
 assert.match(picker,/localStorage\.setItem\("gromma-locale"/);
 assert.match(picker,/aria-label="Idioma da interface — tradução parcial"/);
 assert.match(picker,/useRef\(new WeakMap<Text/);
});
test("featured staff uses a real safe toggle with backend audit, no new tabs",()=>{
 const page=read("app/erp/[tenant]/page.tsx");
 const toggle=read("components/featured-professional-switch.tsx");
 const backend=read("app/erp/[tenant]/featured-professional-actions.ts");
 assert.match(page,/<FeaturedProfessionalSwitch tenantCode/);
 assert.match(toggle,/role="switch"/);
 assert.match(toggle,/aria-checked=\{featured\}/);
 assert.match(toggle,/toggleFeaturedProfessional/);
 assert.match(backend,/FEATURED_PROFESSIONAL_CHANGED/);
 assert.match(page,/>Filiais · \{shop\.units\.length\}<\/Link>/);
});
test("service creation captures fields and writes tenant-scoped metadata",()=>{
 const page=read("app/erp/[tenant]/page.tsx");
 const action=read("app/erp/[tenant]/actions.ts");
 const ws=read("lib/erp-workspace.ts");
 const service=page.slice(page.indexOf('id="servicos"'),page.indexOf('id="comandas"'));
 for(const name of ["name","durationMinutes","price","ticketValue","repurchaseDays","category","startingFrom","hidden","walkIn"]){
  assert.ok(service.includes('name="'+name+'"'),"Missing "+name);
 }
 const indexes=["name","durationMinutes","price","ticketValue","repurchaseDays","category","startingFrom","hidden","walkIn"]
   .map(name=>service.indexOf('name="'+name+'"'));
 assert.ok(indexes.every((at,i)=>at>=0&&(!i||at>indexes[i-1])),"Requested field order");
 assert.match(service,/gromma-service-commission-trigger/);
 assert.match(service,/gromma-service-commission-form/);
 assert.ok(service.indexOf('gromma-services-list')<service.indexOf('gromma-service-commission-trigger'),
  "Commission action stays below the service list");
 assert.match(action,/ws\.serviceCatalogSettings\[created\.id\]/);
 assert.match(action,/isolationLevel:"Serializable"/);
 assert.match(ws,/serviceCatalogSettings: Record<string,ServiceCatalogMetadata>/);
 assert.match(ws,/serviceCatalogSettings:Object\.fromEntries/);
});
test("compact CSS maintains responsive fields and readable controls",()=>{
 const css=read("app/gromma-world-staff-services.css");
 assert.match(css,/\.gromma-service-primary-row/);
 assert.match(css,/\.gromma-service-extra-row/);
 assert.match(css,/\.gromma-service-commission-form/);
 assert.match(css,/\.gromma-featured-switch\.is-on/);
 assert.match(css,/@media\(max-width:450px\)/);
 assert.match(read("app/layout.tsx"),/gromma-world-staff-services\.css/);
});