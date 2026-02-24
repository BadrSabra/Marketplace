import { Request, Response } from "express";
import { walletService } from "./wallet.service";
import { z } from "zod";

const depositSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  receiptUrl: z.string().url("Invalid receipt URL"),
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
}

export const walletController = new WalletController();
