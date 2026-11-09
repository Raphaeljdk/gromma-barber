"use client";
import { useEffect, useState } from "react";

/** Prévia local de uma nova foto, sem enviar arquivos antes da confirmação. */
export function ProfessionalPhotoPicker({name,currentPhotoUrl}:{name:string;currentPhotoUrl:string}) {
  const [localPreview,setLocalPreview]=useState<string|null>(null);
  useEffect(()=>()=>{if(localPreview)URL.revokeObjectURL(localPreview);},[localPreview]);
  const photoUrl=localPreview||currentPhotoUrl;
  const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part.slice(0,1)).join("").toUpperCase()||"P";
  return <div className="gromma-photo-picker">
    <div className="gromma-photo-preview" aria-label="Prévia da foto do profissional">
      {photoUrl?<img src={photoUrl} alt={"Prévia da foto de "+name} width={80} height={80}/>:
        <span className="gromma-photo-placeholder" aria-hidden="true">{initials}</span>}
      <div><strong>{name}</strong><small>{localPreview?"Nova foto selecionada (ainda não enviada)":currentPhotoUrl?"Foto atual do cadastro":"Sem foto cadastrada"}</small></div>
    </div>
    <label className="gromma-photo-input"><span className="label">Selecionar foto do profissional</span>
      <input className="input" type="file" name="photo" accept="image/jpeg,image/png,image/webp" required
        aria-describedby="professional-photo-hint" onChange={event=>{
          const file=event.currentTarget.files?.[0];
          if(!file){setLocalPreview(null);return;}
          if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>3*1024*1024){setLocalPreview(null);return;}
          setLocalPreview(URL.createObjectURL(file));
        }}/>
      <small id="professional-photo-hint">JPEG, PNG ou WebP · até 3 MB. A prévia não salva a foto automaticamente.</small>
    </label>
  </div>;
}
