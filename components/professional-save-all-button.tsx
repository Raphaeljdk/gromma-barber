"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Save } from "lucide-react";
import { saveProfessionalAll } from "@/app/erp/[tenant]/professional-actions";

type Props={tenantCode:string;userId:string};
const optional=new Set(["photo","contract-pdf","contract-add","product-category-rule"]);

export function ProfessionalSaveAllButton({tenantCode,userId}:Props){
  const router=useRouter();
  const [pending,setPending]=useState(false);
  const [result,setResult]=useState<{ok:boolean;message:string}|null>(null);
  async function saveAll(){
    if(pending)return;
    setResult(null);
    const forms=Array.from(document.querySelectorAll<HTMLFormElement>(
      ".professional-registration-page form[data-professional-save]"
    ));
    const data=new FormData();
    data.set("tenantCode",tenantCode);
    data.set("userId",userId);
    for(const form of forms){
      if(form.dataset.uploadPending==="true"){
        setResult({ok:false,message:"A foto ainda está sendo processada. Conclua a seleção antes de salvar."});
        form.scrollIntoView({behavior:"smooth",block:"center"});
        return;
      }
      if(form.querySelector(".professional-upload-error")){
        setResult({ok:false,message:"Revise o arquivo de foto antes de salvar."});
        form.scrollIntoView({behavior:"smooth",block:"center"});
        return;
      }
      const section=form.dataset.professionalSave??"";
      if(!section)continue;
      const fields=new FormData(form);
      const fileName=section==="photo"?"photo":section==="contract-pdf"?"contractPdf":null;
      if(fileName){
        const file=fields.get(fileName);
        if(!(file instanceof File)||file.size===0)continue;
        if(file.size>3*1024*1024){
          setResult({ok:false,message:"O arquivo deve ter no máximo 3 MB."});
          form.scrollIntoView({behavior:"smooth",block:"center"});
          return;
        }
        data.set(fileName,file);
      }else if(section==="contract-add"){
        if(!String(fields.get("label")??"").trim()&&!String(fields.get("url")??"").trim())continue;
      }else if(section==="product-category-rule"){
        if(form.dataset.saveDirty!=="true")continue;
      }
      if(!form.reportValidity()){
        setResult({ok:false,message:"Corrija o campo destacado antes de salvar."});
        form.scrollIntoView({behavior:"smooth",block:"center"});
        return;
      }
      const entries:Array<[string,string]>=[];
      for(const [key,value] of fields){
        if(typeof value==="string")entries.push([key,value]);
      }
      data.append("part",JSON.stringify({section,entries}));
    }
    setPending(true);
    try{
      const response=await saveProfessionalAll(data);
      if(response.ok){
        setResult({ok:true,message:"Todas as seções da ficha foram salvas."});
        router.refresh();
      }else{
        setResult({ok:false,message:response.message});
      }
    }catch{
      setResult({ok:false,message:"Não foi possível salvar tudo. Verifique a conexão e revise a ficha antes de tentar novamente."});
    }finally{setPending(false);}
  }
  return <div className="professional-save-all">
    <span className="professional-save-all-caption">Salve os dados, jornada, permissões e comissões com um clique.</span>
    {result&&<span role={result.ok?"status":"alert"} className={"professional-save-all-feedback"+(result.ok?" is-success":" is-error")}>
      {result.message}
    </span>}
    <button type="button" className="btn professional-save-all-button" disabled={pending}
      onClick={saveAll}>{pending?<Save size={18}/>:<Check size={18}/>}
      {pending?"Salvando...":"Salvar geral"}
    </button>
  </div>;
}
