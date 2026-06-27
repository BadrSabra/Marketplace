# 06 — State Management Rules
**قواعد إدارة الحالة في الـ Frontend**

---

## نظرة عامة على الحالة في المشروع

```
┌─────────────────────────────────────────────────────┐
│              State Hierarchy                         │
│                                                      │
│  Server State   → TanStack Query (الأغلبية)          │
│  Auth State     → Context (useAuth hook)             │
│  Cart State     → Context (localStorage persistence) │
│  UI State       → useState محلي                      │
│  Form State     → react-hook-form                    │
│  Socket State   → Custom hook (use-chat-socket.ts)   │
└─────────────────────────────────────────────────────┘
```

---

## 1. Server State — TanStack Query

**القاعدة الذهبية:** أي بيانات تأتي من الـ API هي **Server State** وتُدار بـ TanStack Query حصراً.

```typescript
// ✅ الصواب: Server State في TanStack Query
function WalletPage() {
  const { data: wallet, isLoading } = useQuery({
    queryKey: ["/api/wallet"],
    // queryFn محدد globally في queryClient.ts
  });
}

// ❌ ممنوع: fetch() مباشر في Component
function WalletPage() {
  const [wallet, setWallet] = useState(null);
  useEffect(() => {
    fetch("/api/wallet").then(r => r.json()).then(setWallet); // ❌
  }, []);
}
```

### queryKey Convention
```typescript
// ✅ المورد بدون ID
queryKey: ["/api/wallet"]
queryKey: ["/api/orders"]
queryKey: ["/api/stores"]

// ✅ المورد مع ID (array segments)
queryKey: ["/api/orders", orderId]
queryKey: ["/api/products", { storeId }]
queryKey: ["/api/chat/rooms", roomId, "messages"]

// ❌ ممنوع: template literals كـ queryKey
queryKey: [`/api/orders/${orderId}`]  // ❌ لا يعمل cache invalidation بشكل صحيح
```

### Cache Invalidation
```typescript
// ✅ بعد كل mutation، أبطل الـ cache المتأثر
const mutation = useMutation({
  mutationFn: (data) => apiRequest("POST", "/api/orders", data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/wallet"] }); // الرصيد يتغير
  },
});
```

### staleTime
```typescript
// ✅ قيم افتراضية في queryClient.ts
defaultOptions: {
  queries: {
    staleTime: 5 * 60 * 1000,  // 5 دقائق للبيانات العامة
    retry: 1,                   // محاولة واحدة عند الفشل
  },
}

// ✅ تجاوز للبيانات الحساسة (wallet, orders)
useQuery({
  queryKey: ["/api/wallet"],
  staleTime: 30 * 1000,  // 30 ثانية فقط للرصيد
});
```

---

## 2. Auth State — Context

**المصدر الوحيد للحقيقة:** `useAuth()` hook المبني على `AuthContext`.

```typescript
// ✅ استخدم دائماً
const { user, isLoading } = useAuth();

// ❌ ممنوع: قراءة jwt_token مباشرة في component
const token = localStorage.getItem("jwt_token"); // ❌ في الـ components

// ✅ المقبول فقط في: api.ts و queryClient.ts
// (وهو موجود بالفعل وصحيح)
```

---

## 3. Cart State — Context + localStorage

```typescript
// القاعدة الحالية: Cart في React Context
// المشكلة: تُفقد عند إغلاق المتصفح
// الحل المطلوب (Sprint 2): localStorage persistence

// ✅ عند إضافة localStorage:
const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    // Hydrate من localStorage عند التهيئة
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    // Persist عند كل تغيير
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);
}
```

---

## 4. UI State — useState محلي

**القاعدة:** الحالة التي تخص Component واحد فقط تبقى محلية.

```typescript
// ✅ UI State محلية
function OrderCard({ order }: { order: Order }) {
  const [isExpanded, setIsExpanded] = useState(false); // ✅ محلي
  const [isCancelling, setIsCancelling] = useState(false); // ✅ محلي

  // ❌ ممنوع رفع هذه لـ Context عالمي
}
```

### متى ترفع الـ State للـ Context؟
```
✅ ارفع إلى Context إذا:
  - أكثر من 3 components تحتاجها
  - تحتاج مزامنة بين أجزاء مختلفة من الصفحة
  - هي Auth أو Cart أو إعدادات النظام

❌ لا ترفع إلى Context إذا:
  - component واحد فقط يستخدمها
  - هي loading state أو open/close لـ modal
```

---

## 5. Form State — react-hook-form

```typescript
// ✅ دائماً react-hook-form + zodResolver
const form = useForm<z.infer<typeof depositSchema>>({
  resolver: zodResolver(depositSchema),
  defaultValues: {
    amount: "",
    receiptImage: null,
  },
});

// ❌ ممنوع: useState لكل field
const [amount, setAmount] = useState("");
const [receipt, setReceipt] = useState(null);
// → يؤدي لـ re-renders كثيرة وصعوبة validation
```

---

## 6. Socket State — Custom Hook

```typescript
// ✅ Socket.IO state في hook مخصص
// المرجع: client/src/hooks/use-chat-socket.ts

// ❌ ممنوع: Socket.IO مباشرة في component
function ChatRoom() {
  const socket = io("http://..."); // ❌ connection جديدة مع كل render
}

// ✅ Socket singleton في hook
function useChatSocket(roomId: string) {
  // socket يُنشأ مرة واحدة ويُشارك
}
```

---

## 7. منع Race Conditions

```typescript
// ✅ Abort Controller للـ fetch requests (إذا استُخدمت)
useEffect(() => {
  const controller = new AbortController();
  // ...
  return () => controller.abort();
}, []);

// ✅ TanStack Query يتعامل مع race conditions تلقائياً
// (السبب الإضافي لاستخدامه بدلاً من fetch() اليدوي)

// ✅ في wallet mutations: Backend يستخدم SELECT FOR UPDATE
// لا تعتمد على Frontend لمنع double-submission
// Backend هو الضامن الأساسي لـ atomicity
```

---

## 8. Optimistic Updates (متى؟)

```typescript
// ✅ استخدم Optimistic Updates فقط إذا:
// - العملية تقريباً مضمونة النجاح
// - UX يُحسَّن بشكل واضح

// مثال مناسب: mark notification as read
const mutation = useMutation({
  mutationFn: (notifId) => apiRequest("PATCH", `/api/notifications/${notifId}/read`),
  onMutate: async (notifId) => {
    await queryClient.cancelQueries({ queryKey: ["/api/notifications"] });
    const previous = queryClient.getQueryData(["/api/notifications"]);
    queryClient.setQueryData(["/api/notifications"], (old) =>
      old?.map(n => n.id === notifId ? { ...n, isRead: true } : n)
    );
    return { previous };
  },
  onError: (err, notifId, context) => {
    queryClient.setQueryData(["/api/notifications"], context?.previous);
  },
});

// ❌ لا تستخدم Optimistic Updates لـ:
// - Payment operations (خطر مالي)
// - Order creation (تأثير على المخزون)
// - Wallet deductions
```

---

## القواعد الإلزامية

```
✦ SM-01: كل Server State في TanStack Query — لا useState لبيانات الـ API
✦ SM-02: queryKey يتبع URL pattern الـ API دائماً
✦ SM-03: كل mutation تُبطل الـ cache المتأثرة (invalidateQueries)
✦ SM-04: Auth State من useAuth() فقط — لا قراءة localStorage مباشرة في components
✦ SM-05: Form State بـ react-hook-form + zodResolver دائماً
✦ SM-06: Socket.IO في custom hook فقط — لا مباشرة في components
✦ SM-07: لا Optimistic Updates على العمليات المالية
✦ SM-08: Cart تُحفظ في localStorage لمنع فقدانها
✦ SM-09: UI State (modals, toggles) تبقى محلية في useState
```
