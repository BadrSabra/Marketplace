import { Router } from "express";
import { ledgerService } from "./ledger.service";

const router = Router();

router.post("/process-commission/:subOrderId", async (req, res) => {
  try {
    const { subOrderId } = req.params;
    const { force } = req.body;
    
    const result = await ledgerService.processCommissions(subOrderId, !!force);
    res.json(result);
  } catch (error: any) {
    if (error.message === "SUB_ORDER_NOT_FOUND") {
      return res.status(404).json({ message: "Sub-order not found" });
    }
    if (error.message === "INVALID_STATUS") {
      return res.status(400).json({ message: "Sub-order not in DELIVERED status" });
    }
    if (error.message === "ALREADY_PROCESSED") {
      return res.status(409).json({ message: "Commission already processed" });
    }
    if (error.message === "INVALID_AMOUNTS") {
      return res.status(422).json({ message: "Negative subtotal or fee" });
    }
    if (error.message === "STORE_NOT_FOUND") {
      return res.status(404).json({ message: "Store not found" });
    }
    
    console.error(`[LEDGER-ERROR] ${error.message}`);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
