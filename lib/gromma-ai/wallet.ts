import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

type MovementKind = "PURCHASE" | "GRANT" | "RESERVE" | "RELEASE" | "ADJUSTMENT";

// Server-only domain primitive. Callers must authenticate and authorize the
// shop and verify payment or reservation evidence before invoking it.
export async function moveAiCredits(
  db: PrismaClient,
  shopId: string,
  operationKey: string,
  delta: number,
  kind: MovementKind,
) {
  if (!shopId || !operationKey || !Number.isSafeInteger(delta) || delta === 0 ||
      Math.abs(delta) > 2147483647 ||
      (kind === "RESERVE" && delta >= 0) ||
      (["PURCHASE", "GRANT", "RELEASE"].includes(kind) && delta <= 0)) {
    throw new Error("INVALID_CREDIT_MOVEMENT");
  }
  return db.$transaction(async (tx) => {
    const wallets = await tx.$queryRaw<Array<{ balance: number; enabled: boolean }>>`
      SELECT "balance", "enabled" FROM "GrommaAiWallet"
      WHERE "barberShopId" = ${shopId} FOR UPDATE
    `;
    const wallet = wallets[0];
    if (!wallet) throw new Error("WALLET_NOT_FOUND");
    const prior = await tx.grommaAiLedger.findUnique({
      where: { barberShopId_operationKey: { barberShopId: shopId, operationKey } },
    });
    if (prior) {
      if (prior.delta !== delta || prior.kind !== kind) throw new Error("IDEMPOTENCY_CONFLICT");
      return { balance: wallet.balance, duplicate: true };
    }
    if (kind === "RESERVE" && !wallet.enabled) throw new Error("AI_DISABLED");
    const balance = wallet.balance + delta;
    if (balance < 0 || balance > 2147483647) throw new Error("INVALID_BALANCE");
    await tx.grommaAiLedger.create({
      data: { id: randomUUID(), barberShopId: shopId, operationKey, delta, kind },
    });
    await tx.grommaAiWallet.update({
      where: { barberShopId: shopId }, data: { balance },
    });
    return { balance, duplicate: false };
  });
}
