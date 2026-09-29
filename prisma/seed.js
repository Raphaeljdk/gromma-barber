const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const essentialFeatures = [
  "Sistema de gestão","Consulta de dados da equipe via IA","Área da contabilidade com dados autorizados pelo gestor",
  "Portal de chamados para jurídico, contábil e marketing","Solicitação de reposição de estoque",
  "Contas de recebimentos de assinaturas por filial","Metas da equipe projetadas no app do barbeiro",
  "Sistema do barbeiro","Assistente IA para faturamento, metas e melhorias","Recebimento de metas do gestor",
  "Prontuário do cliente com foto do corte","Histórico de produtos, itens e serviços",
  "Comparativo de faturamento realizado e projetado","Performance de atendimentos por assinatura",
  "Automação no WhatsApp","Recepção automática","Agendamento automático","Respostas a dúvidas frequentes",
  "Follow-up de clientes inativos em 30, 60 ou 90 dias","Envio de promoções","Mensagem para aniversariantes",
  "Cobrança de assinaturas atrasadas","Venda de planos e serviços","Fila de espera quando não houver disponibilidade",
  "Agente de informações IA","Emissão de NF"
];

const proFeatures = [
  ...essentialFeatures,"Personalização com a marca da barbearia","Totem de agendamento","Check-in no totem",
  "Checkout no totem","Fechamento automático de comandas após checkout","Operação por tablets nas bancadas",
  "Lançamento de produtos, serviços e consumo na comanda"
];

async function upsertDemo(config) {
  const shop = await prisma.barberShop.upsert({
    where: { document: config.document },
    update: {
      slug: config.slug,
      tenantCode: config.tenantCode,
      isDemo: true,
      tradeName: config.tradeName,
      legalName: config.legalName,
      ownerName: config.ownerName,
      email: config.email,
      phone: config.phone,
      whatsapp: config.phone,
      city: config.city,
      state: "SP",
      requestedPlan: config.plan,
      activePlan: config.plan,
      status: "APPROVED",
      accessReleased: true,
      onboardingStage: "ACTIVE",
      adminNotes: "Cadastro fictício criado automaticamente para apresentação comercial.",
      reviewedAt: new Date(),
      reviewedBy: "demo@gromma.local",
      enabledFeatures: {
        version: 3,
        demo: true,
        plan: config.plan,
        features: config.features,
        commercial: config.commercial
      }
    },
    create: {
      slug: config.slug,
      tenantCode: config.tenantCode,
      isDemo: true,
      tradeName: config.tradeName,
      legalName: config.legalName,
      document: config.document,
      ownerName: config.ownerName,
      email: config.email,
      phone: config.phone,
      whatsapp: config.phone,
      address: config.address,
      city: config.city,
      state: "SP",
      requestedPlan: config.plan,
      activePlan: config.plan,
      status: "APPROVED",
      accessReleased: true,
      onboardingStage: "ACTIVE",
      adminNotes: "Cadastro fictício criado automaticamente para apresentação comercial.",
      reviewedAt: new Date(),
      reviewedBy: "demo@gromma.local",
      enabledFeatures: {
        version: 3,
        demo: true,
        plan: config.plan,
        features: config.features,
        commercial: config.commercial
      }
    }
  });

  for (const unit of config.units) {
    await prisma.barberShopUnit.upsert({
      where: { barberShopId_code: { barberShopId: shop.id, code: unit.code } },
      update: { name: unit.name, city: config.city, state: "SP", active: true },
      create: { barberShopId: shop.id, code: unit.code, name: unit.name, city: config.city, state: "SP" }
    });
  }

  const firstUnit = await prisma.barberShopUnit.findFirst({ where: { barberShopId: shop.id }, orderBy: { createdAt: "asc" } });

  await prisma.shopUser.upsert({
    where: { barberShopId_email: { barberShopId: shop.id, email: config.email } },
    update: { name: config.ownerName, role: "OWNER", active: true, unitId: firstUnit?.id || null },
    create: { barberShopId: shop.id, unitId: firstUnit?.id || null, name: config.ownerName, email: config.email, role: "OWNER", active: true }
  });

  const subscription = await prisma.platformSubscription.findFirst({
    where: { barberShopId: shop.id, status: "ACTIVE" }
  });

  if (!subscription) {
    await prisma.platformSubscription.create({
      data: {
        barberShopId: shop.id,
        plan: config.plan,
        status: "ACTIVE",
        monthlyAmount: config.monthlyAmount,
        setupAmount: config.setupAmount,
        nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
  } else {
    await prisma.platformSubscription.update({
      where: { id: subscription.id },
      data: { plan: config.plan, monthlyAmount: config.monthlyAmount, setupAmount: config.setupAmount }
    });
  }

  for (const service of config.services) {
    await prisma.service.upsert({
      where: { barberShopId_name: { barberShopId: shop.id, name: service.name } },
      update: { price: service.price, durationMinutes: service.durationMinutes, active: true },
      create: { barberShopId: shop.id, ...service }
    });
  }

  for (const product of config.products) {
    await prisma.product.upsert({
      where: { barberShopId_sku: { barberShopId: shop.id, sku: product.sku } },
      update: { name: product.name, costPrice: product.costPrice, salePrice: product.salePrice, stockMin: product.stockMin, active: true },
      create: { barberShopId: shop.id, ...product }
    });
  }
}

async function main() {
  await upsertDemo({
    slug: "demo-essential",
    tenantCode: "GROMMA-DEMO-ESS",
    tradeName: "Barbearia Central Prime",
    legalName: "Central Prime Barbearia Demo LTDA",
    document: "00000000000001",
    ownerName: "Lucas Almeida",
    email: "demo.essencial@gromma.local",
    phone: "(11) 90000-1001",
    address: "Rua Demonstração, 100",
    city: "São Paulo",
    plan: "ESSENTIAL",
    monthlyAmount: 319.90,
    setupAmount: 5000,
    features: essentialFeatures,
    commercial: { setupFee: 5000, monthlyFee: 319.90, maxUnits: 2, personalizedBrand: false },
    units: [{ code: "MATRIZ", name: "Unidade Centro" }],
    services: [
      { name: "Corte", price: 55, durationMinutes: 45 },
      { name: "Barba", price: 40, durationMinutes: 30 },
      { name: "Corte + Barba", price: 85, durationMinutes: 60 }
    ],
    products: [
      { sku: "ESS-POM-001", name: "Pomada Modeladora", costPrice: 18, salePrice: 39.90, stockMin: 5 },
      { sku: "ESS-SHA-001", name: "Shampoo Profissional", costPrice: 22, salePrice: 49.90, stockMin: 4 }
    ]
  });

  await upsertDemo({
    slug: "demo-pro",
    tenantCode: "GROMMA-DEMO-PRO",
    tradeName: "Maison 13 Barber Club",
    legalName: "Maison 13 Barber Club Demo LTDA",
    document: "00000000000002",
    ownerName: "Gabriel Martins",
    email: "demo.pro@gromma.local",
    phone: "(19) 90000-2002",
    address: "Avenida Demonstração, 1300",
    city: "Campinas",
    plan: "PRO",
    monthlyAmount: 400,
    setupAmount: 30000,
    features: proFeatures,
    commercial: { setupFee: 30000, monthlyFee: 400, maxUnits: null, personalizedBrand: true },
    units: [
      { code: "CAM-CENTRO", name: "Campinas Centro" },
      { code: "CAM-CAMBUI", name: "Cambuí" },
      { code: "CAM-NORTE", name: "Campinas Norte" }
    ],
    services: [
      { name: "Corte Premium", price: 75, durationMinutes: 45 },
      { name: "Barba Premium", price: 55, durationMinutes: 35 },
      { name: "Experiência Maison", price: 120, durationMinutes: 75 }
    ],
    products: [
      { sku: "PRO-POM-001", name: "Pomada Maison", costPrice: 22, salePrice: 59.90, stockMin: 10 },
      { sku: "PRO-OLE-001", name: "Óleo para Barba", costPrice: 19, salePrice: 54.90, stockMin: 8 }
    ]
  });
}

main()
  .then(() => console.log("Demo tenants seeded"))
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
