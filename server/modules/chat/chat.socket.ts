import { Server as SocketServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { chatService } from "./chat.service";

const JWT_SECRET = process.env.JWT_SECRET!;

// Q: لماذا نُحدّد حداً أقصى لطول رسائل الدردشة؟
// A: بدون هذا الحد يمكن لأي مستخدم مُصادَق إرسال رسالة بحجم 10 ميغابايت أو أكثر.
//    كل رسالة كهذه:
//    1. تُخزَّن في DB (استهلاك دائم للتخزين)
//    2. تُبثّ عبر io.to(roomId) لجميع المشاركين (ضغط الذاكرة والشبكة)
//    3. يُعاد تحميلها في كل طلب getMessages (O(n) على الحجم)
//    الحل: حد أقصى 4000 حرف — ما يكفي لرسائل مفصّلة مع الحفاظ على الأداء.
//
// ⚠️ خطأ جديد تكشفه هذه الإصلاح:
//    مستخدمون كانوا يُرسلون رسائل طويلة (نادراً) سيحصلون الآن على رسالة خطأ بدلاً
//    من الإرسال. يجب إضافة counter في الـ UI يُظهر عدد الأحرف المتبقية.
const MAX_MESSAGE_LENGTH = 4000;

// Q: هل UUID_REGEX ضروري في socket handlers؟
// A: نعم — الـ socket.io handlers تستقبل بيانات خام من العميل مباشرةً دون أي تحقق
//    middleware. إذا أرسل المستخدم roomId = "abc" أو "' OR 1=1 --"، فإن كل DB query
//    تستقبله ستُطلق خطأ PostgreSQL "invalid input syntax for type uuid" يُسبب
//    استجابة 500 غير موثوقة في بيئة WebSocket تفتقر للمعالجة الاستثنائية المركزية.
//    الإصلاح: التحقق من تنسيق UUID قبل أي استعلام DB.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export let io: SocketServer;

export function initChatSocket(httpServer: HttpServer) {
  // Q: لماذا كان cors: { origin: "*" } خطيراً وكيف نُصلحه؟
  // A: `origin: "*"` يسمح لأي موقع على الإنترنت بفتح اتصال WebSocket مع خادمنا
  //    والمصادقة عليه بتوكن JWT سرقه (عبر XSS من موقع آخر مثلاً). في بيئة Replit
  //    لا يوجد متغير CORS_ORIGIN ثابت، لذا نستخدم دالة تتحقق ديناميكياً من Origin.
  //    في بيئة التطوير نسمح بأي origin (لأن الـ dev server يعمل على ports مختلفة).
  //    في الإنتاج نسمح فقط بأصل process.env.ALLOWED_ORIGIN (إن عُيِّن) أو بأي origin
  //    مؤقتاً إذا لم يُعيَّن (لحين تهيئة متغيرات البيئة في النشر).
  //
  // ⚠️ خطأ جديد تكشفه هذا الإصلاح:
  //    مكتبات العميل التي تتصل مباشرةً من devtools أو Postman ستبدأ في رفض اتصالاتها
  //    بعد تعيين ALLOWED_ORIGIN في البيئة. يجب إضافة origin موقع الـ dev frontend
  //    لقائمة المسموح بها عند نشر بيئة staging منفصلة.
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production" && allowedOrigin
        ? allowedOrigin
        : "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("UNAUTHORIZED"));
    try {
      const decoded = jwt.verify(token as string, JWT_SECRET) as { id: string; role: string };
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user as { id: string; role: string };

    socket.on("join_room", async (roomId: string) => {
      // Q: هل يجب التحقق من UUID قبل الاستعلام عن المشاركين؟
      // A: نعم — socket.io handlers تستقبل بيانات خام. إذا أرسل العميل roomId = "abc"
      //    فإن pool.query بداخل getRoomParticipants سيُطلق PostgreSQL error غير معالَج
      //    يُفشل الـ handler بصمت. الإصلاح: التحقق المبكر قبل أي DB query.
      if (typeof roomId !== "string" || !UUID_REGEX.test(roomId)) {
        socket.emit("error", { message: "معرّف الغرفة غير صالح" });
        return;
      }
      try {
        const participants = await chatService.getRoomParticipants(roomId);
        const isParticipant = participants.some(p => p.user_id === user.id);
        if (!isParticipant) {
          socket.emit("error", { message: "غير مصرح بالدخول لهذه الغرفة" });
          return;
        }
        socket.join(roomId);
        await chatService.markRead(roomId, user.id);
      } catch (err) {
        socket.emit("error", { message: "حدث خطأ" });
      }
    });

    socket.on("send_message", async ({ roomId, content }: { roomId: string; content: string }) => {
      try {
        // Q: لماذا نتحقق من roomId و content معاً قبل استدعاء sendMessage؟
        // A: كلاهما مدخلات خارجية غير موثوقة:
        //    - roomId غير UUID → PostgreSQL error غير معالَج (كما شُرح في join_room)
        //    - content فارغ → sendMessage تُخزِّن رسالة فارغة في DB
        //    - content طويل جداً → DoS بملء مساحة DB + إبطاء البث للمشاركين
        //    الإصلاح: رفض مبكر بدلاً من الوصول للـ DB ثم الفشل.
        if (typeof roomId !== "string" || !UUID_REGEX.test(roomId)) {
          socket.emit("error", { message: "معرّف الغرفة غير صالح" });
          return;
        }
        if (!content?.trim()) return;
        if (content.trim().length > MAX_MESSAGE_LENGTH) {
          socket.emit("error", { message: `الرسالة طويلة جداً — الحد الأقصى ${MAX_MESSAGE_LENGTH} حرفاً` });
          return;
        }
        const msg = await chatService.sendMessage(roomId, user.id, content.trim());
        io.to(roomId).emit("new_message", msg);

        const participants = await chatService.getRoomParticipants(roomId);
        for (const p of participants) {
          if (p.user_id !== user.id) {
            io.to(`user:${p.user_id}`).emit("unread_update", { roomId });
          }
        }
      } catch (err: any) {
        socket.emit("error", { message: err.message === "NOT_PARTICIPANT" ? "غير مصرح" : "حدث خطأ" });
      }
    });

    socket.on("mark_read", async (roomId: string) => {
      try {
        await chatService.markRead(roomId, user.id);
        socket.emit("marked_read", { roomId });
      } catch {}
    });

    socket.on("leave_room", (roomId: string) => {
      socket.leave(roomId);
    });

    socket.join(`user:${user.id}`);
  });

  return io;
}

export function emitSystemMessage(roomId: string, content: string) {
  if (!io) return;
  // BUG-FIX: Using Date.now() alone risks duplicate IDs if two system messages fire
  // within the same millisecond (e.g., during bulk order processing), causing React
  // key prop collisions and rendering glitches. Append a random suffix to guarantee uniqueness.
  const uniqueId = `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  io.to(roomId).emit("new_message", {
    id: uniqueId,
    roomId,
    senderId: null,
    content,
    type: "SYSTEM",
    createdAt: new Date().toISOString(),
    senderName: "النظام",
    senderRole: "SYSTEM",
  });
}
