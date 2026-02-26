import { db } from "../db";
import { wallets, ledger, walletTransactions } from "../../shared/schema";
import { sql } from "drizzle-orm";

async function checkConsistency() {
  console.log(JSON.stringify({ level: "info", message: "Starting ledger consistency check..." }));

  try {
    const walletSum = await db.select({ total: sql<string>`sum(balance)` }).from(wallets);
    const ledgerSum = await db.select({ total: sql<string>`sum(amount)` }).from(ledger);
    const walletTxCount = await db.select({ count: sql<number>`count(*)` }).from(walletTransactions);
    const ledgerCount = await db.select({ count: sql<number>`count(*)` }).from(ledger);

    const wTotal = parseFloat(walletSum[0]?.total || "0");
    const lTotal = parseFloat(ledgerSum[0]?.total || "0");
    const wTxCount = Number(walletTxCount[0]?.count || 0);
    const lCount = Number(ledgerCount[0]?.count || 0);

    const report = {
      timestamp: new Date().toISOString(),
      walletTotal: wTotal,
      ledgerTotal: lTotal,
      diff: Math.abs(wTotal - lTotal),
      consistent: Math.abs(wTotal - lTotal) < 0.01,
      walletTxCount: wTxCount,
      ledgerCount: lCount,
      severity: "LOW"
    };

    if (!report.consistent) {
      report.severity = "CRITICAL";
      console.error(JSON.stringify({ level: "error", message: "Ledger mismatch detected!", ...report }));
    } else {
      console.log(JSON.stringify({ level: "info", message: "Ledger is consistent.", ...report }));
    }

  } catch (error: any) {
    console.error(JSON.stringify({ level: "error", message: "Consistency check failed", error: error.message }));
    process.exit(1);
  }
}

checkConsistency();
