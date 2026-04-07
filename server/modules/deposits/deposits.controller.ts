import { Router } from "express";
import { depositService } from "./deposits.service";
import { authenticate, authorizeRole } from "../../middleware/auth";
import { walletService } from "../wallet/wallet.service";
import { db } from "../../db";
import { walletTransactions, wallets, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/admin/deposits/pending", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
  try {
    const deposits = await walletService.getPendingDeposits();
    res.json(deposits);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/admin/deposits/:id/approve", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await walletService.approveDeposit(id);
    res.json(transaction);
  } catch (error: any) {
    if (error.message?.includes("DEPOSIT_NOT_FOUND")) {
      return res.status(404).json({ message: "Deposit not found" });
    }
    if (error.message?.includes("ALREADY_PROCESSED") || error.message?.includes("already processed")) {
      return res.status(409).json({ message: "Deposit already approved or rejected" });
    }
    console.error(`[DEPOSIT-ERROR] ${error.message}`);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
});

router.post("/admin/deposits/:id/reject", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await db
      .update(walletTransactions)
      .set({ status: "FAILED" })
      .where(and(eq(walletTransactions.id, id), eq(walletTransactions.status, "PENDING")))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Deposit not found or already processed" });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
