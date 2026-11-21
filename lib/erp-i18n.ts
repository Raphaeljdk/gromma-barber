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
const screenLabels:Record<string,LocaleTranslations>={
  "Hoje": [
    "Today",
    "Hoy",
    "Aujourd’hui",
    "Heute",
    "Oggi"
  ],
  "Agora": [
    "Now",
    "Ahora",
    "Maintenant",
    "Jetzt",
    "Adesso"
  ],
  "Novo agendamento": [
    "New appointment",
    "Nueva cita",
    "Nouveau rendez-vous",
    "Neuer Termin",
    "Nuovo appuntamento"
  ],
  "Agendados": [
    "Scheduled",
    "Agendados",
    "Planifiés",
    "Geplant",
    "Prenotati"
  ],
  "Em atendimento": [
    "In service",
    "En atención",
    "En cours",
    "In Behandlung",
    "In servizio"
  ],
  "Concluídos": [
    "Completed",
    "Finalizados",
    "Terminés",
    "Abgeschlossen",
    "Completati"
  ],
  "Horários livres": [
    "Available slots",
    "Horarios libres",
    "Créneaux libres",
    "Freie Termine",
    "Orari liberi"
  ],
  "Ocupação": [
    "Occupancy",
    "Ocupación",
    "Occupation",
    "Auslastung",
    "Occupazione"
  ],
  "Clientes sem plano": [
    "Clients without a plan",
    "Clientes sin plan",
    "Clients sans forfait",
    "Kunden ohne Tarif",
    "Clienti senza piano"
  ],
  "Clientes com plano": [
    "Clients with a plan",
    "Clientes con plan",
    "Clients avec forfait",
    "Kunden mit Tarif",
    "Clienti con piano"
  ],
  "No local": [
    "On site",
    "En el local",
    "Sur place",
    "Vor Ort",
    "Sul posto"
  ],
  "Bloquear horário": [
    "Block time",
    "Bloquear horario",
    "Bloquer un créneau",
    "Zeit sperren",
    "Blocca orario"
  ],
  "Indicadores do dia": [
    "Daily indicators",
    "Indicadores del día",
    "Indicateurs du jour",
    "Tageskennzahlen",
    "Indicatori giornalieri"
  ],
  "Ir para uma data": [
    "Go to a date",
    "Ir a una fecha",
    "Aller à une date",
    "Datum auswählen",
    "Vai a una data"
  ],
  "Exibição": [
    "Display",
    "Visualización",
    "Affichage",
    "Anzeige",
    "Visualizzazione"
  ],
  "Ampliada": [
    "Expanded",
    "Ampliada",
    "Étendue",
    "Erweitert",
    "Estesa"
  ],
  "Compacta": [
    "Compact",
    "Compacta",
    "Compacte",
    "Kompakt",
    "Compatta"
  ],
  "Estreita": [
    "Narrow",
    "Estrecha",
    "Étroite",
    "Schmal",
    "Stretta"
  ],
  "Normal": [
    "Normal",
    "Normal",
    "Normale",
    "Normal",
    "Normale"
  ],
  "Larga": [
    "Wide",
    "Ancha",
    "Large",
    "Breit",
    "Larga"
  ],
  "Remover filtro": [
    "Clear filter",
    "Quitar filtro",
    "Retirer le filtre",
    "Filter entfernen",
    "Rimuovi filtro"
  ],
  "Limpar filtros": [
    "Clear filters",
    "Limpiar filtros",
    "Effacer les filtres",
    "Filter löschen",
    "Cancella filtri"
  ],
  "Horário": [
    "Time",
    "Horario",
    "Horaire",
    "Uhrzeit",
    "Orario"
  ],
  "Agendar": [
    "Book",
    "Agendar",
    "Réserver",
    "Buchen",
    "Prenota"
  ],
  "Unidades e informações": [
    "Branches and information",
    "Sucursales e información",
    "Établissements et informations",
    "Filialen und Informationen",
    "Sedi e informazioni"
  ],
  "Próximos horários livres": [
    "Next available slots",
    "Próximos horarios libres",
    "Prochains créneaux libres",
    "Nächste freie Termine",
    "Prossimi orari liberi"
  ],
  "Fila de espera": [
    "Waiting list",
    "Lista de espera",
    "Liste d’attente",
    "Warteliste",
    "Lista d’attesa"
  ],
  "Avisar pelo WhatsApp": [
    "Notify via WhatsApp",
    "Avisar por WhatsApp",
    "Informer via WhatsApp",
    "Per WhatsApp benachrichtigen",
    "Avvisa via WhatsApp"
  ],
  "Concluir": [
    "Complete",
    "Finalizar",
    "Terminer",
    "Abschließen",
    "Completa"
  ],
  "Novo horário": [
    "New time",
    "Nuevo horario",
    "Nouvel horaire",
    "Neue Uhrzeit",
    "Nuovo orario"
  ],
  "Confirmar remarcação": [
    "Confirm rescheduling",
    "Confirmar cambio de horario",
    "Confirmer le report",
    "Terminverschiebung bestätigen",
    "Conferma spostamento"
  ],
  "Profissional na mesma unidade": [
    "Professional at the same branch",
    "Profesional de la misma sucursal",
    "Professionnel du même établissement",
    "Mitarbeiter derselben Filiale",
    "Professionista della stessa sede"
  ],
  "Profissional": [
    "Professional",
    "Profesional",
    "Professionnel",
    "Mitarbeiter",
    "Professionista"
  ],
  "Motivo": [
    "Reason",
    "Motivo",
    "Motif",
    "Grund",
    "Motivo"
  ],
  "Início": [
    "Start",
    "Inicio",
    "Début",
    "Beginn",
    "Inizio"
  ],
  "Fim": [
    "End",
    "Fin",
    "Fin",
    "Ende",
    "Fine"
  ],
  "Salvar bloqueio": [
    "Save block",
    "Guardar bloqueo",
    "Enregistrer le blocage",
    "Sperre speichern",
    "Salva blocco"
  ],
  "Liberar este horário": [
    "Free this slot",
    "Liberar este horario",
    "Libérer ce créneau",
    "Diesen Termin freigeben",
    "Libera questo orario"
  ],
  "Reagendar": [
    "Reschedule",
    "Reagendar",
    "Reporter",
    "Verschieben",
    "Riprogramma"
  ],
  "Dados do atendimento": [
    "Appointment details",
    "Datos de la atención",
    "Détails du rendez-vous",
    "Termindetails",
    "Dettagli appuntamento"
  ],
  "Cliente:": [
    "Client:",
    "Cliente:",
    "Client :",
    "Kunde:",
    "Cliente:"
  ],
  "Plano:": [
    "Plan:",
    "Plan:",
    "Forfait :",
    "Tarif:",
    "Piano:"
  ],
  "Data e horário:": [
    "Date and time:",
    "Fecha y hora:",
    "Date et heure :",
    "Datum und Uhrzeit:",
    "Data e ora:"
  ],
  "Unidade:": [
    "Branch:",
    "Sucursal:",
    "Établissement :",
    "Filiale:",
    "Sede:"
  ],
  "Profissional:": [
    "Professional:",
    "Profesional:",
    "Professionnel :",
    "Mitarbeiter:",
    "Professionista:"
  ],
  "Agendamentos realizados": [
    "Completed appointments",
    "Citas realizadas",
    "Rendez-vous effectués",
    "Durchgeführte Termine",
    "Appuntamenti effettuati"
  ],
  "Histórico de compras": [
    "Purchase history",
    "Historial de compras",
    "Historique des achats",
    "Kaufhistorie",
    "Storico acquisti"
  ],
  "Últimos produtos adquiridos": [
    "Recently purchased products",
    "Últimos productos comprados",
    "Derniers produits achetés",
    "Zuletzt gekaufte Produkte",
    "Ultimi prodotti acquistati"
  ],
  "Valor do serviço": [
    "Service price",
    "Precio del servicio",
    "Prix du service",
    "Leistungspreis",
    "Prezzo del servizio"
  ],
  "Observações do agendamento": [
    "Appointment notes",
    "Notas de la cita",
    "Notes du rendez-vous",
    "Terminhinweise",
    "Note appuntamento"
  ],
  "Observações": [
    "Notes",
    "Observaciones",
    "Observations",
    "Notizen",
    "Note"
  ],
  "Serviços e produtos na comanda": [
    "Services and products on the ticket",
    "Servicios y productos de la comanda",
    "Services et produits de la fiche",
    "Leistungen und Produkte im Auftrag",
    "Servizi e prodotti della scheda"
  ],
  "Inserir serviço": [
    "Add service",
    "Agregar servicio",
    "Ajouter un service",
    "Dienstleistung hinzufügen",
    "Aggiungi servizio"
  ],
  "Selecione o serviço": [
    "Select a service",
    "Seleccione el servicio",
    "Sélectionnez le service",
    "Leistung auswählen",
    "Seleziona il servizio"
  ],
  "Excluir": [
    "Delete",
    "Eliminar",
    "Supprimer",
    "Löschen",
    "Elimina"
  ],
  "Editar": [
    "Edit",
    "Editar",
    "Modifier",
    "Bearbeiten",
    "Modifica"
  ],
  "Opções": [
    "Options",
    "Opciones",
    "Options",
    "Optionen",
    "Opzioni"
  ],
  "Ações do agendamento": [
    "Appointment actions",
    "Acciones de la cita",
    "Actions du rendez-vous",
    "Terminaktionen",
    "Azioni appuntamento"
  ],
  "Cancelar e retirar da agenda": [
    "Cancel and remove from calendar",
    "Cancelar y quitar de la agenda",
    "Annuler et retirer du calendrier",
    "Termin absagen und entfernen",
    "Annulla e rimuovi dal calendario"
  ],
  "Cliente faltou": [
    "Client did not show",
    "Cliente ausente",
    "Client absent",
    "Kunde nicht erschienen",
    "Cliente assente"
  ],
  "Cliente no local": [
    "Client on site",
    "Cliente en el local",
    "Client sur place",
    "Kunde vor Ort",
    "Cliente sul posto"
  ],
  "Comanda fechada": [
    "Ticket closed",
    "Comanda cerrada",
    "Fiche clôturée",
    "Auftrag abgeschlossen",
    "Scheda chiusa"
  ],
  "Fechar comanda →": [
    "Close ticket →",
    "Cerrar comanda →",
    "Clôturer la fiche →",
    "Auftrag abschließen →",
    "Chiudi scheda →"
  ],
  "Salvar agendamento": [
    "Save appointment",
    "Guardar cita",
    "Enregistrer le rendez-vous",
    "Termin speichern",
    "Salva appuntamento"
  ],
  "Salvar alterações": [
    "Save changes",
    "Guardar cambios",
    "Enregistrer les modifications",
    "Änderungen speichern",
    "Salva modifiche"
  ],
  "Cancelar": [
    "Cancel",
    "Cancelar",
    "Annuler",
    "Abbrechen",
    "Annulla"
  ],
  "Confirmar": [
    "Confirm",
    "Confirmar",
    "Confirmer",
    "Bestätigen",
    "Conferma"
  ],
  "Confirmar agendamento": [
    "Confirm appointment",
    "Confirmar cita",
    "Confirmer le rendez-vous",
    "Termin bestätigen",
    "Conferma appuntamento"
  ],
  "Pesquisar": [
    "Search",
    "Buscar",
    "Rechercher",
    "Suchen",
    "Cerca"
  ],
  "Buscar": [
    "Search",
    "Buscar",
    "Rechercher",
    "Suchen",
    "Cerca"
  ],
  "Limpar": [
    "Clear",
    "Limpiar",
    "Effacer",
    "Löschen",
    "Cancella"
  ],
  "Filtrar": [
    "Filter",
    "Filtrar",
    "Filtrer",
    "Filtern",
    "Filtra"
  ],
  "Filial": [
    "Branch",
    "Sucursal",
    "Établissement",
    "Filiale",
    "Sede"
  ],
  "Unidades": [
    "Branches",
    "Sucursales",
    "Établissements",
    "Filialen",
    "Sedi"
  ],
  "Nenhum registro encontrado.": [
    "No records found.",
    "No se encontraron registros.",
    "Aucun résultat trouvé.",
    "Keine Einträge gefunden.",
    "Nessun record trovato."
  ],
  "Anterior": [
    "Previous",
    "Anterior",
    "Précédent",
    "Zurück",
    "Precedente"
  ],
  "Próxima": [
    "Next",
    "Siguiente",
    "Suivant",
    "Weiter",
    "Successiva"
  ],
  "Próximo": [
    "Next",
    "Siguiente",
    "Suivant",
    "Weiter",
    "Successivo"
  ],
  "Ver todos": [
    "View all",
    "Ver todos",
    "Voir tous",
    "Alle anzeigen",
    "Mostra tutti"
  ],
  "Ver detalhes": [
    "View details",
    "Ver detalles",
    "Voir les détails",
    "Details anzeigen",
    "Vedi dettagli"
  ],
  "Nome": [
    "Name",
    "Nombre",
    "Nom",
    "Name",
    "Nome"
  ],
  "Telefone": [
    "Phone",
    "Teléfono",
    "Téléphone",
    "Telefon",
    "Telefono"
  ],
  "E-mail": [
    "Email",
    "Correo electrónico",
    "E-mail",
    "E-Mail",
    "Email"
  ],
  "Nascimento": [
    "Birth date",
    "Nacimiento",
    "Date de naissance",
    "Geburtsdatum",
    "Data di nascita"
  ],
  "CPF (opcional)": [
    "CPF (optional)",
    "CPF (opcional)",
    "CPF (facultatif)",
    "CPF (optional)",
    "CPF (facoltativo)"
  ],
  "Endereço (opcional)": [
    "Address (optional)",
    "Dirección (opcional)",
    "Adresse (facultative)",
    "Adresse (optional)",
    "Indirizzo (facoltativo)"
  ],
  "Não informado": [
    "Not provided",
    "No informado",
    "Non renseigné",
    "Nicht angegeben",
    "Non indicato"
  ],
  "Outro": [
    "Other",
    "Otro",
    "Autre",
    "Andere",
    "Altro"
  ],
  "Prontuário e observações": [
    "Client record and notes",
    "Ficha y observaciones",
    "Dossier client et notes",
    "Kundenakte und Notizen",
    "Scheda cliente e note"
  ],
  "Cadastrar novo cliente": [
    "Register new client",
    "Registrar nuevo cliente",
    "Enregistrer un nouveau client",
    "Neuen Kunden anlegen",
    "Registra nuovo cliente"
  ],
  "Salvar cliente": [
    "Save client",
    "Guardar cliente",
    "Enregistrer le client",
    "Kunden speichern",
    "Salva cliente"
  ],
  "Exportar Excel": [
    "Export to Excel",
    "Exportar a Excel",
    "Exporter vers Excel",
    "Nach Excel exportieren",
    "Esporta Excel"
  ],
  "Exportar PDF": [
    "Export to PDF",
    "Exportar a PDF",
    "Exporter en PDF",
    "Als PDF exportieren",
    "Esporta PDF"
  ],
  "Todos os clientes": [
    "All clients",
    "Todos los clientes",
    "Tous les clients",
    "Alle Kunden",
    "Tutti i clienti"
  ],
  "Plano e assinatura": [
    "Plan and subscription",
    "Plan y suscripción",
    "Forfait et abonnement",
    "Tarif und Abonnement",
    "Piano e abbonamento"
  ],
  "Plano": [
    "Plan",
    "Plan",
    "Forfait",
    "Tarif",
    "Piano"
  ],
  "Valor (R$)": [
    "Amount (R$)",
    "Importe (R$)",
    "Montant (R$)",
    "Betrag (R$)",
    "Importo (R$)"
  ],
  "Porcentagem (%)": [
    "Percentage (%)",
    "Porcentaje (%)",
    "Pourcentage (%)",
    "Prozentsatz (%)",
    "Percentuale (%)"
  ],
  "Total": [
    "Total",
    "Total",
    "Total",
    "Gesamt",
    "Totale"
  ],
  "Quantidade": [
    "Quantity",
    "Cantidad",
    "Quantité",
    "Menge",
    "Quantità"
  ],
  "Selecionar filial": [
    "Select branch",
    "Seleccionar sucursal",
    "Choisir un établissement",
    "Filiale auswählen",
    "Seleziona sede"
  ],
  "Receber e fechar": [
    "Receive payment and close",
    "Cobrar y cerrar",
    "Encaisser et clôturer",
    "Bezahlen und abschließen",
    "Incassa e chiudi"
  ],
  "Itens da comanda": [
    "Ticket items",
    "Artículos de la comanda",
    "Éléments de la fiche",
    "Auftragspositionen",
    "Articoli della scheda"
  ],
  "Selecione um item": [
    "Select an item",
    "Seleccione un artículo",
    "Sélectionnez un article",
    "Artikel auswählen",
    "Seleziona un articolo"
  ],
  "Selecione o profissional": [
    "Select a professional",
    "Seleccione al profesional",
    "Sélectionnez un professionnel",
    "Mitarbeiter auswählen",
    "Seleziona professionista"
  ],
  "Incluir": [
    "Add",
    "Incluir",
    "Ajouter",
    "Hinzufügen",
    "Aggiungi"
  ],
  "Descontos e cupons": [
    "Discounts and coupons",
    "Descuentos y cupones",
    "Remises et coupons",
    "Rabatte und Gutscheine",
    "Sconti e coupon"
  ],
  "Tipo de desconto": [
    "Discount type",
    "Tipo de descuento",
    "Type de remise",
    "Rabattart",
    "Tipo di sconto"
  ],
  "Sem desconto manual": [
    "No manual discount",
    "Sin descuento manual",
    "Aucune remise manuelle",
    "Kein manueller Rabatt",
    "Nessuno sconto manuale"
  ],
  "Toda a comanda": [
    "Entire ticket",
    "Toda la comanda",
    "Toute la fiche",
    "Gesamter Auftrag",
    "Intera scheda"
  ],
  "Somente um item": [
    "One item only",
    "Solo un artículo",
    "Un seul article",
    "Nur eine Position",
    "Solo un articolo"
  ],
  "Cupom promocional (opcional)": [
    "Promo code (optional)",
    "Cupón promocional (opcional)",
    "Code promo (facultatif)",
    "Aktionscode (optional)",
    "Codice promozionale (facoltativo)"
  ],
  "Abrir caixa da unidade →": [
    "Open branch cash register →",
    "Abrir caja de sucursal →",
    "Ouvrir la caisse de l’établissement →",
    "Filialkasse öffnen →",
    "Apri cassa della sede →"
  ],
  "Comanda encerrada": [
    "Ticket closed",
    "Comanda cerrada",
    "Fiche clôturée",
    "Auftrag abgeschlossen",
    "Scheda chiusa"
  ],
  "Recebimento registrado.": [
    "Payment recorded.",
    "Cobro registrado.",
    "Encaissement enregistré.",
    "Zahlung erfasst.",
    "Pagamento registrato."
  ],
  "Acompanhe a operação, os atendimentos e as pendências em um único lugar.": [
    "Track operations, appointments and pending tasks in one place.",
    "Controle operaciones, citas y pendientes en un solo lugar.",
    "Suivez les opérations, rendez-vous et tâches en attente au même endroit.",
    "Betrieb, Termine und offene Aufgaben an einem Ort verfolgen.",
    "Segui operazioni, appuntamenti e attività in sospeso in un unico posto."
  ],
  "Visão geral da operação": [
    "Operations overview",
    "Resumen de operaciones",
    "Vue d’ensemble des opérations",
    "Betriebsübersicht",
    "Panoramica operativa"
  ],
  "Operação ativa": [
    "Active operation",
    "Operación activa",
    "Activité en cours",
    "Aktiver Betrieb",
    "Attività in corso"
  ],
  "Em desenvolvimento": [
    "In development",
    "En desarrollo",
    "En développement",
    "In Entwicklung",
    "In sviluppo"
  ],
  "Lista de espera": [
    "Waiting list",
    "Lista de espera",
    "Liste d’attente",
    "Warteliste",
    "Lista d’attesa"
  ],
  "Consultar agenda": [
    "View calendar",
    "Consultar agenda",
    "Consulter le planning",
    "Kalender anzeigen",
    "Visualizza agenda"
  ],
  "Saldo operacional": [
    "Operating balance",
    "Saldo operativo",
    "Solde opérationnel",
    "Betriebssaldo",
    "Saldo operativo"
  ],
  "Pendências financeiras": [
    "Pending financial items",
    "Pendientes financieros",
    "Éléments financiers en attente",
    "Offene Finanzposten",
    "Pendenze finanziarie"
  ],
  "Sem plano": [
    "No plan",
    "Sin plan",
    "Sans forfait",
    "Ohne Tarif",
    "Senza piano"
  ],
  "Legenda dos planos": [
    "Plan color legend",
    "Leyenda de planes",
    "Légende des forfaits",
    "Tariflegende",
    "Legenda piani"
  ],
  "Legenda das comandas": [
    "Ticket color legend",
    "Leyenda de comandas",
    "Légende des fiches",
    "Auftragslegende",
    "Legenda schede"
  ]
};
const feedbackLabels:Record<string,LocaleTranslations>={
  "Estrutura pronta": [
    "Structure ready",
    "Estructura lista",
    "Structure prête",
    "Struktur bereit",
    "Struttura pronta"
  ],
  "Horários": [
    "Time slots",
    "Horarios",
    "Créneaux",
    "Zeiten",
    "Orari"
  ],
  "Produtos / Serviços": [
    "Products / Services",
    "Productos / Servicios",
    "Produits / Services",
    "Produkte / Leistungen",
    "Prodotti / Servizi"
  ],
  "Solicitações de compra": [
    "Purchase requests",
    "Solicitudes de compra",
    "Demandes d’achat",
    "Einkaufsanfragen",
    "Richieste d’acquisto"
  ],
  "Totem / Tablet": [
    "Kiosk / Tablet",
    "Tótem / Tablet",
    "Borne / Tablette",
    "Terminal / Tablet",
    "Totem / Tablet"
  ],
  "Abrir experiência": [
    "Open experience",
    "Abrir experiencia",
    "Ouvrir l’expérience",
    "Ansicht öffnen",
    "Apri esperienza"
  ],
  "Disponível no Pro": [
    "Available in Pro",
    "Disponible en Pro",
    "Disponible dans Pro",
    "In Pro verfügbar",
    "Disponibile in Pro"
  ],
  "Equipe ativa": [
    "Active staff",
    "Equipo activo",
    "Équipe active",
    "Aktives Team",
    "Team attivo"
  ],
  "Comandas abertas": [
    "Open tickets",
    "Comandas abiertas",
    "Fiches ouvertes",
    "Offene Aufträge",
    "Schede aperte"
  ],
  "Agenda operacional": [
    "Operational calendar",
    "Agenda operativa",
    "Planning opérationnel",
    "Betriebskalender",
    "Agenda operativa"
  ],
  "Agenda, disponibilidade e fila de espera": [
    "Calendar, availability and waiting list",
    "Agenda, disponibilidad y lista de espera",
    "Agenda, disponibilités et liste d’attente",
    "Kalender, Verfügbarkeit und Warteliste",
    "Agenda, disponibilità e lista d’attesa"
  ],
  "Comanda atualizada.": [
    "Ticket updated.",
    "Comanda actualizada.",
    "Fiche mise à jour.",
    "Auftrag aktualisiert.",
    "Scheda aggiornata."
  ],
  "Informações do agendamento atualizadas.": [
    "Appointment information updated.",
    "Información de la cita actualizada.",
    "Informations du rendez-vous mises à jour.",
    "Termininformationen aktualisiert.",
    "Informazioni appuntamento aggiornate."
  ],
  "Agenda atualizada com sucesso.": [
    "Calendar updated successfully.",
    "Agenda actualizada correctamente.",
    "Planning mis à jour avec succès.",
    "Kalender erfolgreich aktualisiert.",
    "Agenda aggiornata correttamente."
  ],
  "Não foi possível atualizar as informações do agendamento.": [
    "Could not update appointment information.",
    "No se pudo actualizar la información de la cita.",
    "Impossible de mettre à jour le rendez-vous.",
    "Termininformationen konnten nicht aktualisiert werden.",
    "Impossibile aggiornare le informazioni dell’appuntamento."
  ],
  "Não foi possível salvar a fila de espera. Tente novamente.": [
    "Could not save the waiting list. Try again.",
    "No se pudo guardar la lista de espera. Inténtelo de nuevo.",
    "Impossible d’enregistrer la liste d’attente. Réessayez.",
    "Warteliste konnte nicht gespeichert werden. Erneut versuchen.",
    "Impossibile salvare la lista d’attesa. Riprova."
  ],
  "Agendamento criado com sucesso.": [
    "Appointment created successfully.",
    "Cita creada correctamente.",
    "Rendez-vous créé avec succès.",
    "Termin erfolgreich erstellt.",
    "Appuntamento creato correttamente."
  ],
  "Cliente removido da fila de espera.": [
    "Client removed from the waiting list.",
    "Cliente eliminado de la lista de espera.",
    "Client retiré de la liste d’attente.",
    "Kunde von der Warteliste entfernt.",
    "Cliente rimosso dalla lista d’attesa."
  ],
  "Cliente adicionado à lista de espera.": [
    "Client added to the waiting list.",
    "Cliente añadido a la lista de espera.",
    "Client ajouté à la liste d’attente.",
    "Kunde zur Warteliste hinzugefügt.",
    "Cliente aggiunto alla lista d’attesa."
  ],
  "Não foi possível criar o agendamento. Revise os dados informados.": [
    "Could not create the appointment. Review the information.",
    "No se pudo crear la cita. Revise los datos.",
    "Impossible de créer le rendez-vous. Vérifiez les données.",
    "Termin konnte nicht erstellt werden. Angaben prüfen.",
    "Impossibile creare l’appuntamento. Controlla i dati."
  ],
  "O profissional já possui um atendimento nesse intervalo.": [
    "This professional already has an appointment during that time.",
    "El profesional ya tiene una cita en ese horario.",
    "Ce professionnel a déjà un rendez-vous sur ce créneau.",
    "Dieser Mitarbeiter hat in diesem Zeitraum bereits einen Termin.",
    "Il professionista ha già un appuntamento in quell’orario."
  ],
  "Revise os dados da lista de espera.": [
    "Review the waiting list details.",
    "Revise los datos de la lista de espera.",
    "Vérifiez les données de la liste d’attente.",
    "Angaben zur Warteliste prüfen.",
    "Controlla i dati della lista d’attesa."
  ],
  "Status do atendimento atualizado.": [
    "Appointment status updated.",
    "Estado de la cita actualizado.",
    "Statut du rendez-vous mis à jour.",
    "Terminstatus aktualisiert.",
    "Stato appuntamento aggiornato."
  ],
  "A transição solicitada não é válida para este atendimento.": [
    "The requested status change is not valid for this appointment.",
    "El cambio solicitado no es válido para esta cita.",
    "Le changement de statut demandé est invalide pour ce rendez-vous.",
    "Der gewünschte Statuswechsel ist für diesen Termin ungültig.",
    "Il cambio di stato richiesto non è valido per questo appuntamento."
  ],
  "Seu perfil não possui permissão para concluir esta ação.": [
    "Your account does not have permission to complete this action.",
    "Su perfil no tiene permiso para completar esta acción.",
    "Votre profil n’est pas autorisé à effectuer cette action.",
    "Ihr Konto ist für diese Aktion nicht berechtigt.",
    "Il tuo profilo non è autorizzato a completare l’azione."
  ],
  "Cliente cadastrado com sucesso.": [
    "Client registered successfully.",
    "Cliente registrado correctamente.",
    "Client enregistré avec succès.",
    "Kunde erfolgreich angelegt.",
    "Cliente registrato correttamente."
  ],
  "Cliente e prontuário atualizados.": [
    "Client and record updated.",
    "Cliente y ficha actualizados.",
    "Client et dossier mis à jour.",
    "Kunde und Kundenakte aktualisiert.",
    "Cliente e scheda aggiornati."
  ],
  "Cliente desativado, com histórico preservado.": [
    "Client deactivated; history preserved.",
    "Cliente desactivado; historial conservado.",
    "Client désactivé ; historique conservé.",
    "Kunde deaktiviert; Verlauf bleibt erhalten.",
    "Cliente disattivato; storico conservato."
  ],
  "Revise os dados do cliente e tente novamente.": [
    "Review the client details and try again.",
    "Revise los datos del cliente e inténtelo de nuevo.",
    "Vérifiez les données client et réessayez.",
    "Kundendaten prüfen und erneut versuchen.",
    "Controlla i dati del cliente e riprova."
  ],
  "Dados pessoais e prontuário": [
    "Personal details and client record",
    "Datos personales y ficha",
    "Données personnelles et dossier",
    "Persönliche Daten und Kundenakte",
    "Dati personali e scheda cliente"
  ],
  "Sem unidade específica": [
    "No specific branch",
    "Sin sucursal específica",
    "Sans établissement spécifique",
    "Keine bestimmte Filiale",
    "Nessuna sede specifica"
  ],
  "Como conheceu a barbearia?": [
    "How did you hear about the barbershop?",
    "¿Cómo conoció la barbería?",
    "Comment avez-vous connu le salon ?",
    "Wie haben Sie vom Barbershop erfahren?",
    "Come hai conosciuto la barberia?"
  ],
  "Indicação": [
    "Referral",
    "Recomendación",
    "Recommandation",
    "Empfehlung",
    "Passaparola"
  ],
  "Filtrar assinantes ativos": [
    "Filter active subscribers",
    "Filtrar suscriptores activos",
    "Filtrer les abonnés actifs",
    "Aktive Abonnenten filtern",
    "Filtra abbonati attivi"
  ],
  "Filtrar sem assinatura": [
    "Filter clients without subscription",
    "Filtrar sin suscripción",
    "Filtrer sans abonnement",
    "Kunden ohne Abo filtern",
    "Filtra senza abbonamento"
  ],
  "Prontuário": [
    "Client record",
    "Ficha del cliente",
    "Dossier client",
    "Kundenakte",
    "Scheda cliente"
  ],
  "Próxima cobrança": [
    "Next charge",
    "Próximo cobro",
    "Prochaine facturation",
    "Nächste Abbuchung",
    "Prossimo addebito"
  ],
  "Valor mensal": [
    "Monthly amount",
    "Importe mensual",
    "Montant mensuel",
    "Monatsbetrag",
    "Importo mensile"
  ],
  "Cliente sem assinatura cadastrada.": [
    "Client has no registered subscription.",
    "El cliente no tiene suscripción registrada.",
    "Aucun abonnement enregistré pour ce client.",
    "Für diesen Kunden ist kein Abo registriert.",
    "Nessun abbonamento registrato per questo cliente."
  ],
  "Histórico de visitas": [
    "Visit history",
    "Historial de visitas",
    "Historique des visites",
    "Besuchsverlauf",
    "Storico visite"
  ],
  "Nenhum agendamento registrado.": [
    "No appointments found.",
    "No hay citas registradas.",
    "Aucun rendez-vous enregistré.",
    "Keine Termine erfasst.",
    "Nessun appuntamento registrato."
  ],
  "Histórico de planos": [
    "Plan history",
    "Historial de planes",
    "Historique des forfaits",
    "Tarifverlauf",
    "Storico piani"
  ],
  "Sem histórico de planos.": [
    "No plan history.",
    "Sin historial de planes.",
    "Aucun historique de forfaits.",
    "Kein Tarifverlauf.",
    "Nessuno storico piani."
  ],
  "Cartões de pagamento": [
    "Payment cards",
    "Tarjetas de pago",
    "Cartes de paiement",
    "Zahlungskarten",
    "Carte di pagamento"
  ],
  "Nenhum cliente cadastrado.": [
    "No clients registered.",
    "No hay clientes registrados.",
    "Aucun client enregistré.",
    "Keine Kunden angelegt.",
    "Nessun cliente registrato."
  ],
  "Serviço cadastrado com sucesso.": [
    "Service registered successfully.",
    "Servicio registrado correctamente.",
    "Service créé avec succès.",
    "Leistung erfolgreich angelegt.",
    "Servizio registrato correttamente."
  ],
  "Serviço atualizado. Agendamentos já registrados foram preservados.": [
    "Service updated. Existing appointments were preserved.",
    "Servicio actualizado. Se conservaron las citas existentes.",
    "Service mis à jour. Les rendez-vous existants sont conservés.",
    "Leistung aktualisiert. Bestehende Termine bleiben erhalten.",
    "Servizio aggiornato. Gli appuntamenti esistenti sono conservati."
  ],
  "Serviço excluído do catálogo. Dados históricos preservados.": [
    "Service removed from the catalog. Historical data preserved.",
    "Servicio eliminado del catálogo. Se conservaron los datos históricos.",
    "Service supprimé du catalogue. Historique conservé.",
    "Leistung aus dem Katalog entfernt. Historische Daten bleiben erhalten.",
    "Servizio rimosso dal catalogo. Dati storici conservati."
  ],
  "Não foi possível excluir. Confira se há agendamentos futuros vinculados ao serviço.": [
    "Could not delete. Check for upcoming appointments linked to this service.",
    "No se pudo eliminar. Compruebe las citas futuras vinculadas al servicio.",
    "Suppression impossible. Vérifiez les rendez-vous futurs liés au service.",
    "Löschen fehlgeschlagen. Zukünftige Termine mit dieser Leistung prüfen.",
    "Eliminazione non riuscita. Controlla gli appuntamenti futuri collegati al servizio."
  ],
  "Não foi possível cadastrar o serviço. Revise nome, duração e valor.": [
    "Could not register the service. Check name, duration and price.",
    "No se pudo registrar el servicio. Revise nombre, duración y precio.",
    "Impossible de créer le service. Vérifiez le nom, la durée et le prix.",
    "Leistung konnte nicht angelegt werden. Name, Dauer und Preis prüfen.",
    "Impossibile registrare il servizio. Controlla nome, durata e prezzo."
  ],
  "Tempo em fichas (min)": [
    "Token time (min)",
    "Tiempo en fichas (min)",
    "Temps en jetons (min)",
    "Markenzeit (Min.)",
    "Tempo in gettoni (min)"
  ],
  "Pontos por atendimento pago": [
    "Points per paid appointment",
    "Puntos por atención pagada",
    "Points par prestation payée",
    "Punkte pro bezahltem Termin",
    "Punti per servizio pagato"
  ],
  "Oculto (exclusivo)": [
    "Hidden (exclusive)",
    "Oculto (exclusivo)",
    "Masqué (exclusif)",
    "Verborgen (exklusiv)",
    "Nascosto (esclusivo)"
  ],
  "Tempo de agenda": [
    "Calendar duration",
    "Duración en agenda",
    "Durée dans le planning",
    "Termindauer",
    "Durata in agenda"
  ],
  "Somente proprietário": [
    "Owner only",
    "Solo propietario",
    "Propriétaire uniquement",
    "Nur Inhaber",
    "Solo proprietario"
  ],
  "Nenhum serviço cadastrado.": [
    "No services registered.",
    "No hay servicios registrados.",
    "Aucun service enregistré.",
    "Keine Leistungen angelegt.",
    "Nessun servizio registrato."
  ],
  "Operação salva com sucesso.": [
    "Operation saved successfully.",
    "Operación guardada correctamente.",
    "Opération enregistrée avec succès.",
    "Vorgang erfolgreich gespeichert.",
    "Operazione salvata correttamente."
  ],
  "Caixa / Comandas": [
    "Cash register / Tickets",
    "Caja / Comandas",
    "Caisse / Fiches",
    "Kasse / Aufträge",
    "Cassa / Schede"
  ],
  "Comandas e pagamentos": [
    "Tickets and payments",
    "Comandas y pagos",
    "Fiches et paiements",
    "Aufträge und Zahlungen",
    "Schede e pagamenti"
  ],
  "Voltar ao caixa": [
    "Back to cash register",
    "Volver a caja",
    "Retour à la caisse",
    "Zurück zur Kasse",
    "Torna alla cassa"
  ],
  "Comanda fechada e financeiro atualizado.": [
    "Ticket closed and finances updated.",
    "Comanda cerrada y finanzas actualizadas.",
    "Fiche clôturée et finances mises à jour.",
    "Auftrag abgeschlossen und Finanzen aktualisiert.",
    "Scheda chiusa e contabilità aggiornata."
  ],
  "Não foi possível fechar a comanda.": [
    "Could not close the ticket.",
    "No se pudo cerrar la comanda.",
    "Impossible de clôturer la fiche.",
    "Auftrag konnte nicht abgeschlossen werden.",
    "Impossibile chiudere la scheda."
  ],
  "A data inicial não pode ser posterior à data final.": [
    "The start date cannot be after the end date.",
    "La fecha inicial no puede ser posterior a la final.",
    "La date de début ne peut pas dépasser la date de fin.",
    "Das Startdatum darf nicht nach dem Enddatum liegen.",
    "La data iniziale non può essere successiva a quella finale."
  ],
  "Nenhuma comanda encontrada.": [
    "No tickets found.",
    "No se encontraron comandas.",
    "Aucune fiche trouvée.",
    "Keine Aufträge gefunden.",
    "Nessuna scheda trovata."
  ]
};
export const ERP_UI_TRANSLATIONS:Record<string,LocaleTranslations>={...labels,...navigationLabels,...screenLabels,...feedbackLabels};
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
