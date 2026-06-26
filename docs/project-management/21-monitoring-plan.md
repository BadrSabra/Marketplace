# 21 — Monitoring Plan
**خطة المراقبة والتتبع الكاملة**

---

## 1. Logs

### الحالي
```
✅ server/index.ts: log() function موجودة
✅ Audit Logs: في DB (audit_logs table)
❌ Structured logging (JSON format)
❌ Log aggregation tool
❌ Log retention policy
```

### المستهدف
```
الأداة:       Pino (JSON structured logging) أو Winston
الـ Format:   JSON مع timestamp, level, requestId, userId, route
Aggregation: Loki + Grafana (self-hosted) أو Datadog (cloud)

مستويات الـ Logs:
  ERROR — أخطاء تحتاج تدخلاً فورياً
  WARN  — حالات غير طبيعية (rate limit، retry)
  INFO  — عمليات عادية (request/response، auth)
  DEBUG — تفاصيل للتطوير فقط (disabled in production)
```

### ما يُسجَّل
```
كل HTTP request: method, path, statusCode, responseTime, userId
كل DB query خطأ: query, error, userId
كل Auth attempt: email, success/fail, ip
كل Payment event: transactionId, amount, status
كل OTP operation: subOrderId, action, result
Socket.IO connections: userId, room, event
```

---

## 2. Metrics (مقاييس الأداء)

**الأداة:** Prometheus + Grafana

### System Metrics
```
cpu_usage_percent              — استخدام المعالج
memory_used_mb                 — الذاكرة المستخدمة
active_connections             — اتصالات نشطة
db_connection_pool_size        — pool size
db_active_queries              — استعلامات نشطة
redis_memory_used              — ذاكرة Redis
```

### Application Metrics
```
http_requests_total{method, route, status}   — إجمالي الطلبات
http_request_duration_ms{route, percentile}  — وقت الاستجابة
http_errors_total{route, error_code}         — إجمالي الأخطاء

auth_login_attempts_total{success}           — محاولات تسجيل الدخول
auth_register_attempts_total{role}           — تسجيلات جديدة

orders_created_total                         — طلبات جديدة
orders_completed_total                       — طلبات مكتملة
orders_cancelled_total                       — طلبات ملغاة

payments_processed_total{status}             — المعاملات المالية
payment_amount_total                         — إجمالي المدفوعات

socket_connections_active                    — اتصالات WebSocket
```

### Business Metrics
```
active_customers_daily                       — عملاء نشطون يومياً
active_drivers_daily                         — سائقون نشطون
active_stores_total                          — متاجر نشطة
orders_per_hour                              — طلبات/ساعة
average_delivery_time_minutes                — متوسط وقت التوصيل
platform_commission_daily                    — عمولة يومية
wallet_balance_total                         — إجمالي الأرصدة
```

---

## 3. Distributed Tracing

**الأداة:** OpenTelemetry + Jaeger (مستقبل)

```
الغرض: تتبع request عبر كل الطبقات
  HTTP Request → Middleware → Controller → Service → DB
  
مفيد لـ:
  - تحديد الـ bottleneck في أي request
  - تتبع flow الطلب في multi-service (مستقبل)
```

---

## 4. Alerts (التنبيهات)

### 🔴 Critical Alerts (تدخل فوري)

| المقياس | الشرط | القناة |
|---------|-------|-------|
| Error Rate | > 5% في 5 دقائق | SMS + Slack |
| DB Down | connection fails | SMS + Slack |
| Memory | > 90% لـ 3 دقائق | Slack |
| API Response | P99 > 5000ms | Slack |
| Failed Payments | > 10 failures/hour | SMS + Slack |
| Server Down | health check fails | SMS + Slack |

### 🟠 Warning Alerts (متابعة)

| المقياس | الشرط | القناة |
|---------|-------|-------|
| Error Rate | > 1% في 15 دقيقة | Slack |
| Memory | > 75% | Slack |
| CPU | > 80% لـ 10 دقائق | Slack |
| API Response | P95 > 1000ms | Slack |
| DB Pool | > 80% مستخدم | Slack |
| Redis Down | connection fails | Slack |
| Disk Usage | > 80% | Slack |

---

## 5. Health Checks

### Internal (التطبيق)
```
GET /api/health
→ { status: "ok", timestamp, version }

GET /api/admin/health (ADMIN only)
→ {
    status: "ok",
    db: { status: "connected", latency: 12, pool: { active: 3, idle: 17 } },
    redis: { status: "connected" },
    memory: { used: 145, total: 512 },
    uptime: 86400,
    version: "1.0.0"
  }
```

### External (Uptime Monitoring)
```
الأداة:   Uptime Robot (مجاني للخطط الصغيرة)
الفحص كل: 5 دقائق
Endpoints:
  https://mitgaber.com/api/health
  https://mitgaber.com/ (frontend)

التنبيه عند: downtime > 1 دقيقة
القناة:       Email + SMS
```

---

## 6. Crash Reports

**الأداة:** Sentry.io

```typescript
// server/index.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% من requests للـ performance
});

// Capture uncaught errors
process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason);
});
```

**ما يُرسَل لـ Sentry:**
- جميع الـ unhandled exceptions
- الأخطاء في DB transactions
- Payment failures
- تفاصيل الخطأ + stack trace + request context

**ما لا يُرسَل:**
- كلمات مرور، JWT tokens، OTPs
- بيانات شخصية (email, phone)

---

## 7. Dashboard

### لوحة Grafana الرئيسية
```
Row 1: System Health
  [CPU %] [Memory %] [DB Connections] [Redis Status]

Row 2: Traffic
  [Requests/min] [Error Rate %] [Avg Response Time] [P95 Response]

Row 3: Business
  [Orders Today] [Revenue Today] [Active Users] [New Registrations]

Row 4: Financial
  [Successful Payments] [Failed Payments] [Total Commission] [Withdrawals]

Row 5: Alerts History
  [Last 24h alerts] [Unresolved issues]
```

---

## 8. Monthly Review

```
كل شهر:
✅ مراجعة error rate trends
✅ مراجعة performance metrics
✅ مراجعة top failing routes
✅ مراجعة DB slow queries (> 100ms)
✅ npm audit للـ security vulnerabilities
✅ تجديد SSL certificates (تلقائي مع Let's Encrypt)
✅ اختبار Disaster Recovery plan (restore backup)
```
