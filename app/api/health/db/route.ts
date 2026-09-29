import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const shops = await prisma.barberShop.count();

    return Response.json({
      ok: true,
      database: "connected",
      barberShops: shops,
    });
  } catch (error) {
    console.error("Database health check failed", error);

    return Response.json(
      {
        ok: false,
        database: "error",
        message: error instanceof Error ? error.name : "DatabaseError",
      },
      { status: 503 },
    );
  }
}
