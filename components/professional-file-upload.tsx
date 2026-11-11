"use client";

import { useRef, useState } from "react";
import { FileText, ImagePlus, UploadCloud, X } from "lucide-react";

type Props={name:"photo"|"contractPdf";accept:string;label:string;kind:"photo"|"pdf"};

export function ProfessionalFileUpload({name,accept,label,kind}:Props){
  const input=useRef<HTMLInputElement>(null);
  const [selected,setSelected]=useState<File|null>(null);
  const isPhoto=kind==="photo";
  function assign(file:File|null){
    if(!input.current)return;
    if(!file){input.current.value="";setSelected(null);return;}
    const transfer=new DataTransfer();
    transfer.items.add(file);
    input.current.files=transfer.files;
    setSelected(file);
  }
  return <div className="professional-file-field">
    <label className="label" htmlFor={"professional-file-"+name}>{label}</label>
    <div className={"professional-file-dropzone"+(selected?" has-file":"")}
      onDragOver={event=>event.preventDefault()}
      onDrop={event=>{
        event.preventDefault();
        const file=event.dataTransfer.files?.[0];
        if(file)assign(file);
      }}>
      <input id={"professional-file-"+name} ref={input} type="file" name={name}
        accept={accept} className="professional-file-native"
        onChange={event=>setSelected(event.currentTarget.files?.[0]??null)}/>
      <span className="professional-file-symbol" aria-hidden="true"><UploadCloud size={23}/></span>
      <span className="professional-file-description">
        <strong>{isPhoto?"Foto do profissional":"Contrato em PDF"}</strong>
        <small>Arraste aqui ou escolha um arquivo · até 3 MB</small>
      </span>
      <button className="btn secondary professional-file-pick" type="button"
        onClick={()=>input.current?.click()}>
        {isPhoto?<ImagePlus size={15}/>:<FileText size={15}/>}
        Escolher arquivo
      </button>
      {selected&&<span className="professional-file-selected" title={selected.name}>
        <strong>{selected.name}</strong>
        <small>{(selected.size/1048576).toLocaleString("pt-BR",{maximumFractionDigits:2})} MB</small>
        <button type="button" aria-label="Remover arquivo selecionado"
          onClick={()=>assign(null)}><X size={15}/></button>
      </span>}
    </div>
  </div>;
}
