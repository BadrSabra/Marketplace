import { Request, Response } from "express";
import { walletService } from "./wallet.service";
import { z } from "zod";

const depositSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  receiptUrl: z.string().min(1, "Receipt image is required"),
});

const withdrawSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
});

export class WalletController {
  async getBalance(req: Request, res: Response) {
    try {
      const userId = (req.user as any).id;
      const balance = await walletService.getBalance(userId);
      res.json({ balance });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async deposit(req: Request, res: Response) {
    try {
      const userId = (req.user as any).id;
      const validated = depositSchema.parse(req.body);
      
      const transaction = await walletService.createDeposit(
        userId, 
        validated.amount, 
        validated.receiptUrl
      );
      
      res.status(201).json(transaction);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message });
    }
  }

  async getPendingDeposits(req: Request, res: Response) {
    try {
      const deposits = await walletService.getPendingDeposits();
      res.json(deposits);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async approveDeposit(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const transaction = await walletService.approveDeposit(id);
      res.json(transaction);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async withdraw(req: Request, res: Response) {
    try {
      const userId = (req.user as any).id;
      const validated = withdrawSchema.parse(req.body);
      await walletService.withdraw(userId, validated.amount);
      res.json({ message: "Withdrawal successful" });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      const msg = error.message || "";
      if (msg.includes("Insufficient")) return res.status(400).json({ message: "الرصيد غير كافٍ" });
      res.status(500).json({ message: msg });
    }
  }

  async adminOverride(req: Request, res: Response) {
    try {
      const { walletId } = req.params;
      const actorId = (req.user as any).id;
      const { amount, reason } = req.body;

      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        return res.status(400).json({ message: "Valid reason (min 5 chars) is required" });
      }

      const newBalance = await walletService.adminOverride(
        walletId,
        amount.toString(),
        reason,
        actorId
      );

      res.json({ balance: newBalance });
    } catch (error: any) {
      if (error.message.startsWith("FORBIDDEN")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.startsWith("NOT_FOUND")) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.startsWith("BUSINESS_RULE_VIOLATION") || error.message.startsWith("BAD_REQUEST")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  }
}

export const walletController = new WalletController();
