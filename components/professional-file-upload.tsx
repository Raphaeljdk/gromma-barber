"use client";

import {useEffect,useRef,useState} from "react";
import {FileText,ImagePlus,UploadCloud,X} from "lucide-react";

type Props={
  name:"photo"|"contractPdf";accept:string;label:string;kind:"photo"|"pdf";
  existingPhotoUrl?:string;
};
const MAX=3*1024*1024;
const READABLE="JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC, HEIF e TIFF";
async function toJpeg(file:File):Promise<File>{
  if(!file.type.startsWith("image/")&&!/\.(heic|heif|tif|tiff)$/i.test(file.name))
    throw new Error("Selecione um arquivo de imagem.");
  if(file.type==="image/svg+xml"||/\.svgz?$/i.test(file.name))
    throw new Error("SVG não é permitido por motivos de segurança; exporte para PNG ou JPEG.");
  if(file.size>18*1024*1024)throw new Error("A imagem original deve ter no máximo 18 MB.");
  if(["image/jpeg","image/png","image/webp"].includes(file.type)&&file.size<=MAX)return file;
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(file);}
  catch{throw new Error("Seu navegador não consegue abrir esse formato. Exporte a foto para JPEG ou PNG e tente novamente.");}
  try{
    const ratio=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
    canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Não foi possível processar a imagem.");
    ctx.fillStyle="#ffffff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for(const quality of [.89,.75,.62,.48]){
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
      if(blob&&blob.size<=MAX)return new File([blob],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"});
    }
    throw new Error("A imagem ainda ultrapassa 3 MB. Escolha uma resolução menor.");
  }finally{bitmap.close();}
}
export function ProfessionalFileUpload({name,accept,label,kind,existingPhotoUrl}:Props){
  const input=useRef<HTMLInputElement>(null);
  const [selected,setSelected]=useState<File|null>(null);
  const [preview,setPreview]=useState("");
  const [error,setError]=useState("");
  const [brokenPhoto,setBrokenPhoto]=useState(false);
  const [processing,setProcessing]=useState(false);
  const isPhoto=kind==="photo";
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  function assign(file:File|null){
    if(!input.current)return;
    const transfer=new DataTransfer();
    if(file)transfer.items.add(file);
    input.current.files=transfer.files;
    setSelected(file);
    setPreview(old=>{if(old)URL.revokeObjectURL(old);return file&&isPhoto?URL.createObjectURL(file):"";});
    setBrokenPhoto(false);
  }
  async function importFile(file:File|undefined){
    if(!file)return;
    setError("");setProcessing(true);
    if(input.current)input.current.form?.setAttribute("data-upload-pending","true");
    try{
      if(isPhoto){
        const processed=await toJpeg(file);
        assign(processed);
      }else if(file.type==="application/pdf"&&file.size>0&&file.size<=MAX){
        assign(file);
      }else throw new Error("Selecione um PDF válido de até 3 MB.");
    }catch(reason){
      assign(null);
      setError(reason instanceof Error?reason.message:"Arquivo inválido.");
    }finally{
      setProcessing(false);
      input.current?.form?.removeAttribute("data-upload-pending");
    }
  }
  return <div className={"professional-file-field"+(isPhoto?" professional-image-upload":"")}>
    <label className="label" htmlFor={"professional-file-"+name}>{label}</label>
    <div className={"professional-file-dropzone"+(selected?" has-file":"")}
      onDragOver={event=>event.preventDefault()}
      onDrop={event=>{event.preventDefault();void importFile(event.dataTransfer.files?.[0]);}}>
      <input id={"professional-file-"+name} ref={input} type="file" name={name}
        accept={accept} className="professional-file-native"
        onChange={event=>{const file=event.currentTarget.files?.[0];void importFile(file);}}/>
      {isPhoto&&(preview||existingPhotoUrl)&&!brokenPhoto
        ?<img className="professional-photo-preview" width={52} height={52}
          src={preview||existingPhotoUrl} alt="Prévia da foto do profissional"
          onError={()=>setBrokenPhoto(true)}/>
        :<span className="professional-file-symbol" aria-hidden="true"><UploadCloud size={22}/></span>}
      <span className="professional-file-description">
        <strong>{isPhoto?"Foto do profissional":"Contrato em PDF"}</strong>
        <small>{isPhoto?"Selecione uma imagem ou arraste aqui · até 3 MB após conversão":"Arraste aqui ou escolha um PDF · até 3 MB"}</small>
      </span>
      <button className="btn secondary professional-file-pick" type="button"
        disabled={processing} onClick={()=>input.current?.click()}>
        {isPhoto?<ImagePlus size={15}/>:<FileText size={15}/>}
        {processing?"Preparando foto...":"Escolher arquivo"}
      </button>
      {selected&&<span className="professional-file-selected" title={selected.name}>
        <strong>{selected.name}</strong>
        <small>{(selected.size/1048576).toLocaleString("pt-BR",{maximumFractionDigits:2})} MB</small>
        <button type="button" aria-label="Remover arquivo selecionado" onClick={()=>{assign(null);setError("");}}><X size={15}/></button>
      </span>}
    </div>
    {isPhoto&&<small className="professional-supported-image-formats">Formatos: {READABLE}. GIF animado é salvo como foto estática; formatos não suportados pelo navegador precisam ser exportados.</small>}
    {brokenPhoto&&<p role="alert" className="professional-photo-warning">A foto cadastrada não carregou. Verifique o arquivo público e envie novamente; o sistema não apagará a foto anterior automaticamente.</p>}
    {error&&<p role="alert" className="professional-upload-error">{error}</p>}
  </div>;
}
