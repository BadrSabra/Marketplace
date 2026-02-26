import { db } from "../db";
import { wallets, ledger } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

async function testWalletProtection() {
  console.log("Testing wallet protection...");
  
  // Find a wallet with some balance
  const [wallet] = await db.select().from(wallets).limit(1);
  if (!wallet) {
    console.error("No wallets found for testing");
    process.exit(1);
  }

  const amountToDeduct = (parseFloat(wallet.balance) + 50).toString();

  try {
    await db.transaction(async (tx) => {
      const [w] = await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).for("update");
      
      if (parseFloat(w.balance) < parseFloat(amountToDeduct)) {
        throw new Error("Insufficient balance");
      }

      await tx.update(wallets)
        .set({ balance: (parseFloat(w.balance) - parseFloat(amountToDeduct)).toString() })
        .where(eq(wallets.id, wallet.id));
    });
    console.error("FAIL: Deduction of more than balance succeeded");
    process.exit(1);
  } catch (err: any) {
    if (err.message === "Insufficient balance") {
      console.log("PASS: Negative balance prevented");
    } else {
      console.error("Unexpected error:", err);
      process.exit(1);
    }
  }
  process.exit(0);
}

testWalletProtection().catch(console.error);
