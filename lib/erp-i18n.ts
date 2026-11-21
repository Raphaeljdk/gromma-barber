/** Dicionário local da interface ERP. Valores fornecidos pelos usuários não são traduzidos. */
export type ErpLocale = "pt-BR" | "en" | "es" | "fr" | "de" | "it";
export const ERP_LOCALES: {id:ErpLocale;label:string}[] = [
  {id:"pt-BR",label:"Português"}, {id:"en",label:"English"},
  {id:"es",label:"Español"}, {id:"fr",label:"Français"},
  {id:"de",label:"Deutsch"}, {id:"it",label:"Italiano"},
];
type LocaleTranslations = [string,string,string,string,string];
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
const navigationLabels:Record<string,LocaleTranslations>={
  "Atendimento e rotina": [
    "Service and daily operations",
    "Atención y operaciones diarias",
    "Service et opérations quotidiennes",
    "Service und Tagesbetrieb",
    "Servizio e operazioni quotidiane"
  ],
  "Dashboard": [
    "Dashboard",
    "Panel de control",
    "Tableau de bord",
    "Dashboard",
    "Pannello di controllo"
  ],
  "Cadastro de Feriados": [
    "Holiday calendar",
    "Registro de festivos",
    "Calendrier des jours fériés",
    "Feiertagskalender",
    "Calendario festività"
  ],
  "Clientes Bloqueados": [
    "Blocked clients",
    "Clientes bloqueados",
    "Clients bloqués",
    "Gesperrte Kunden",
    "Clienti bloccati"
  ],
  "Ranking": [
    "Ranking",
    "Clasificación",
    "Classement",
    "Rangliste",
    "Classifica"
  ],
  "Histórico de compras": [
    "Purchase history",
    "Historial de compras",
    "Historique des achats",
    "Kaufhistorie",
    "Storico acquisti"
  ],
  "Comandas": [
    "Service tickets",
    "Comandas",
    "Fiches de service",
    "Auftragszettel",
    "Schede servizio"
  ],
  "Histórico de caixas": [
    "Cash register history",
    "Historial de cajas",
    "Historique des caisses",
    "Kassenhistorie",
    "Storico cassa"
  ],
  "Entrada e Saída": [
    "Stock in and out",
    "Entradas y salidas",
    "Entrées et sorties",
    "Warenein- und -ausgang",
    "Entrate e uscite"
  ],
  "Balanço": [
    "Stocktaking",
    "Balance",
    "Bilan",
    "Bestandsaufnahme",
    "Bilancio"
  ],
  "Solicitar compra": [
    "Request purchase",
    "Solicitar compra",
    "Demander un achat",
    "Einkauf anfordern",
    "Richiedi acquisto"
  ],
  "Clube / Assinaturas": [
    "Club / Subscriptions",
    "Club / Suscripciones",
    "Club / Abonnements",
    "Club / Abonnements",
    "Club / Abbonamenti"
  ],
  "Planos, clientes e cobranças": [
    "Plans, clients and billing",
    "Planes, clientes y cobros",
    "Forfaits, clients et facturation",
    "Tarife, Kunden und Abrechnung",
    "Piani, clienti e pagamenti"
  ],
  "Abrir Clube / Assinaturas": [
    "Open Club / Subscriptions",
    "Abrir Club / Suscripciones",
    "Ouvrir Club / Abonnements",
    "Club / Abonnements öffnen",
    "Apri Club / Abbonamenti"
  ],
  "Dashboard Gromma Pag": [
    "Gromma Pay dashboard",
    "Panel de Gromma Pag",
    "Tableau de bord Gromma Pag",
    "Gromma Pag Dashboard",
    "Dashboard Gromma Pag"
  ],
  "Programar reajuste": [
    "Schedule price adjustment",
    "Programar reajuste",
    "Programmer une révision tarifaire",
    "Preisanpassung planen",
    "Programma adeguamento"
  ],
  "Calendário de pagamentos": [
    "Payment calendar",
    "Calendario de pagos",
    "Calendrier des paiements",
    "Zahlungskalender",
    "Calendario pagamenti"
  ],
  "Calendário de recebíveis": [
    "Receivables calendar",
    "Calendario de cobros",
    "Calendrier des encaissements",
    "Forderungskalender",
    "Calendario incassi"
  ],
  "Novos contratos": [
    "New contracts",
    "Nuevos contratos",
    "Nouveaux contrats",
    "Neue Verträge",
    "Nuovi contratti"
  ],
  "Clientes cancelados": [
    "Canceled clients",
    "Clientes cancelados",
    "Clients résiliés",
    "Gekündigte Kunden",
    "Clienti cancellati"
  ],
  "Contratos ativos": [
    "Active contracts",
    "Contratos activos",
    "Contrats actifs",
    "Aktive Verträge",
    "Contratti attivi"
  ],
  "Distribuição do Pote": [
    "Subscription pool distribution",
    "Distribución del fondo",
    "Répartition de la cagnotte",
    "Verteilung des Abo-Pools",
    "Distribuzione del fondo"
  ],
  "Inadimplentes": [
    "Overdue accounts",
    "Morosos",
    "Impayés",
    "Zahlungsrückstände",
    "Insolventi"
  ],
  "Planos": [
    "Plans",
    "Planes",
    "Forfaits",
    "Tarife",
    "Piani"
  ],
  "Solicitar saque": [
    "Request withdrawal",
    "Solicitar retiro",
    "Demander un retrait",
    "Auszahlung beantragen",
    "Richiedi prelievo"
  ],
  "Transações financeiras": [
    "Financial transactions",
    "Transacciones financieras",
    "Transactions financières",
    "Finanztransaktionen",
    "Transazioni finanziarie"
  ],
  "Gestão": [
    "Management",
    "Gestión",
    "Gestion",
    "Verwaltung",
    "Gestione"
  ],
  "Auditoria, relatórios e comissões": [
    "Audit, reports and commissions",
    "Auditoría, informes y comisiones",
    "Audit, rapports et commissions",
    "Prüfung, Berichte und Provisionen",
    "Audit, report e commissioni"
  ],
  "Auditoria": [
    "Audit",
    "Auditoría",
    "Audit",
    "Prüfung",
    "Audit"
  ],
  "Agendamentos": [
    "Appointments",
    "Citas",
    "Rendez-vous",
    "Termine",
    "Appuntamenti"
  ],
  "Fechamento de caixa": [
    "Cash register closing",
    "Cierre de caja",
    "Clôture de caisse",
    "Kassenabschluss",
    "Chiusura cassa"
  ],
  "Produtividade": [
    "Productivity",
    "Productividad",
    "Productivité",
    "Produktivität",
    "Produttività"
  ],
  "Gerar comissão": [
    "Calculate commissions",
    "Generar comisiones",
    "Calculer les commissions",
    "Provisionen berechnen",
    "Calcola commissioni"
  ],
  "Assinaturas": [
    "Subscriptions",
    "Suscripciones",
    "Abonnements",
    "Abonnements",
    "Abbonamenti"
  ],
  "Troca de assinatura": [
    "Change subscription",
    "Cambio de suscripción",
    "Changer d’abonnement",
    "Abo wechseln",
    "Cambio abbonamento"
  ],
  "Cancelados por período": [
    "Cancellations by period",
    "Cancelaciones por período",
    "Résiliations par période",
    "Kündigungen nach Zeitraum",
    "Disdette per periodo"
  ],
  "Históricos de transações": [
    "Transaction history",
    "Historial de transacciones",
    "Historique des transactions",
    "Transaktionshistorie",
    "Storico transazioni"
  ],
  "Quantidade de assinantes": [
    "Subscriber count",
    "Cantidad de suscriptores",
    "Nombre d’abonnés",
    "Anzahl Abonnenten",
    "Numero abbonati"
  ],
  "Vendas novas por período": [
    "New sales by period",
    "Ventas nuevas por período",
    "Nouvelles ventes par période",
    "Neue Verkäufe nach Zeitraum",
    "Nuove vendite per periodo"
  ],
  "Vendas por origem": [
    "Sales by source",
    "Ventas por origen",
    "Ventes par origine",
    "Verkäufe nach Herkunft",
    "Vendite per origine"
  ],
  "Resgate de pontos": [
    "Redeem points",
    "Canje de puntos",
    "Échanger des points",
    "Punkte einlösen",
    "Riscatta punti"
  ],
  "Estornos": [
    "Refunds",
    "Reembolsos",
    "Remboursements",
    "Erstattungen",
    "Rimborsi"
  ],
  "Faturamento": [
    "Revenue",
    "Facturación",
    "Chiffre d’affaires",
    "Umsatz",
    "Fatturato"
  ],
  "Movimentações": [
    "Transactions",
    "Movimientos",
    "Mouvements",
    "Bewegungen",
    "Movimenti"
  ],
  "Vendas e lucro": [
    "Sales and profit",
    "Ventas y beneficio",
    "Ventes et bénéfices",
    "Umsatz und Gewinn",
    "Vendite e profitto"
  ],
  "Frequência do cliente": [
    "Client visit frequency",
    "Frecuencia del cliente",
    "Fréquence des visites",
    "Kundenbesuchsfrequenz",
    "Frequenza cliente"
  ],
  "Histórico de agendamento": [
    "Appointment history",
    "Historial de citas",
    "Historique des rendez-vous",
    "Terminhistorie",
    "Storico appuntamenti"
  ],
  "Histórico de vendas de produtos": [
    "Product sales history",
    "Historial de ventas de productos",
    "Historique des ventes de produits",
    "Produktverkaufshistorie",
    "Storico vendite prodotti"
  ],
  "Clientes novos": [
    "New clients",
    "Clientes nuevos",
    "Nouveaux clients",
    "Neue Kunden",
    "Nuovi clienti"
  ],
  "Período e serviços": [
    "Period and services",
    "Período y servicios",
    "Période et services",
    "Zeitraum und Leistungen",
    "Periodo e servizi"
  ],
  "Comissões": [
    "Commissions",
    "Comisiones",
    "Commissions",
    "Provisionen",
    "Commissioni"
  ],
  "MC por profissional": [
    "CM per professional",
    "MC por profesional",
    "MC par professionnel",
    "DB pro Mitarbeiter",
    "MC per professionista"
  ],
  "Ticket médio por clientes distintos": [
    "Average ticket per unique client",
    "Ticket medio por cliente único",
    "Panier moyen par client unique",
    "Durchschnittsbon je eindeutigem Kunden",
    "Scontrino medio per cliente unico"
  ],
  "Ticket médio por atendimento": [
    "Average ticket per appointment",
    "Ticket medio por atención",
    "Panier moyen par prestation",
    "Durchschnittsbon je Termin",
    "Scontrino medio per servizio"
  ],
  "Gerencial": [
    "Management overview",
    "Resumen gerencial",
    "Vue de gestion",
    "Managementübersicht",
    "Panoramica gestionale"
  ],
  "Alertas": [
    "Alerts",
    "Alertas",
    "Alertes",
    "Warnungen",
    "Avvisi"
  ],
  "Marketing e promoção": [
    "Marketing and promotions",
    "Marketing y promociones",
    "Marketing et promotions",
    "Marketing und Aktionen",
    "Marketing e promozioni"
  ],
  "Fidelização e experiência": [
    "Loyalty and experience",
    "Fidelización y experiencia",
    "Fidélisation et expérience",
    "Kundenbindung und Erlebnis",
    "Fidelizzazione ed esperienza"
  ],
  "Clube do assinante": [
    "Subscriber club",
    "Club de suscriptores",
    "Club des abonnés",
    "Abonnentenclub",
    "Club abbonati"
  ],
  "Pontos": [
    "Points",
    "Puntos",
    "Points",
    "Punkte",
    "Punti"
  ],
  "Promoções": [
    "Promotions",
    "Promociones",
    "Promotions",
    "Aktionen",
    "Promozioni"
  ],
  "Cupons": [
    "Coupons",
    "Cupones",
    "Coupons",
    "Gutscheine",
    "Coupon"
  ],
  "Experiência": [
    "Experience",
    "Experiencia",
    "Expérience",
    "Erlebnis",
    "Esperienza"
  ],
  "Aniversariantes": [
    "Birthdays",
    "Cumpleañeros",
    "Anniversaires",
    "Geburtstage",
    "Compleanni"
  ],
  "Avaliação": [
    "Review",
    "Evaluación",
    "Évaluation",
    "Bewertung",
    "Recensione"
  ],
  "Empresa": [
    "Business",
    "Empresa",
    "Entreprise",
    "Unternehmen",
    "Azienda"
  ],
  "Cadastros e configuração": [
    "Records and settings",
    "Registros y configuración",
    "Registres et paramètres",
    "Stammdaten und Einstellungen",
    "Anagrafiche e impostazioni"
  ],
  "Cadastro": [
    "Registration",
    "Registro",
    "Enregistrement",
    "Erfassung",
    "Registrazione"
  ],
  "Dados": [
    "Details",
    "Datos",
    "Données",
    "Daten",
    "Dati"
  ],
  "Grupos de acesso": [
    "Access groups",
    "Grupos de acceso",
    "Groupes d’accès",
    "Zugriffsgruppen",
    "Gruppi di accesso"
  ],
  "Meu plano": [
    "My plan",
    "Mi plan",
    "Mon forfait",
    "Mein Tarif",
    "Il mio piano"
  ],
  "Fatura": [
    "Invoice",
    "Factura",
    "Facture",
    "Rechnung",
    "Fattura"
  ],
  "Contas, despesas e cadastros": [
    "Accounts, expenses and records",
    "Cuentas, gastos y registros",
    "Comptes, dépenses et registres",
    "Konten, Ausgaben und Stammdaten",
    "Conti, spese e registri"
  ],
  "Contas a pagar": [
    "Accounts payable",
    "Cuentas por pagar",
    "Comptes fournisseurs",
    "Verbindlichkeiten",
    "Conti da pagare"
  ],
  "Contas a receber": [
    "Accounts receivable",
    "Cuentas por cobrar",
    "Comptes clients",
    "Forderungen",
    "Conti da ricevere"
  ],
  "Criar receita": [
    "Create income",
    "Crear ingreso",
    "Créer une recette",
    "Einnahme erfassen",
    "Crea entrata"
  ],
  "Despesas": [
    "Expenses",
    "Gastos",
    "Dépenses",
    "Ausgaben",
    "Spese"
  ],
  "Criar despesas": [
    "Create expenses",
    "Crear gastos",
    "Créer des dépenses",
    "Ausgaben erfassen",
    "Crea spese"
  ],
  "Cadastros": [
    "Records",
    "Registros",
    "Registres",
    "Stammdaten",
    "Registri"
  ],
  "Categorias financeiras": [
    "Financial categories",
    "Categorías financieras",
    "Catégories financières",
    "Finanzkategorien",
    "Categorie finanziarie"
  ],
  "Contas bancárias": [
    "Bank accounts",
    "Cuentas bancarias",
    "Comptes bancaires",
    "Bankkonten",
    "Conti bancari"
  ],
  "Formas de pagamento": [
    "Payment methods",
    "Métodos de pago",
    "Modes de paiement",
    "Zahlungsmethoden",
    "Metodi di pagamento"
  ],
  "Comanda": [
    "Service ticket",
    "Comanda",
    "Fiche de service",
    "Auftragszettel",
    "Scheda servizio"
  ],
  "Contabilidade": [
    "Accounting",
    "Contabilidad",
    "Comptabilité",
    "Buchhaltung",
    "Contabilità"
  ],
  "Kardex": [
    "Inventory ledger",
    "Kardex",
    "Registre des stocks",
    "Lagerkartei",
    "Registro magazzino"
  ],
  "Relatório de entrada": [
    "Inbound report",
    "Informe de entrada",
    "Rapport des entrées",
    "Wareneingangsbericht",
    "Report entrate"
  ],
  "Relatório de saída": [
    "Outbound report",
    "Informe de salida",
    "Rapport des sorties",
    "Warenausgangsbericht",
    "Report uscite"
  ],
  "Portal do contador": [
    "Accountant portal",
    "Portal del contador",
    "Portail du comptable",
    "Steuerberaterportal",
    "Portale commercialista"
  ],
  "Relacionamento e campanhas": [
    "Relationships and campaigns",
    "Relaciones y campañas",
    "Relations et campagnes",
    "Beziehungen und Kampagnen",
    "Relazioni e campagne"
  ],
  "Módulo futuro": [
    "Future module",
    "Módulo futuro",
    "Module à venir",
    "Zukünftiges Modul",
    "Modulo futuro"
  ],
  "Precificação": [
    "Pricing",
    "Precios",
    "Tarification",
    "Preisgestaltung",
    "Prezzi"
  ],
  "Totem / Check-in": [
    "Kiosk / Check-in",
    "Tótem / Check-in",
    "Borne / Enregistrement",
    "Terminal / Check-in",
    "Totem / Check-in"
  ],
  "Etapa futura": [
    "Future phase",
    "Próxima etapa",
    "Étape future",
    "Zukünftige Phase",
    "Fase futura"
  ],
  "Documentos": [
    "Documents",
    "Documentos",
    "Documents",
    "Dokumente",
    "Documenti"
  ],
  "Tutoriais / Cursos": [
    "Tutorials / Courses",
    "Tutoriales / Cursos",
    "Tutoriels / Cours",
    "Tutorials / Kurse",
    "Tutorial / Corsi"
  ]
};
export const ERP_UI_TRANSLATIONS:Record<string,LocaleTranslations>={...labels,...navigationLabels};
const localeIndex: Record<Exclude<ErpLocale,"pt-BR">,number>={en:0,es:1,fr:2,de:3,it:4};
export function normalizeErpLocale(value:string|null):ErpLocale{
  return ERP_LOCALES.some(item=>item.id===value)?value as ErpLocale:"pt-BR";
}
export function translateErpText(source:string,locale:ErpLocale):string{
  if(locale==="pt-BR")return source;
  const trimmed=source.trim();
  const translations=Object.prototype.hasOwnProperty.call(ERP_UI_TRANSLATIONS,trimmed)?ERP_UI_TRANSLATIONS[trimmed]:undefined;
  if(!translations)return source;
  return source.replace(trimmed,translations[localeIndex[locale]]);
}
