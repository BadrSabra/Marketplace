# 12 — Technical Debt Register
**سجل الديون التقنية مصنّفة حسب الأولوية**

---

## 🔴 Critical (يجب معالجتها في Sprint 1-2)

### TD-001: routes.ts ضخم جداً (~1200 سطر)
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | جميع الـ routes في ملف واحد — يصعب قراءته، اختباره، وإضافة features جديدة |
| **الأثر** | كل تغيير يخاطر بكسر routes أخرى؛ onboarding جديد يستغرق ساعات لفهمه |
| **الحل** | تقسيم إلى Router modules: auth.router.ts, wallet.router.ts, orders.router.ts... |
| **الجهد** | 3 أيام |
| **الأولوية** | Sprint 1 |

### TD-002: لا Unit Tests على الـ Service Layer
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | wallet.service.ts, order.service.ts, deliveryOffer.service.ts — لا tests |
| **الأثر** | أي refactoring أو feature جديد قد يكسر logic مالي بصمت |
| **الحل** | Jest + ts-jest، coverage ≥ 70% على services |
| **الجهد** | 7 أيام |
| **الأولوية** | Sprint 1-2 |

### TD-003: File Storage محلي
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | uploads/ على نفس الخادم — تُفقد عند أي deployment |
| **الأثر** | فقدان صور المنتجات والإيصالات والرخص — حرج تجارياً |
| **الحل** | AWS S3 أو Cloudinary مع Signed URLs |
| **الجهد** | 3 أيام |
| **الأولوية** | Sprint 1 (أول مهمة) |

### TD-004: لا JWT Blacklist ولا Refresh Token
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | JWT صالح 7 أيام، لا يُلغى عند logout، لا auto-renewal |
| **الأثر** | tokens مسروقة تبقى صالحة، UX سيئ عند انتهاء الجلسة |
| **الحل** | Redis Blacklist + Refresh Token endpoint |
| **الجهد** | 3 أيام |
| **الأولوية** | Sprint 1 |

---

## 🟠 High (يجب معالجتها في شهر 2-3)

### TD-005: Socket.IO بدون Redis Adapter
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | Chat لا يعمل في بيئة multi-instance |
| **الحل** | @socket.io/redis-adapter |
| **الجهد** | 1 يوم |
| **الأولوية** | مع إضافة Redis |

### TD-006: لا Redis/Caching
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | كل طلب يضرب DB — stores list و products list محملة في كل request |
| **الحل** | ioredis + Cache layer بـ TTL مناسب |
| **الجهد** | 3 أيام |
| **الأولوية** | Sprint 3 |

### TD-007: getStores() بدون Pagination
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | يجلب جميع المتاجر دفعة واحدة — memory overflow عند Scale |
| **الحل** | Cursor-based pagination أو Offset pagination |
| **الجهد** | 1 يوم |
| **الأولوية** | Sprint 2 |

### TD-008: storage.ts يحتاج تقسيماً
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | ملف storage.ts يجمع operations لـ users, wallets, stores, products, orders |
| **الحل** | تقسيم إلى: user.storage.ts, wallet.storage.ts, etc. |
| **الجهد** | 2 يوم |
| **الأولوية** | Sprint 3 |

### TD-009: Cart تُفقد عند تسجيل الخروج
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | Cart في React Context فقط، تُفقد عند logout أو إغلاق المتصفح |
| **الحل** | localStorage persistence أو DB-backed cart |
| **الجهد** | 2 يوم |
| **الأولوية** | Sprint 2 |

### TD-010: لا API Documentation
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | لا Swagger، لا OpenAPI — مستحيل بيع الـ API للـ B2B |
| **الحل** | swagger-ui-express + openapi specs لكل endpoint |
| **الجهد** | 3 أيام |
| **الأولوية** | Sprint 1 |

---

## 🟡 Medium (يجب معالجتها في شهر 3-4)

### TD-011: لا Integration Tests للمسارات الرئيسية
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | Order creation → payment → delivery → OTP flow بدون automated test |
| **الحل** | Supertest + test database |
| **الجهد** | 5 أيام |
| **الأولوية** | Sprint 3-4 |

### TD-012: UUID Validation غير موحّد
| الحقل | التفاضيل |
|-------|---------|
| **الوصف** | UUID validation مكرر في عدة controllers بدون helper موحّد |
| **الحل** | استخراج `validateUUID(id)` → `server/utils/validation.ts` |
| **الجهد** | 2 ساعة |
| **الأولوية** | Sprint 2 |

### TD-013: Auth logic في routes.ts
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | register و login handlers (~150 سطر) مباشرة في routes.ts |
| **الحل** | نقل إلى `server/modules/auth/auth.service.ts` |
| **الجهد** | 1 يوم |
| **الأولوية** | مع تقسيم routes.ts |

### TD-014: Error Response Format غير موحّد
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | بعض errors تُعيد `{ message }` وأخرى `{ error: { code, message } }` |
| **الحل** | `createErrorResponse()` factory موحّد |
| **الجهد** | 1 يوم |
| **الأولوية** | Sprint 2 |

---

## 🔵 Low (طويل المدى)

### TD-015: `support_messages` جدول Legacy غير مستخدم
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | جدول قديم، النظام الحالي يستخدم chat_rooms بالكامل |
| **الحل** | حذف الجدول + cleanup من schema.ts (بعد confirm أنه فعلاً غير مستخدم) |
| **الجهد** | ساعة |
| **الأولوية** | Sprint 5+ |

### TD-016: بعض Admin Stats تقوم بـ N+1
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | `/api/admin/stats` يُجري استعلامات منفصلة لكل metric |
| **الحل** | استعلام مُجمَّع واحد أو Redis caching |
| **الجهد** | 1 يوم |
| **الأولوية** | Sprint 4 |

### TD-017: ملفات Debug في الجذر
| الحقل | التفاصيل |
|-------|---------|
| **الوصف** | ملفات JSON وتقارير من جلسات debug موجودة في الجذر |
| **الحل** | إضافة للـ .gitignore وحذف من الـ repo |
| **الجهد** | 30 دقيقة |
| **الأولوية** | Sprint 1 (cleanup) |
