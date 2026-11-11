"use client";

import {useEffect,useRef,useState} from "react";
import {Languages} from "lucide-react";

type Locale="pt-BR"|"en"|"es"|"fr"|"de"|"it";
const LOCALES:{id:Locale;label:string}[]=[
 {id:"pt-BR",label:"Português"},{id:"en",label:"English"},
 {id:"es",label:"Español"},{id:"fr",label:"Français"},
 {id:"de",label:"Deutsch"},{id:"it",label:"Italiano"},
];

/** Interface glossary. Tenant-provided records, names and financial values are never sent for translation. */
const labels:Record<string,[string,string,string,string,string]>={
 "Voltar":["Back","Volver","Retour","Zurück","Indietro"],
 "Suporte":["Support","Soporte","Assistance","Support","Supporto"],
 "Caixa":["Cash register","Caja","Caisse","Kasse","Cassa"],
 "Dados gerais do negócio":["Business details","Datos de la empresa","Informations de l’entreprise","Unternehmensdaten","Dati aziendali"],
 "Cadastro geral":["General details","Datos generales","Informations générales","Allgemeine Angaben","Dati generali"],
 "Informações principais da sua barbearia.":["Main barbershop details.","Información principal de tu barbería.","Informations principales de votre salon.","Wichtige Angaben zum Barbershop.","Informazioni principali del barbiere."],
 "Nome fantasia":["Trade name","Nombre comercial","Nom commercial","Handelsname","Nome commerciale"],
 "Razão social":["Legal name","Razón social","Raison sociale","Firmenname","Ragione sociale"],
 "E-mail da empresa":["Business email","Correo de la empresa","E-mail de l’entreprise","Geschäftliche E-Mail","E-mail aziendale"],
 "Fuso horário":["Time zone","Zona horaria","Fuseau horaire","Zeitzone","Fuso orario"],
 "Salvar dados gerais":["Save details","Guardar datos","Enregistrer","Daten speichern","Salva dati"],
 "Gerenciar filiais":["Manage branches","Gestionar sucursales","Gérer les établissements","Filialen verwalten","Gestisci sedi"],
 "Filiais":["Branches","Sucursales","Établissements","Filialen","Sedi"],
 "Profissionais":["Professionals","Profesionales","Professionnels","Mitarbeiter","Professionisti"],
 "Funcionários em destaque":["Featured professionals","Profesionales destacados","Professionnels à la une","Hervorgehobene Mitarbeiter","Professionisti in evidenza"],
 "Todos os profissionais":["All professionals","Todos los profesionales","Tous les professionnels","Alle Mitarbeiter","Tutti i professionisti"],
 "Visibilidade":["Visibility","Visibilidad","Visibilité","Sichtbarkeit","Visibilità"],
 "Profissional":["Professional","Profesional","Professionnel","Mitarbeiter","Professionista"],
 "Função":["Role","Función","Fonction","Rolle","Ruolo"],
 "Ação":["Action","Acción","Action","Aktion","Azione"],
 "Ações":["Actions","Acciones","Actions","Aktionen","Azioni"],
 "Situação":["Status","Situación","Statut","Status","Stato"],
 "Ativo":["Active","Activo","Actif","Aktiv","Attivo"],
 "Inativo":["Inactive","Inactivo","Inactif","Inaktiv","Inattivo"],
 "Padrão":["Default","Predeterminado","Standard","Standard","Standard"],
 "Em destaque":["Featured","Destacado","En vedette","Hervorgehoben","In evidenza"],
 "Ligado":["On","Activado","Activé","Ein","Attivo"],
 "Desligado":["Off","Desactivado","Désactivé","Aus","Disattivo"],
 "Serviços":["Services","Servicios","Services","Dienstleistungen","Servizi"],
 "Novo serviço":["New service","Nuevo servicio","Nouveau service","Neue Dienstleistung","Nuovo servizio"],
 "Cadastro operacional":["Operational entry","Registro operativo","Enregistrement opérationnel","Betrieblicher Eintrag","Inserimento operativo"],
 "Serviço":["Service","Servicio","Service","Dienstleistung","Servizio"],
 "Duração (min)":["Duration (min)","Duración (min)","Durée (min)","Dauer (min)","Durata (min)"],
 "Valor":["Price","Precio","Prix","Preis","Prezzo"],
 "Valor em fichas":["Token value","Valor en fichas","Valeur en jetons","Wert in Marken","Valore in gettoni"],
 "Período para recompra (dias)":["Repeat purchase (days)","Recompra (días)","Nouvel achat (jours)","Wiederkauf (Tage)","Riacquisto (giorni)"],
 "Categoria":["Category","Categoría","Catégorie","Kategorie","Categoria"],
 "A partir de":["Starting at","Desde","À partir de","Ab","A partire da"],
 "Oculto":["Hidden","Oculto","Masqué","Verborgen","Nascosto"],
 "Serviço de encaixe":["Walk-in service","Servicio sin cita","Sans rendez-vous","Ohne Termin","Senza appuntamento"],
 "Salvar serviço":["Save service","Guardar servicio","Enregistrer le service","Dienstleistung speichern","Salva servizio"],
 "Configurar comissão específica por serviço":["Configure service commission","Configurar comisión por servicio","Configurer la commission par service","Serviceprovision einstellen","Configura commissione servizio"],
 "Comissão específica (%) — vazio para usar a regra do profissional":["Specific commission (%) — blank uses professional rate","Comisión específica (%) — vacío usa la regla profesional","Commission spécifique (%) — vide = règle du professionnel","Spezielle Provision (%) — leer = Mitarbeiterregel","Commissione specifica (%) — vuoto = regola professionista"],
 "Salvar comissão":["Save commission","Guardar comisión","Enregistrer la commission","Provision speichern","Salva commissione"],
 "Duração":["Duration","Duración","Durée","Dauer","Durata"],
 "Status":["Status","Estado","Statut","Status","Stato"],
 "Operacional":["Operational","Operativo","Opérationnel","Betrieb","Operativo"],
 "Voltar à equipe":["Back to staff","Volver al equipo","Retour à l’équipe","Zurück zum Team","Torna al team"],
 "Novo profissional":["New professional","Nuevo profesional","Nouveau professionnel","Neuer Mitarbeiter","Nuovo professionista"],
 "Nome completo":["Full name","Nombre completo","Nom complet","Vollständiger Name","Nome completo"],
 "Unidade":["Branch","Sucursal","Établissement","Filiale","Sede"],
 "Unidade principal":["Main branch","Sucursal principal","Établissement principal","Hauptfiliale","Sede principale"],
 "Buscar serviço":["Search service","Buscar servicio","Rechercher un service","Dienstleistung suchen","Cerca servizio"],
 "Buscar profissional, e-mail ou função":["Search professional, email or role","Buscar profesional, correo o función","Rechercher professionnel, e-mail ou fonction","Mitarbeiter, E-Mail oder Rolle suchen","Cerca professionista, e-mail o ruolo"],
 "Salvar":["Save","Guardar","Enregistrer","Speichern","Salva"],
 "Financeiro":["Finance","Finanzas","Finances","Finanzen","Finanze"],
 "Agenda":["Appointments","Agenda","Planning","Termine","Agenda"],
 "Clientes":["Clients","Clientes","Clients","Kunden","Clienti"],
 "Produtos":["Products","Productos","Produits","Produkte","Prodotti"],
 "Estoque":["Inventory","Inventario","Stock","Lager","Magazzino"],
 "Relatórios":["Reports","Informes","Rapports","Berichte","Rapporti"],
 "Configurações":["Settings","Configuración","Paramètres","Einstellungen","Impostazioni"],
 "Empresa / Cadastro":["Business / Records","Empresa / Registro","Entreprise / Registres","Unternehmen / Register","Azienda / Registro"],
};
const langIndex:Record<Exclude<Locale,"pt-BR">,number>={en:0,es:1,fr:2,de:3,it:4};
const scopeSelector=[
 ".erp-sidebar",".erp-top-actions",".gromma-context-strip",
 ".gromma-services-registration",".gromma-featured-staff",
 ".gromma-business-data","#equipe",".section-head"
].join(",");
function normalizeLanguage(value:string|null):Locale{
 return LOCALES.some(item=>item.id===value)?value as Locale:"pt-BR";
}

export function ErpLanguagePicker(){
  const [locale,setLocale]=useState<Locale>("pt-BR");
  const originals=useRef(new WeakMap<Text,{source:string;last:string}>());
  useEffect(()=>{
    const saved=normalizeLanguage(localStorage.getItem("gromma-locale"));
    setLocale(saved);
  },[]);
  useEffect(()=>{
    document.documentElement.lang=locale;
    const original=originals.current;
    let frame=0;
    let disposed=false;
    function apply(){
      if(disposed)return;
      const root=document.querySelector(".tenant-erp");
      if(!root)return;
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      let node:Node|null;
      while((node=walker.nextNode())){
        const textNode=node as Text;
        const parent=textNode.parentElement;
        if(!parent||!parent.closest(scopeSelector)||parent.closest("script,style,textarea,input,select,option,[contenteditable],.gromma-sidebar-business-copy,.gromma-context-business,.erp-directory-secondary"))continue;
        const value=textNode.nodeValue??"";
        const existing=original.get(textNode);
        const source=existing&&existing.last===value?existing.source:value;
        const cleaned=source.trim();
        const translation=cleaned in labels&&locale!=="pt-BR"?labels[cleaned][langIndex[locale]]:cleaned;
        const next=cleaned?source.replace(cleaned,translation):source;
        original.set(textNode,{source,last:next});
        if(next!==value)textNode.nodeValue=next;
      }
    }
    const observer=new MutationObserver(()=>{
      if(frame)cancelAnimationFrame(frame);
      frame=requestAnimationFrame(apply);
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    apply();
    return ()=>{disposed=true;observer.disconnect();if(frame)cancelAnimationFrame(frame);};
  },[locale]);
  return <label className="gromma-language-picker" title="Idiomas · tradução da interface em expansão">
    <Languages size={16} aria-hidden="true"/>
    <span className="sr-only">Idioma da interface (tradução parcial)</span>
    <select aria-label="Idioma da interface — tradução parcial" value={locale}
      onChange={event=>{
        const chosen=normalizeLanguage(event.target.value);
        localStorage.setItem("gromma-locale",chosen);
        setLocale(chosen);
      }}>
      {LOCALES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
  </label>;
}
