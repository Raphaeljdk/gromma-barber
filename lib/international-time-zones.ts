/** IANA identifiers valid in the runtime, rather than Brazil-only fixed offsets. */
export function isValidBusinessTimeZone(value:string):boolean{
  if(!value||value.length>80||!/^[A-Za-z0-9_+\/-]+$/.test(value))return false;
  try{new Intl.DateTimeFormat("en",{timeZone:value}).format(new Date());return true;}
  catch{return false;}
}

export function availableBusinessTimeZones():string[]{
  const common=["UTC","America/Sao_Paulo","America/Manaus","America/Rio_Branco",
    "America/Noronha","America/New_York","America/Los_Angeles",
    "America/Mexico_City","America/Bogota","America/Argentina/Buenos_Aires",
    "Europe/London","Europe/Lisbon","Europe/Madrid","Europe/Paris",
    "Europe/Berlin","Africa/Johannesburg","Asia/Dubai","Asia/Tokyo",
    "Asia/Shanghai","Asia/Kolkata","Australia/Sydney"];
  const supported=typeof Intl.supportedValuesOf==="function"?Intl.supportedValuesOf("timeZone"):[];
  return [...new Set([...common,...supported].filter(isValidBusinessTimeZone))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
}
