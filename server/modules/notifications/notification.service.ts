import nodemailer from "nodemailer";

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
