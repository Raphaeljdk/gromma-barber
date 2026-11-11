"use client";

import { useState } from "react";
import Link from "next/link";

export function BusinessBranchesField({
  tenantCode,initialValue,registeredBranches,
}:{
  tenantCode:string;initialValue:boolean;registeredBranches:number;
}){
  const [hasBranches,setHasBranches]=useState(initialValue||registeredBranches>0);
  return <div className="gromma-branch-choice">
    <label htmlFor="gromma-has-branches">Possui filial?
      <select id="gromma-has-branches" className="select" name="hasBranches"
        value={hasBranches?"yes":"no"} onChange={event=>setHasBranches(event.target.value==="yes")}>
        <option value="no" disabled={registeredBranches>0}>Não</option>
        <option value="yes">Sim</option>
      </select>
    </label>
    {hasBranches&&<Link className="btn secondary gromma-manage-branches"
      href={"/erp/"+encodeURIComponent(tenantCode)+"/unidades"}>
      {registeredBranches>0?"Gerenciar filiais":"Cadastrar filial"}
    </Link>}
  </div>;
}
