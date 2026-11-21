"use client";

import {useEffect,useRef,useState} from "react";
import {Languages} from "lucide-react";
import {
  ERP_LOCALES, normalizeErpLocale, translateErpText,
  type ErpLocale,
} from "@/lib/erp-i18n";

type OriginalValue={source:string;last:string};
const OMIT="script,style,textarea,[contenteditable],[translate='no'],[data-i18n-ignore],.gromma-language-picker,.gromma-sidebar-business-copy,.gromma-context-business,.erp-directory-secondary";
const TRANSLATABLE_ATTRIBUTES=["title","placeholder","aria-label","aria-placeholder","alt"] as const;
const pickerLabel:Record<ErpLocale,string>={
  "pt-BR":"Idioma da interface",
  "en":"Interface language",
  "es":"Idioma de la interfaz",
  "fr":"Langue de l’interface",
  "de":"Sprache der Benutzeroberfläche",
  "it":"Lingua dell’interfaccia",
};

/** Aplica somente traduções presentes no catálogo. Não usa APIs externas nem envia dados do cliente. */
export function ErpLanguagePicker(){
  const [locale,setLocale]=useState<ErpLocale>("pt-BR");
  const originalTexts=useRef(new WeakMap<Text,OriginalValue>());
  const originalAttributes=useRef(new WeakMap<Element,Map<string,OriginalValue>>());

  useEffect(()=>{
    try{setLocale(normalizeErpLocale(localStorage.getItem("gromma-locale")));}
    catch{setLocale("pt-BR");}
    const onStorage=(event:StorageEvent)=>{
      if(event.key==="gromma-locale")setLocale(normalizeErpLocale(event.newValue));
    };
    window.addEventListener("storage",onStorage);
    return ()=>window.removeEventListener("storage",onStorage);
  },[]);

  useEffect(()=>{
    document.documentElement.lang=locale;
    let frame=0;
    let disposed=false;

    function translateTextNode(node:Text){
      const parent=node.parentElement;
      if(!parent||parent.closest(OMIT))return;
      const current=node.nodeValue??"";
      const previous=originalTexts.current.get(node);
      const source=previous&&previous.last===current?previous.source:current;
      const next=translateErpText(source,locale);
      originalTexts.current.set(node,{source,last:next});
      if(next!==current)node.nodeValue=next;
    }
    function translateAttributes(element:Element){
      if(element.closest(OMIT))return;
      let originals=originalAttributes.current.get(element);
      for(const name of TRANSLATABLE_ATTRIBUTES){
        const current=element.getAttribute(name);
        if(current===null)continue;
        const previous=originals?.get(name);
        const source=previous&&previous.last===current?previous.source:current;
        const next=translateErpText(source,locale);
        if(!originals){
          originals=new Map();
          originalAttributes.current.set(element,originals);
        }
        originals.set(name,{source,last:next});
        if(current!==next)element.setAttribute(name,next);
      }
    }
    function apply(){
      if(disposed)return;
      const root=document.querySelector(".tenant-erp");
      if(!root)return;
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      let node:Node|null;
      while((node=walker.nextNode()))translateTextNode(node as Text);
      translateAttributes(root);
      root.querySelectorAll("[title],[placeholder],[aria-label],[aria-placeholder],[alt]").forEach(translateAttributes);
    }
    const observer=new MutationObserver(()=>{
      if(frame)cancelAnimationFrame(frame);
      frame=requestAnimationFrame(apply);
    });
    observer.observe(document.body,{
      subtree:true,childList:true,characterData:true,attributes:true,
      attributeFilter:[...TRANSLATABLE_ATTRIBUTES],
    });
    apply();
    return ()=>{disposed=true;observer.disconnect();if(frame)cancelAnimationFrame(frame);};
  },[locale]);

  return <label className="gromma-language-picker" title={pickerLabel[locale]}>
    <Languages size={16} aria-hidden="true"/>
    <span className="sr-only">{pickerLabel[locale]}</span>
    <select aria-label={pickerLabel[locale]} value={locale}
      onChange={event=>{
        const chosen=normalizeErpLocale(event.target.value);
        try{localStorage.setItem("gromma-locale",chosen);}catch{}
        setLocale(chosen);
      }}>
      {ERP_LOCALES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
  </label>;
}
