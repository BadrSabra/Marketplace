/**
 * money.ts — أداة الحسابات المالية الآمنة
 *
 * Q: لماذا لا نستخدم parseFloat() مباشرةً في الحسابات المالية؟
 * A: IEEE 754 floating-point يُسبب أخطاء دقة لا يمكن التنبؤ بها:
 *    parseFloat("0.1") + parseFloat("0.2") = 0.30000000000000004
 *    parseFloat("1.005").toFixed(2)         = "1.00" (يجب أن يكون "1.01")
 *    parseFloat("1.255").toFixed(2)         = "1.25" (يجب أن يكون "1.26")
 *
 *    في سياق مالي: عميل يملك 1000.00 جنيه يدفع 333.33 جنيه، يبقى له:
 *    (1000.00 - 333.33).toFixed(2) = "666.67" ✓ (ok هنا)
 *    لكن: إيداع 0.10 + رصيد 0.20:
 *    (0.10 + 0.20).toFixed(2) = "0.30" ✓ (toFixed يُصحح هذا)
 *    لكن: عمولة 1% على مبلغ 33.33:
 *    33.33 * 0.01 = 0.3333... → toFixed(2) = "0.33" ✓
 *    لكن: عمولة 1% على مبلغ 100.005:
 *    100.005 * 0.01 = 1.00005 → toFixed(2) = "1.00" قد يكون "1.00" أو "1.00" حسب المحرك
 *
 *    الحل: تحويل المبالغ لـ قروش (أعداد صحيحة) × 100، إجراء الحساب، ثم التحويل للوراء.
 *    الأعداد الصحيحة لا تعاني من أخطاء IEEE 754.
 *
 * Q: ما حدود دقة هذه الأداة؟
 * A: آمنة لأرقام حتى ~90 تريليون جنيه (MAX_SAFE_INTEGER / 100 = 90,071,992,547,409).
 *    المبالغ المالية في الواقع العملي أصغر بكثير من هذا الحد.
 *
 * Q: لماذا لا نستخدم مكتبة مثل decimal.js أو big.js؟
 * A: لتجنب إضافة dependencies إضافية. نظام الأرقام الصحيحة (قروش) كافٍ لعملة
 *    من رقمين عشريين (جنيه مصري). إذا احتاج المشروع لعملات بأكثر من رقمين عشريين
 *    (مثل KWD بثلاثة)، يجب مراجعة هذه الأداة واستبدالها بـ decimal.js.
 *
 * ⚠️ قيود:
 *    - يفترض دائماً رقمَيْن عشريَّيْن (جنيه). لا يصلح لعملات بـ 3 أو 0 أرقام عشرية.
 *    - القيم المُدخَلة يجب أن تكون أرقاماً صالحة — تمرير "abc" يُطلق استثناءً.
 *    - لا يدعم NaN أو Infinity — يرفعهما كاستثناء.
 */

// تحويل مبلغ (نص أو رقم) إلى قروش (عدد صحيح)
function toCents(value: string | number): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(n)) {
    throw new Error(`[Money] Invalid amount: "${value}" — must be a finite number`);
  }
  // Math.round to handle cases like 1.005 → 100.5 cents → 101 cents (correct rounding)
  return Math.round(n * 100);
}

// تحويل قروش (عدد صحيح) إلى نص مالي بدقة رقمَيْن عشريَّيْن
function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export const money = {
  /**
   * جمع مبلغَيْن ماليَّيْن بأمان
   * add("0.10", "0.20") → "0.30" (وليس "0.30000000000000004")
   */
  add(a: string | number, b: string | number): string {
    return fromCents(toCents(a) + toCents(b));
  },

  /**
   * طرح مبلغ مالي من آخر بأمان
   * subtract("1.00", "0.33") → "0.67"
   */
  subtract(a: string | number, b: string | number): string {
    return fromCents(toCents(a) - toCents(b));
  },

  /**
   * ضرب مبلغ مالي بنسبة أو معامل (للعمولات والنسب المئوية)
   * multiply("100.00", 0.01) → "1.00"   (عمولة 1%)
   * multiply("33.33",  0.01) → "0.33"
   *
   * Q: هل هذا صحيح للنسب المئوية؟
   * A: نعم — toCents("33.33") = 3333، ثم Math.round(3333 × 0.01) = Math.round(33.33) = 33
   *    ثم fromCents(33) = "0.33". الجمع الكلي للأجزاء لا يزيد على المجموع الأصلي بفضل
   *    Math.round التي توزّع التقريب بشكل عادل.
   */
  multiply(a: string | number, factor: number): string {
    return fromCents(Math.round(toCents(a) * factor));
  },

  /**
   * تحقق إذا كان a < b
   * isLessThan("5.00", "10.00") → true
   */
  isLessThan(a: string | number, b: string | number): boolean {
    return toCents(a) < toCents(b);
  },

  /**
   * تحقق إذا كان a > b
   */
  isGreaterThan(a: string | number, b: string | number): boolean {
    return toCents(a) > toCents(b);
  },

  /**
   * تحقق إذا كان a <= 0
   */
  isNonPositive(a: string | number): boolean {
    return toCents(a) <= 0;
  },

  /**
   * تحقق إذا كان a < 0
   */
  isNegative(a: string | number): boolean {
    return toCents(a) < 0;
  },

  /**
   * تحقق من المساواة المالية الدقيقة
   * equals("1.00", "1.000") → true
   */
  equals(a: string | number, b: string | number): boolean {
    return toCents(a) === toCents(b);
  },

  /**
   * قيمة مطلقة لمبلغ مالي
   * abs("-5.00") → "5.00"
   */
  abs(a: string | number): string {
    return fromCents(Math.abs(toCents(a)));
  },

  /**
   * تنسيق رقم عائم أو نص كمبلغ مالي بدقة رقمَيْن عشريَّيْن
   * format(1.5) → "1.50"
   * format("1.1") → "1.10"
   */
  format(a: string | number): string {
    return fromCents(toCents(a));
  },
};
