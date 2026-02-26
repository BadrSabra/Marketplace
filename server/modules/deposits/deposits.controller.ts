import { Router } from "express";
import { depositService } from "./deposits.service";
import { authenticate, authorizeRole } from "../../middleware/auth";

const router = Router();

router.post("/admin/deposits/:id/approve", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { force, notes } = req.body;
    const adminId = (req as any).user.id;

    const result = await depositService.approveDeposit(id, adminId, !!force, notes);
    res.json(result);
  } catch (error: any) {
    if (error.message === "DEPOSIT_NOT_FOUND") {
      return res.status(404).json({ message: "Deposit not found" });
    }
    if (error.message === "ALREADY_PROCESSED") {
      return res.status(409).json({ message: "Deposit already approved or rejected" });
    }
    if (error.message === "INVALID_AMOUNT") {
      return res.status(422).json({ message: "Invalid deposit amount" });
    }
    if (error.message === "CUSTOMER_NOT_FOUND" || error.message === "WALLET_NOT_FOUND") {
      return res.status(404).json({ message: "Customer or wallet not found" });
    }

    console.error(`[DEPOSIT-ERROR] ${error.message}`);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
