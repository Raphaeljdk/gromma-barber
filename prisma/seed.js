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

async function upsertPilotClient(config) {
  const shop = await prisma.barberShop.upsert({
    where: { document: config.document },
    update: {
      slug: config.slug,
      tenantCode: config.tenantCode,
      isDemo: false,
      tradeName: config.tradeName,
      legalName: config.legalName,
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
      adminNotes: "Cliente piloto fictício para validação comercial e operacional do ERP.",
      reviewedAt: new Date(),
      reviewedBy: "admin@gromma.local",
      enabledFeatures: {
        version: 4,
        pilot: true,
        plan: config.plan,
        features: config.features,
        commercial: config.commercial
      }
    },
    create: {
      slug: config.slug,
      tenantCode: config.tenantCode,
      isDemo: false,
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
      adminNotes: "Cliente piloto fictício para validação comercial e operacional do ERP.",
      reviewedAt: new Date(),
      reviewedBy: "admin@gromma.local",
      enabledFeatures: {
        version: 4,
        pilot: true,
        plan: config.plan,
        features: config.features,
        commercial: config.commercial
      }
    }
  });

  const units = [];
  for (const unit of config.units) {
    const saved = await prisma.barberShopUnit.upsert({
      where: { barberShopId_code: { barberShopId: shop.id, code: unit.code } },
      update: { name: unit.name, address: unit.address, city: config.city, state: "SP", active: true },
      create: { barberShopId: shop.id, code: unit.code, name: unit.name, address: unit.address, city: config.city, state: "SP" }
    });
    units.push(saved);
  }

  const mainUnit = units[0];

  await prisma.shopUser.upsert({
    where: { barberShopId_email: { barberShopId: shop.id, email: config.email } },
    update: {
      name: config.ownerName,
      phone: config.phone,
      role: "OWNER",
      active: true,
      unitId: mainUnit.id,
      passwordHash: config.passwordHash
    },
    create: {
      barberShopId: shop.id,
      unitId: mainUnit.id,
      name: config.ownerName,
      email: config.email,
      phone: config.phone,
      role: "OWNER",
      active: true,
      passwordHash: config.passwordHash
    }
  });

  for (const employee of config.team) {
    await prisma.shopUser.upsert({
      where: { barberShopId_email: { barberShopId: shop.id, email: employee.email } },
      update: { name: employee.name, role: employee.role, active: true, unitId: mainUnit.id },
      create: { barberShopId: shop.id, unitId: mainUnit.id, name: employee.name, email: employee.email, role: employee.role, active: true }
    });
  }

  const existingSubscription = await prisma.platformSubscription.findFirst({
    where: { barberShopId: shop.id, status: "ACTIVE" }
  });

  if (existingSubscription) {
    await prisma.platformSubscription.update({
      where: { id: existingSubscription.id },
      data: { plan: config.plan, monthlyAmount: config.monthlyAmount, setupAmount: config.setupAmount }
    });
  } else {
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
  }

  const serviceRecords = [];
  for (const service of config.services) {
    const saved = await prisma.service.upsert({
      where: { barberShopId_name: { barberShopId: shop.id, name: service.name } },
      update: { price: service.price, durationMinutes: service.durationMinutes, active: true },
      create: { barberShopId: shop.id, ...service }
    });
    serviceRecords.push(saved);
  }

  const productRecords = [];
  for (const product of config.products) {
    const saved = await prisma.product.upsert({
      where: { barberShopId_sku: { barberShopId: shop.id, sku: product.sku } },
      update: { name: product.name, costPrice: product.costPrice, salePrice: product.salePrice, stockMin: product.stockMin, active: true },
      create: { barberShopId: shop.id, ...product }
    });
    productRecords.push(saved);
  }

  const customerCount = await prisma.customer.count({ where: { barberShopId: shop.id } });
  if (customerCount === 0) {
    for (const customer of config.customers) {
      await prisma.customer.create({
        data: {
          barberShopId: shop.id,
          unitId: mainUnit.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          whatsapp: customer.phone,
          active: true
        }
      });
    }
  }

  const financialCount = await prisma.financialEntry.count({ where: { barberShopId: shop.id } });
  if (financialCount === 0) {
    for (const entry of config.financial) {
      await prisma.financialEntry.create({
        data: {
          barberShopId: shop.id,
          unitId: mainUnit.id,
          type: entry.type,
          status: entry.status,
          category: entry.category,
          description: entry.description,
          amount: entry.amount,
          dueDate: new Date(Date.now() + entry.days * 24 * 60 * 60 * 1000)
        }
      });
    }
  }

  const stockCount = await prisma.stockMovement.count({ where: { barberShopId: shop.id } });
  if (stockCount === 0) {
    for (const product of productRecords) {
      await prisma.stockMovement.create({
        data: {
          barberShopId: shop.id,
          unitId: mainUnit.id,
          productId: product.id,
          type: "IN",
          quantity: 20,
          reason: "Estoque inicial do cliente piloto"
        }
      });
    }
  }


  const appointmentCount = await prisma.appointment.count({ where: { barberShopId: shop.id } });
  if (appointmentCount === 0) {
    const customers = await prisma.customer.findMany({ where: { barberShopId: shop.id }, take: 3, orderBy: { createdAt: "asc" } });
    const barbers = await prisma.shopUser.findMany({ where: { barberShopId: shop.id, role: "BARBER", active: true }, take: 2 });
    const services = await prisma.service.findMany({ where: { barberShopId: shop.id, active: true }, take: 3, orderBy: { createdAt: "asc" } });

    for (let i = 0; i < Math.min(customers.length, services.length); i += 1) {
      await prisma.appointment.create({
        data: {
          barberShopId: shop.id,
          unitId: mainUnit.id,
          customerId: customers[i].id,
          barberId: barbers[i % Math.max(barbers.length, 1)]?.id || null,
          serviceId: services[i].id,
          startsAt: new Date(Date.now() + (i + 1) * 60 * 60 * 1000),
          endsAt: new Date(Date.now() + (i + 2) * 60 * 60 * 1000),
          status: i === 0 ? "CONFIRMED" : "SCHEDULED",
          source: i === 0 ? "WHATSAPP" : "MANUAL",
          notes: "Agendamento fictício do cliente piloto"
        }
      });
    }
  }

  const commandCount = await prisma.serviceCommand.count({ where: { barberShopId: shop.id } });
  if (commandCount === 0) {
    const customers = await prisma.customer.findMany({ where: { barberShopId: shop.id }, take: 2, orderBy: { createdAt: "asc" } });
    for (let i = 0; i < customers.length; i += 1) {
      const total = i === 0 ? 85 : 55;
      const command = await prisma.serviceCommand.create({
        data: {
          barberShopId: shop.id,
          unitId: mainUnit.id,
          customerId: customers[i].id,
          status: i === 0 ? "OPEN" : "CLOSED",
          subtotal: total,
          total,
          closedAt: i === 0 ? null : new Date()
        }
      });
      await prisma.commandItem.create({
        data: {
          commandId: command.id,
          kind: "SERVICE",
          description: i === 0 ? "Corte + Barba" : "Corte",
          quantity: 1,
          unitPrice: total,
          total
        }
      });
    }
  }
}

async function seedPilotClients() {
  await upsertPilotClient({
    slug: "cliente-essencial-piloto",
    tenantCode: "GROMMA-CLI-ESS-001",
    tradeName: "Barbearia Horizonte",
    legalName: "Barbearia Horizonte Piloto LTDA",
    document: "00000000000111",
    ownerName: "Marcos Vieira",
    email: "cliente.essencial@gromma.app",
    phone: "(11) 98888-1101",
    address: "Rua das Acácias, 245",
    city: "São Paulo",
    plan: "ESSENTIAL",
    monthlyAmount: 319.90,
    setupAmount: 5000,
    passwordHash: "c6978c94059321fda57c60b0b201dbbbe90dfbcf561f34153296ad48f858c594",
    features: essentialFeatures,
    commercial: { setupFee: 5000, monthlyFee: 319.90, maxUnits: 2, personalizedBrand: false },
    units: [{ code: "MATRIZ", name: "Barbearia Horizonte - Matriz", address: "Rua das Acácias, 245" }],
    team: [
      { name: "Carlos Mendes", email: "carlos.horizonte@gromma.local", role: "BARBER" },
      { name: "Renan Lopes", email: "renan.horizonte@gromma.local", role: "BARBER" },
      { name: "Paula Nascimento", email: "paula.horizonte@gromma.local", role: "RECEPTIONIST" }
    ],
    services: [
      { name: "Corte Tradicional", price: 55, durationMinutes: 45 },
      { name: "Barba", price: 40, durationMinutes: 30 },
      { name: "Corte + Barba", price: 85, durationMinutes: 60 }
    ],
    products: [
      { sku: "HOR-POM-001", name: "Pomada Matte", costPrice: 18, salePrice: 39.90, stockMin: 5 },
      { sku: "HOR-SHA-001", name: "Shampoo Barber", costPrice: 22, salePrice: 49.90, stockMin: 4 }
    ],
    customers: [
      { name: "André Ribeiro", email: "andre.ribeiro@example.com", phone: "(11) 97771-1001" },
      { name: "Felipe Moura", email: "felipe.moura@example.com", phone: "(11) 97771-1002" },
      { name: "Daniel Castro", email: "daniel.castro@example.com", phone: "(11) 97771-1003" },
      { name: "Leandro Alves", email: "leandro.alves@example.com", phone: "(11) 97771-1004" }
    ],
    financial: [
      { type: "RECEIVABLE", status: "PAID", category: "Serviços", description: "Faturamento do dia", amount: 1380, days: 0 },
      { type: "RECEIVABLE", status: "PENDING", category: "Assinaturas", description: "Planos mensais de clientes", amount: 2240, days: 2 },
      { type: "PAYABLE", status: "PENDING", category: "Fornecedor", description: "Reposição de produtos", amount: 720, days: 5 }
    ]
  });

  await upsertPilotClient({
    slug: "cliente-pro-piloto",
    tenantCode: "GROMMA-CLI-PRO-001",
    tradeName: "Nobre Barber House",
    legalName: "Nobre Barber House Piloto LTDA",
    document: "00000000000222",
    ownerName: "Eduardo Nobre",
    email: "cliente.pro@gromma.app",
    phone: "(11) 98888-2202",
    address: "Avenida Paulista, 1800",
    city: "São Paulo",
    plan: "PRO",
    monthlyAmount: 400,
    setupAmount: 30000,
    passwordHash: "9244027bb7c8dd82569f8bdbc411e0a167fd0b0fc6d332b798ce838327cf8428",
    features: proFeatures,
    commercial: { setupFee: 30000, monthlyFee: 400, maxUnits: null, personalizedBrand: true },
    units: [
      { code: "PAULISTA", name: "Nobre Paulista", address: "Avenida Paulista, 1800" },
      { code: "MOEMA", name: "Nobre Moema", address: "Alameda dos Arapanés, 620" }
    ],
    team: [
      { name: "Rafael Prado", email: "rafael.nobre@gromma.local", role: "MANAGER" },
      { name: "Lucas Melo", email: "lucas.nobre@gromma.local", role: "BARBER" },
      { name: "Igor Martins", email: "igor.nobre@gromma.local", role: "BARBER" },
      { name: "Camila Rocha", email: "camila.nobre@gromma.local", role: "RECEPTIONIST" }
    ],
    services: [
      { name: "Corte Premium", price: 80, durationMinutes: 45 },
      { name: "Barba Premium", price: 60, durationMinutes: 35 },
      { name: "Experiência Nobre", price: 145, durationMinutes: 80 }
    ],
    products: [
      { sku: "NOB-POM-001", name: "Pomada Nobre", costPrice: 24, salePrice: 64.90, stockMin: 10 },
      { sku: "NOB-OLE-001", name: "Óleo para Barba Nobre", costPrice: 21, salePrice: 59.90, stockMin: 8 },
      { sku: "NOB-SHA-001", name: "Shampoo Nobre", costPrice: 28, salePrice: 69.90, stockMin: 8 }
    ],
    customers: [
      { name: "Vinícius Duarte", email: "vinicius.duarte@example.com", phone: "(11) 96662-2001" },
      { name: "Rodrigo Azevedo", email: "rodrigo.azevedo@example.com", phone: "(11) 96662-2002" },
      { name: "Bruno Ferraz", email: "bruno.ferraz@example.com", phone: "(11) 96662-2003" },
      { name: "Thiago Campos", email: "thiago.campos@example.com", phone: "(11) 96662-2004" },
      { name: "Henrique Paiva", email: "henrique.paiva@example.com", phone: "(11) 96662-2005" }
    ],
    financial: [
      { type: "RECEIVABLE", status: "PAID", category: "Serviços", description: "Faturamento consolidado", amount: 4860, days: 0 },
      { type: "RECEIVABLE", status: "PENDING", category: "Assinaturas", description: "Clubes e planos recorrentes", amount: 8920, days: 2 },
      { type: "PAYABLE", status: "PENDING", category: "Estoque", description: "Reposição multiunidade", amount: 2480, days: 4 }
    ]
  });
}


main()
  .then(() => seedPilotClients())
  .then(() => console.log("Demo and pilot tenants seeded"))
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
