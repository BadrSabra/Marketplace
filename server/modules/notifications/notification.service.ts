import nodemailer from "nodemailer";
import { notificationEmitter, type NotificationEvent } from "./notification.emitter";
import { auditService } from "../../services/auditService";

export class NotificationService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    notificationEmitter.on("notification", this.handleNotification.bind(this));
  }

  private async handleNotification(event: NotificationEvent) {
    try {
      // BUG-FIX: Was importing auditService from ../audit/audit.service which uses
      // insertAuditLog() with a hardcoded fallback UUID "00000000-0000-0000-0000-000000000000"
      // when userId is missing. Since performedByUserId has a NOT NULL FK to users.id,
      // that fallback UUID would cause a FK violation if the system UUID doesn't exist.
      // Now uses the shared auditService from services/auditService (logEvent method)
      // which is used consistently throughout the codebase.
      await auditService.logEvent({
        actionType: `NOTIFICATION_${event.type}`,
        entityType: "NOTIFICATION",
        entityId: event.userId,
        performedByUserId: event.userId,
        performedByRole: event.role,
        newValue: event.payload,
        metadata: {
          timestamp: event.timestamp,
        },
      });
    } catch (error) {
      console.error("Failed to log notification audit:", error);
    }
  }

  async sendEmail(to: string, subject: string, text: string) {
    try {
      if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        console.warn("Email credentials not configured. Skipping email sending.");
        console.log(`To: ${to}, Subject: ${subject}, Message: ${text}`);
        return;
      }

      await this.transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject,
        text,
      });
      console.log(`Email sent successfully to ${to}`);
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
    }
  }

  async notifyDepositSubmitted(email: string, amount: string) {
    await this.sendEmail(
      email,
      "Deposit Submitted",
      `Your deposit of ${amount} has been submitted and is currently PENDING approval.`
    );
  }

  async notifyDepositApproved(email: string, amount: string) {
    await this.sendEmail(
      email,
      "Deposit Approved",
      `Your deposit of ${amount} has been APPROVED. Your wallet balance has been updated.`
    );
  }
}

export const notificationService = new NotificationService();
