import { Router } from "express";
import { authenticate, authorizeRole } from "../../middleware/auth";
import { walletService } from "../wallet/wallet.service";
import { notifyUser } from "../notifications/push.service";
import { auditService } from "../../services/auditService";
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
    const id = req.params.id as string;
    const adminId = (req as any).user?.id;
    const transaction = await walletService.approveDeposit(id, adminId);

    // Notify user
    try {
      const [txWithUser] = await db
        .select({ userId: wallets.userId, amount: walletTransactions.amount })
        .from(walletTransactions)
        .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
        .where(eq(walletTransactions.id, id));
      if (txWithUser) {
        notifyUser(
          txWithUser.userId,
          "DEPOSIT_APPROVED",
          "تم قبول الإيداع",
          `تمت الموافقة على إيداعك بمبلغ ${txWithUser.amount} جنيه وتم إضافته لمحفظتك`,
          { amount: txWithUser.amount }
        ).catch(console.error);
      }
    } catch {}

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
    const id = req.params.id as string;

    // Fetch user info before updating
    const [txBefore] = await db
      .select({ userId: wallets.userId, amount: walletTransactions.amount })
      .from(walletTransactions)
      .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
      .where(and(eq(walletTransactions.id, id), eq(walletTransactions.status, "PENDING")));

    const [updated] = await db
      .update(walletTransactions)
      .set({ status: "FAILED" })
      .where(and(eq(walletTransactions.id, id), eq(walletTransactions.status, "PENDING")))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Deposit not found or already processed" });
    }

    if (txBefore) {
      notifyUser(
        txBefore.userId,
        "DEPOSIT_REJECTED",
        "تم رفض الإيداع",
        `تم رفض طلب الإيداع بمبلغ ${txBefore.amount} جنيه. يرجى التواصل مع الدعم`,
        { amount: txBefore.amount }
      ).catch(console.error);

      // BUG-FIX: Deposit rejection had no audit log. Every financial administrative action
      // must be recorded for compliance and traceability. Approval had an audit log via
      // walletService.approveDeposit(), but rejection bypassed auditService entirely.
      const adminId = (req as any).user?.id;
      if (adminId) {
        auditService.logEvent({
          actionType: "DEPOSIT_REJECTED",
          entityType: "wallet_transaction",
          entityId: id,
          performedByUserId: adminId,
          performedByRole: "ADMIN",
          oldValue: { status: "PENDING" },
          newValue: { status: "FAILED" },
          metadata: { amount: txBefore.amount, userId: txBefore.userId },
        }).catch(console.error);
      }
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
