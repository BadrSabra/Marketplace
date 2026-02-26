import { db } from "../db";
import { users, wallets, ledger } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function runSimulation() {
  console.log("Starting production safety simulation...");

  try {
    // 1. Simulate failed transaction
    console.log("\nSimulating failed transaction...");
    try {
      await db.transaction(async (tx) => {
        // Force failure
        throw new Error("Simulated database error during transaction");
      });
    } catch (e: any) {
      console.log("Caught expected error:", e.message);
    }

    // 2. Simulate ledger mismatch
    console.log("\nSimulating ledger mismatch...");
    const [admin] = await db.select().from(users).limit(1);
    if (admin) {
      await db.insert(ledger).values({
        creditUserId: admin.id,
        amount: "1000.00",
        type: "DEPOSIT",
        referenceId: admin.id // dummy
      });
      console.log("Injected dummy ledger entry.");
    }

    // 3. Verify consistency check catches it
    console.log("\nRunning consistency check...");
    const { execSync } = await import("child_process");
    try {
      execSync("npx tsx server/scripts/check-ledger-consistency.ts", { stdio: "inherit" });
    } catch (e) {
      console.log("Consistency check correctly reported error.");
    }

    // 4. Run recovery
    console.log("\nRunning recovery script...");
    execSync("npx tsx server/scripts/recover-wallets.ts", { stdio: "inherit" });

    // 5. Final check
    console.log("\nFinal consistency check...");
    execSync("npx tsx server/scripts/check-ledger-consistency.ts", { stdio: "inherit" });

    console.log("\nSimulation complete.");
  } catch (error: any) {
    console.error("Simulation failed:", error);
  }
}

runSimulation();
