import { Router } from "express";
import { ledgerService } from "./ledger.service";
import { authenticate, authorizeRole } from "../../middleware/auth";
import { auditService } from "../../services/auditService";
import { z } from "zod";

const router = Router();

const querySchema = z.object({
  user_id: z.string().uuid().optional(),
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "COMMISSION", "REFUND"]).optional(),
  status: z.enum(["PENDING", "COMPLETED", "FAILED"]).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort_by: z.string().default("createdAt"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

router.get("/ledger/transactions", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const filters = querySchema.parse(req.query);
    
    // Enforce RBAC: If not ADMIN, can only see own transactions
    if (user.role !== "ADMIN") {
      filters.user_id = user.id;
    }

    const result = await ledgerService.getTransactions(filters);
    
    // Search by related order ID is handled in service/controller logic
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result.transactions = result.transactions.filter(t => 
        t.referenceId?.toLowerCase().includes(searchTerm)
      );
    }

    await auditService.logEvent({
      actionType: "LEDGER_LIST_ACCESS",
      entityType: "ledger",
      entityId: user.id,
      performedByUserId: user.id,
      performedByRole: user.role,
      metadata: { filters }
    });

    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
    }
    console.error(`[LEDGER-ERROR] ${error.message}`);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/ledger", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
  try {
    const filters = querySchema.parse(req.query);
    const result = await ledgerService.getTransactions(filters);
    
    await auditService.logEvent({
      actionType: "ADMIN_LEDGER_LIST_ACCESS",
      entityType: "ledger",
      entityId: "SYSTEM",
      performedByUserId: (req as any).user.id,
      performedByRole: "ADMIN",
      metadata: { filters }
    });

    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
    }
    console.error(`[ADMIN-LEDGER-ERROR] ${error.message}`);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/ledger/:id", authenticate, authorizeRole(["ADMIN"]), async (req, res) => {
  try {
    const id = req.params.id as string;
    const transaction = await ledgerService.getTransactionById(id);
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    await auditService.logEvent({
      actionType: "ADMIN_LEDGER_DETAIL_ACCESS",
      entityType: "ledger",
      entityId: id,
      performedByUserId: (req as any).user.id,
      performedByRole: "ADMIN",
    });

    res.json(transaction);
  } catch (error: any) {
    console.error(`[ADMIN-LEDGER-DETAIL-ERROR] ${error.message}`);
    res.status(500).json({ message: "Internal server error" });
  }
});

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
