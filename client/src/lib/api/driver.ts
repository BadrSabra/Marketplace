import { apiFetch } from "../api";

export type AvailableTask = {
  sub_order_id: string;
  order_id: string;
  store_id: string;
  store_name: string;
  customer_name: string;
  customer_address: string;
  items: { product_name: string; quantity: number }[];
  subtotal: number;
  created_at: string;
  status: string;
  assigned_driver_id: string | null;
  driver_offer_id?: string | null;
  driver_offer_status?: string | null;
  driver_offered_fee?: string | null;
  driver_counter_offered_fee?: string | null;
};

// Q: لماذا نُعرّف OrderLevelTask منفصلاً عن AvailableTask؟
// A: AvailableTask تمثّل طلباً فرعياً واحداً — وهو السبب الجذري للمشكلة.
//    OrderLevelTask تجمع كل الطلبات الفرعية لنفس الطلب الرئيسي في كيان واحد،
//    مما يسمح بعرض بطاقة واحدة للسائق بدلاً من بطاقة لكل متجر.
export type OrderLevelTask = {
  order_id: string;
  customer_name: string;
  customer_address: string;
  sub_orders: {
    sub_order_id: string;
    store_name: string;
    items: { product_name: string; quantity: number }[];
    subtotal: number;
  }[];
  total_subtotal: number;
  created_at: string;
  driver_offer_status: string | null;
  driver_offered_fee: string | null;
  driver_counter_offered_fee: string | null;
};

// Q: ما هو شكل بيانات عروض الطلب الكاملة التي يراها العميل؟
// A: GroupedOrderOffer يجمع عروض سائق واحد لكل الطلبات الفرعية في عرض موحّد.
//    كل سائق لديه عرض واحد فقط بدلاً من عرض لكل طلب فرعي.
export type GroupedOrderOffer = {
  driverId: string;
  driverName: string;
  driverTransportType: string | null;
  offeredFee: string;
  counterOfferedFee: string | null;
  status: 'PENDING' | 'COUNTERED';
};

export type ActiveDelivery = {
  id: string;
  orderId: string;
  status: string;
  subtotal: string;
  customerName: string;
  customerPhone: string;
  // Q: لماذا أُضيف updatedAt هنا؟
  // A: الـ API يُعيد هذا الحقل فعلاً (انظر suborder.service.ts → select updatedAt).
  //    كان غائباً من التعريف فيما active-delivery.tsx يستخدمه لحساب العداد التنازلي.
  //    غيابه من النوع يعني أن TypeScript لا يُبلّغ عن خطأ لكن في وقت التشغيل تعمل
  //    الدالة calcTimeLeft(undefined) وتُرجع NaN ثم يُحسب Math.max(0, NaN) = 0،
  //    مما يُظهر العداد على "0:00" عند تحميل الصفحة.
  updatedAt?: string;
  items: { productName: string; quantity: number }[];
  storeName?: string;
  hasOtp?: boolean;
};

export async function getDriverTasks(): Promise<ActiveDelivery[]> {
  try {
    const res = await apiFetch("/api/suborders/active");
    const data = await res.json();
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return [data];
  } catch (err: any) {
    if (err.message?.includes("401") || err.message?.includes("403") || err.message?.includes("Forbidden") || err.message?.includes("Unauthorized")) {
      return [];
    }
    throw err;
  }
}

export async function getAvailableOffers(): Promise<AvailableTask[]> {
  try {
    const res = await apiFetch("/api/delivery/available-tasks");
    const data = await res.json();
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.tasks && Array.isArray(data.tasks)) return data.tasks;
    return [];
  } catch (err: any) {
    if (err.message?.includes("403") || err.message?.includes("Forbidden")) {
      return [];
    }
    throw err;
  }
}

// Q: لماذا نُنشئ getAvailableOrderTasks بدلاً من تعديل getAvailableOffers؟
// A: getAvailableOffers تُعيد AvailableTask[] (طلب فرعي واحد لكل عنصر).
//    getAvailableOrderTasks تُعيد OrderLevelTask[] (كل طلبات متجر في عنصر واحد).
//    استبدالها مباشرةً سيكسر أي مكون لا يزال يستخدم AvailableTask.
//    إنشاء دالة جديدة يسمح بالترحيل التدريجي دون تأثير على الكود القائم.
export async function getAvailableOrderTasks(): Promise<OrderLevelTask[]> {
  try {
    const res = await apiFetch("/api/delivery/available-order-tasks");
    const data = await res.json();
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return [];
  } catch (err: any) {
    if (err.message?.includes("403") || err.message?.includes("Forbidden")) {
      return [];
    }
    throw err;
  }
}

export async function submitOffer(subOrderId: string, proposedFee: number) {
  const res = await apiFetch(`/api/delivery/suborders/${subOrderId}/offer`, {
    method: "POST",
    body: JSON.stringify({ proposedFee }),
  });
  return res.json();
}

// Q: لماذا نُنشئ submitOrderOffer بدلاً من تعديل submitOffer؟
// A: submitOffer يُرسل عرضاً لطلب فرعي واحد (sub-order) — يبقى صالحاً للاستخدامات الأخرى.
//    submitOrderOffer يُرسل عرضاً واحداً للطلب كاملاً (all sub-orders) مع orderId.
export async function submitOrderOffer(orderId: string, proposedFee: number) {
  const res = await apiFetch(`/api/delivery/orders/${orderId}/offer`, {
    method: "POST",
    body: JSON.stringify({ proposedFee }),
  });
  return res.json();
}

export async function acceptCounterOffer(offerId: string) {
  const res = await apiFetch(`/api/delivery/offers/${offerId}/accept-counter`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function acceptOrderCounterOffer(orderId: string) {
  const res = await apiFetch(`/api/delivery/orders/${orderId}/offers/accept-counter`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function acceptTask(subOrderId: string) {
  const res = await apiFetch(`/api/delivery/suborders/${subOrderId}/accept`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function verifyOtp(subOrderId: string, otpCode: string) {
  const res = await apiFetch(`/api/delivery/otp/verify/${subOrderId}`, {
    method: "POST",
    body: JSON.stringify({ otpCode }),
  });
  return res.json();
}

export async function getDriverWallet(): Promise<{ balance: string; currency?: string }> {
  try {
    const res = await apiFetch("/api/wallet");
    return res.json();
  } catch {
    return { balance: "0.00" };
  }
}

export async function getWalletTransactions(page = 1, limit = 20): Promise<{ transactions: any[]; total: number }> {
  try {
    const res = await apiFetch(`/api/ledger/transactions?limit=${limit}&offset=${(page - 1) * limit}`);
    return res.json();
  } catch {
    return { transactions: [], total: 0 };
  }
}
