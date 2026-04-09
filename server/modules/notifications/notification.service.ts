import nodemailer from "nodemailer";

// Q: لماذا أُزيل notificationEmitter من هذا الملف؟
// A: كان المُرسِل (emitter) يُنشئ مُستمعاً لحدث "notification" لكنه لا يُستدعى
//    من أي وحدة أخرى في المشروع — كود ميت كامل. نظام الإشعارات الفعلي يعمل عبر
//    push.service.ts مباشرةً (createNotification + socket.io + webpush).
//    إزالة الـ emitter تُوضح الكود وتحذف تبعية غير مستخدمة.

// Q: هل يجب أن تكون رسائل البريد الإلكتروني بالعربية؟
// A: نعم — المنصة بأكملها موجّهة للمستخدمين العرب، وجميع واجهات المستخدم
//    ورسائل Push Notifications مكتوبة بالعربية. إرسال بريد إلكتروني بالإنجليزية
//    إلى مستخدم عربي يُربكه ويُوحي بأن الرسالة مزيّفة أو خطأ.
//    الإصلاح: تعريب جميع عناوين ونصوص البريد الإلكتروني.

// Q: هل يجب إضافة دالة notifyDepositRejected؟
// A: نعم — مسار رفض الإيداع (POST /admin/deposits/:id/reject) يُرسل إشعار Push
//    للمستخدم عبر notifyUser() لكنه لا يُرسل أي بريد إلكتروني. في المقابل،
//    مسار الموافقة يستدعي notifyDepositApproved() بالبريد. هذا تناقض: المستخدم
//    يتلقى بريداً عند الموافقة لكن لا شيء عند الرفض عبر البريد.
//    الإصلاح: إضافة notifyDepositRejected() واستدعاؤها في مسار الرفض.
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
        console.warn("[NotificationService] بيانات البريد الإلكتروني غير مُهيَّأة. تخطّي الإرسال.");
        console.log(`To: ${to}, Subject: ${subject}, Message: ${text}`);
        return;
      }

      await this.transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject,
        text,
      });
      console.log(`[NotificationService] تم إرسال البريد الإلكتروني بنجاح إلى ${to}`);
    } catch (error) {
      console.error(`[NotificationService] فشل إرسال البريد الإلكتروني إلى ${to}:`, error);
    }
  }

  async notifyDepositSubmitted(email: string, amount: string) {
    await this.sendEmail(
      email,
      "تم استلام طلب الإيداع - ميت جابر",
      `مرحباً،\n\nتم استلام طلب إيداعك بمبلغ ${amount} جنيه وهو الآن قيد المراجعة من قِبل الإدارة.\n\nسيتم إشعارك عند اتخاذ القرار.\n\nفريق ميت جابر`
    );
  }

  async notifyDepositApproved(email: string, amount: string) {
    await this.sendEmail(
      email,
      "تمت الموافقة على إيداعك - ميت جابر",
      `مرحباً،\n\nتهانينا! تمت الموافقة على طلب الإيداع بمبلغ ${amount} جنيه وتم إضافته لرصيد محفظتك.\n\nيمكنك الآن استخدام رصيدك للتسوق.\n\nفريق ميت جابر`
    );
  }

  async notifyDepositRejected(email: string, amount: string) {
    await this.sendEmail(
      email,
      "تم رفض طلب الإيداع - ميت جابر",
      `مرحباً،\n\nنأسف لإعلامك بأنه تم رفض طلب الإيداع بمبلغ ${amount} جنيه.\n\nيُرجى التأكد من أن الإيصال المُرفق صحيح وواضح، أو التواصل مع فريق الدعم عبر واتساب للمساعدة.\n\nفريق ميت جابر`
    );
  }
}

export const notificationService = new NotificationService();
