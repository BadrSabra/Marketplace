export interface AvailableTaskDTO {
  sub_order_id: string;
  order_id: string;
  store_id: string;
  store_name: string;
  customer_name: string;
  customer_address: string;
  items: { product_name: string; quantity: number }[];
  subtotal: number;
  created_at: string;
  status: 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT';
  assigned_driver_id?: string | null;
  driver_offer_id?: string | null;
  driver_offer_status?: string | null;
  driver_offered_fee?: string | null;
  driver_counter_offered_fee?: string | null;
}

// Q: لماذا نُنشئ OrderLevelTask بدلاً من استخدام AvailableTaskDTO مباشرةً؟
// A: AvailableTaskDTO يمثّل طلباً فرعياً واحداً (sub-order) — وهو السبب الجذري للمشكلة:
//    عندما يحتوي الطلب الرئيسي على طلبين فرعيين (من متجرين مختلفين)، يظهر السائق
//    بطاقتان منفصلتان، كل منهما بزر "تقديم عرض سعر" خاص بها.
//    OrderLevelTask يجمع جميع الطلبات الفرعية لنفس الطلب في كيان واحد، مما يسمح
//    بعرض بطاقة واحدة للسائق وقسم عروض توصيل واحد للعميل.
export interface OrderLevelTask {
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
  // حالة عرض السائق الحالي لهذا الطلب
  // Q: كيف نحدد حالة موحدة للسائق عندما يكون لديه عروض على طلبات فرعية متعددة؟
  // A: إذا كان أي عرض في حالة COUNTERED، نعرض الحالة COUNTERED (الأولوية للعميل).
  //    إذا كانت جميع العروض PENDING، نعرض PENDING.
  //    إذا كانت جميع العروض ACCEPTED، نعرض ACCEPTED (لمنع تقديم عرض ثانٍ).
  driver_offer_status: string | null;
  driver_offered_fee: string | null;
  driver_counter_offered_fee: string | null;
}

// Q: لماذا نُعرّف GroupedOrderOffer منفصلاً عن OrderLevelTask؟
// A: OrderLevelTask هو ما يرى السائق (مهمة متاحة للتقديم عليها).
//    GroupedOrderOffer هو ما يرى العميل (عروض السائقين المتقدمين).
//    كلاهما يعمل على مستوى الطلب الكامل، لكن المستخدم والهدف مختلفان.
export interface GroupedOrderOffer {
  driverId: string;
  driverName: string;
  driverTransportType: string | null;
  offeredFee: string;
  counterOfferedFee: string | null;
  status: 'PENDING' | 'COUNTERED';
}

export interface GetAvailableTasksFilters {
  page?: number;
  limit?: number;
  store_id?: string;
  category?: string;
}
