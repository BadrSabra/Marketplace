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
      const userId = (req as any).user.id;
      const balance = await walletService.getBalance(userId);
      res.json({ balance });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async deposit(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
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
      const id = req.params.id as string;

      // Q: هل يجب التحقق من UUID قبل الموافقة على الإيداع؟
      // A: نعم — تمرير معرّف غير صالح يُسبب خطأ PostgreSQL غير معالَج (500).
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ message: "معرّف المعاملة غير صالح" });
      }

      // Q: هل يجب تمرير adminId إلى walletService.approveDeposit()؟
      // A: نعم بالتأكيد. walletService.approveDeposit() تقبل معامل اختياري adminId
      //    وتستخدمه لتسجيل في audit trail أي مشرف وافق على الإيداع. بدون تمريره
      //    يُسجَّل طلب الإيداع كأن المستخدم نفسه وافق على إيداعه (self-approval)
      //    لأن الكود يرجع إلى user?.id بدل adminId — مما يُفسد سجلات المراجعة.
      //    الإصلاح: استخراج adminId من req.user وتمريره للخدمة.
      const adminId = (req as any).user.id;
      const transaction = await walletService.approveDeposit(id, adminId);
      res.json(transaction);
    } catch (error: any) {
      // Q: هل يجب إرجاع 400 لجميع أخطاء approveDeposit؟
      // A: لا — الكود السابق كان يُرجع 400 لكل خطأ بما فيها أخطاء DB الداخلية
      //    (مثل: انتهاء مهلة الاتصال أو فقدان قاعدة البيانات). أخطاء البيانات
      //    التجارية (INVALID أو ALREADY_PROCESSED أو BUSINESS_RULE) تستحق 400،
      //    لكن أي خطأ آخر غير متوقع يجب أن يُرجع 500 حتى يتمكن المشرف من
      //    التمييز بين خطأ في المدخلات وخطأ في البنية التحتية.
      //    الإصلاح: تمييز أخطاء الأعمال (400/409) عن أخطاء السيرفر (500).
      const msg: string = error.message || "";
      const isBusinessError =
        msg.includes("Invalid") ||
        msg.includes("already processed") ||
        msg.includes("BUSINESS_RULE_VIOLATION") ||
        msg.includes("ALREADY_PROCESSED");
      res.status(isBusinessError ? 400 : 500).json({ message: msg });
    }
  }

  async withdraw(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const validated = withdrawSchema.parse(req.body);
      const request = await walletService.withdraw(userId, validated.amount);
      res.json({ message: "تم إرسال طلب السحب بنجاح وهو قيد المراجعة من المشرف", request });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      const msg = error.message || "";
      if (msg.includes("Insufficient") || msg.includes("غير كافٍ")) return res.status(400).json({ message: "الرصيد غير كافٍ" });
      if (msg.includes("BUSINESS_RULE_VIOLATION:")) return res.status(400).json({ message: msg.replace("BUSINESS_RULE_VIOLATION: ", "") });
      res.status(500).json({ message: msg });
    }
  }

  async getPendingWithdrawals(req: Request, res: Response) {
    try {
      const withdrawals = await walletService.getPendingWithdrawals();
      res.json(withdrawals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async approveWithdrawal(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ message: "معرّف طلب السحب غير صالح" });
      }
      const adminId = (req as any).user.id;
      const request = await walletService.approveWithdrawal(id, adminId);
      res.json(request);
    } catch (error: any) {
      // BUG-FIX: Was returning 400 for ALL errors, masking real server failures as
      // client errors. Now maps known client errors to 400/404, everything else to 500.
      const msg: string = error.message || "";
      if (msg.includes("INVALID:") || msg.includes("already processed")) {
        return res.status(409).json({ message: msg });
      }
      if (msg.includes("NOT_FOUND")) {
        return res.status(404).json({ message: msg });
      }
      res.status(500).json({ message: msg });
    }
  }

  async rejectWithdrawal(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ message: "معرّف طلب السحب غير صالح" });
      }
      const adminId = (req as any).user.id;
      const { note } = req.body;
      const request = await walletService.rejectWithdrawal(id, adminId, note);
      res.json(request);
    } catch (error: any) {
      // BUG-FIX: Same as approveWithdrawal — was 400 for all errors.
      const msg: string = error.message || "";
      if (msg.includes("INVALID:") || msg.includes("already processed")) {
        return res.status(409).json({ message: msg });
      }
      if (msg.includes("NOT_FOUND")) {
        return res.status(404).json({ message: msg });
      }
      res.status(500).json({ message: msg });
    }
  }

  async adminOverride(req: Request, res: Response) {
    try {
      const walletId = req.params.walletId as string;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(walletId)) {
        return res.status(400).json({ message: "معرّف المحفظة غير صالح" });
      }
      const actorId = (req as any).user.id;
      const { amount, reason } = req.body;

      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        return res.status(400).json({ message: "Valid reason (min 5 chars) is required" });
      }

      const newBalance = await walletService.adminOverride(
        walletId as string,
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
