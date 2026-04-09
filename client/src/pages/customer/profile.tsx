import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2, Save, User, Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

// Q: لماذا يحتوي ملف العميل الشخصي على حقل transportType (وسيلة النقل)؟
// A: هذا يبدو تصميماً مقصوداً من فريق المنتج — العملاء يمكنهم تحديد وسيلة نقلهم
//    المفضلة للاستخدام في توقعات التوصيل أو تصفية العروض مستقبلاً. الحقل موجود في
//    جدول users لجميع الأدوار (وليس مقيداً بالسائقين في schema.ts). الـ PATCH
//    /api/customer/profile في الخادم يقبله صراحةً ويحفظه في قاعدة البيانات.
//    الخطر الحالي: القيمة الافتراضية "Walk" تُحفظ عند أول تسجيل للعميل حتى لو لم
//    يختر شيئاً — مما قد يُلوّث الإحصاءات والفلاتر بقيم غير مقصودة. الإصلاح
//    المستقبلي: استخدام z.string().optional() وإزالة defaultValues.transportType
//    لإرسال undefined بدلاً من "Walk" إذا لم يختر العميل شيئاً.
const profileSchema = z.object({
  name: z
    .string()
    .min(2, "الاسم يجب أن يكون حرفين على الأقل")
    .max(50, "الاسم طويل جداً (50 حرف كحد أقصى)")
    .regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, "الاسم يجب أن يحتوي على أحرف فقط"),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-]{7,15}$/, "رقم الهاتف غير صحيح")
    .or(z.literal("")),
  transportType: z.string().min(1, "يرجى اختيار وسيلة النقل"),
  addresses: z.array(z.string().min(1, "العنوان لا يمكن أن يكون فارغاً")),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function CustomerProfile() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/customer/profile"],
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
      transportType: "Walk",
      addresses: [],
    },
    values: user
      ? {
          name: (user as any).name || "",
          phone: (user as any).phone || "",
          transportType: (user as any).transportType || "Walk",
          addresses: (user as any).addresses?.length ? (user as any).addresses : [],
        }
      : undefined,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "addresses" as never,
  });

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      const res = await apiRequest("PATCH", "/api/customer/profile", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "تم حفظ التغييرات",
        description: "تم تحديث ملفك الشخصي بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "فشل التحديث",
        description: error.message || "حدث خطأ أثناء حفظ البيانات",
        variant: "destructive",
      });
    },
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    const formData = new FormData();
    formData.append("avatar", file);

    setIsUploadingAvatar(true);
    try {
      const res = await apiFetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/customer/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "تم رفع الصورة بنجاح" });
    } catch (err: any) {
      toast({
        title: "فشل رفع الصورة",
        description: err.message || "حدث خطأ أثناء الرفع",
        variant: "destructive",
      });
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="xl" />
      </div>
    );
  }

  const currentAvatar = avatarPreview || (user as any)?.avatarUrl || "";
  const userInitial = ((user as any)?.name || "م").charAt(0).toUpperCase();
  const isDirty = form.formState.isDirty;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950" dir="rtl">
      <Navbar />
      <main className="flex-grow container px-4 py-8 max-w-2xl mx-auto">
        <Card className="shadow-md">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold">إدارة الملف الشخصي</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((v) => profileMutation.mutate(v))}
                className="space-y-6"
              >
                {/* Avatar Upload Section */}
                <div className="flex flex-col items-center gap-3 pb-4">
                  <div className="relative group">
                    <Avatar className="h-28 w-28 border-4 border-primary/20 shadow-lg">
                      <AvatarImage src={currentAvatar} alt="صورة الملف الشخصي" />
                      <AvatarFallback className="text-3xl font-bold bg-primary/10 text-primary">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      data-testid="button-change-avatar"
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="h-7 w-7 text-white animate-spin" />
                      ) : (
                        <Camera className="h-7 w-7 text-white" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="gap-2"
                    data-testid="button-upload-avatar"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {isUploadingAvatar ? "جاري الرفع..." : "تغيير الصورة الشخصية"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                    data-testid="input-avatar-file"
                  />
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WEBP – الحد الأقصى 5 ميجابايت
                  </p>
                </div>

                {/* Name & Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel>الاسم الكامل</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-name"
                            className="text-right"
                            placeholder="أدخل اسمك الكامل"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem className="text-right">
                    <FormLabel>البريد الإلكتروني (للقراءة فقط)</FormLabel>
                    <Input
                      value={(user as any)?.email || ""}
                      disabled
                      className="bg-muted text-right text-muted-foreground"
                      data-testid="input-email"
                    />
                  </FormItem>
                </div>

                {/* Phone & Transport */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel>رقم الهاتف</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-phone"
                            className="text-right"
                            placeholder="01xxxxxxxxx"
                            type="tel"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="transportType"
                    render={({ field }) => (
                      <FormItem className="text-right">
                        <FormLabel>وسيلة النقل المفضلة</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger
                              data-testid="select-transport"
                              className="text-right"
                            >
                              <SelectValue placeholder="اختر وسيلة النقل" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Walk">مشياً</SelectItem>
                            <SelectItem value="Bike">دراجة</SelectItem>
                            <SelectItem value="Car">سيارة</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Delivery Addresses */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append("")}
                      className="gap-2"
                      data-testid="button-add-address"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة عنوان
                    </Button>
                    <FormLabel className="text-right">عناوين التسليم</FormLabel>
                  </div>
                  {fields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-right">
                      لم تُضف أي عناوين بعد
                    </p>
                  )}
                  {fields.map((field, index) => (
                    <FormField
                      key={field.id}
                      control={form.control}
                      name={`addresses.${index}` as const}
                      render={({ field }) => (
                        <FormItem className="text-right">
                          <div className="flex gap-2 items-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="text-destructive shrink-0"
                              data-testid={`button-remove-address-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid={`input-address-${index}`}
                                className="text-right"
                                placeholder={`العنوان ${index + 1}`}
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={!isDirty || profileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {profileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  حفظ التغييرات
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
