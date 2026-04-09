import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, Truck, Save, Camera, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";

export default function DriverProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingLicense, setIsUploadingLicense] = useState(false);

  const form = useForm({
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      transportType: user?.transportType || "",
      avatarUrl: user?.avatarUrl || "",
      driversLicenseUrl: user?.driversLicenseUrl || "",
    }
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const payload: any = {};
      if (data.phone) payload.phone = data.phone;
      if (data.transportType) payload.transportType = data.transportType;
      if (data.name && data.name !== user?.name) payload.name = data.name;
      if (data.avatarUrl && data.avatarUrl !== user?.avatarUrl) payload.avatarUrl = data.avatarUrl;
      if (data.driversLicenseUrl && data.driversLicenseUrl !== user?.driversLicenseUrl) payload.driversLicenseUrl = data.driversLicenseUrl;

      await apiRequest("PATCH", "/api/driver/profile", payload);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "تم تحديث الملف الشخصي بنجاح" });
    } catch (error: any) {
      toast({
        title: "فشل التحديث",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("فشل رفع الصورة");
      const data = await res.json();
      form.setValue("avatarUrl", data.avatarUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "تم رفع الصورة بنجاح" });
    } catch (error: any) {
      toast({ title: "فشل رفع الصورة", description: error.message, variant: "destructive" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLicenseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLicense(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/profile/license", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("فشل رفع الملف");
      const data = await res.json();
      form.setValue("driversLicenseUrl", data.driversLicenseUrl);
      // Q: هل يجب إبطال كاش بيانات المستخدم بعد رفع الرخصة بنجاح؟
      // A: نعم — بدون هذا يظل الكاش يعرض قيمة driversLicenseUrl القديمة (أو null)
      //    حتى انتهاء صلاحية الكاش تلقائياً، مما يعني أن الرخصة الجديدة لا تظهر فور
      //    التحميل في باقي الواجهة. الإصلاح: إبطال ["/api/auth/me"] فور نجاح الرفع،
      //    تماماً كما يحدث عند رفع الصورة الشخصية في handleAvatarUpload.
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "تم رفع الرخصة بنجاح" });
    } catch (error: any) {
      toast({ title: "فشل رفع الرخصة", description: error.message, variant: "destructive" });
    } finally {
      setIsUploadingLicense(false);
    }
  };

  const avatarUrl = form.watch("avatarUrl");
  const licenseUrl = form.watch("driversLicenseUrl");

  return (
    <div className="container mx-auto p-4 max-w-2xl text-right" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">الملف الشخصي</h1>

      <Card>
        <CardHeader>
          <CardTitle>معلومات السائق</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="relative w-32 h-32 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center overflow-hidden bg-muted">
                {isUploadingAvatar ? (
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
                <label className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                  />
                </label>
              </div>
              <Label className="text-sm text-muted-foreground">صورة الملف الشخصي</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <div className="relative">
                <User className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="name" {...form.register("name")} className="pr-10 text-right" placeholder="أدخل اسمك" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="phone" {...form.register("phone")} className="pr-10 text-right" placeholder="01xxxxxxxxx" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transportType">نوع الوسيلة</Label>
              <div className="relative">
                <Truck className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="transportType" {...form.register("transportType")} className="pr-10 text-right" placeholder="دراجة / موتوسيكل / سيارة" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>رخصة القيادة</Label>
              <div className="relative border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-2 bg-muted/50">
                {isUploadingLicense ? (
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                ) : licenseUrl ? (
                  <div className="relative w-full aspect-video rounded overflow-hidden">
                    <img src={licenseUrl} alt="License" className="w-full h-full object-contain" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 left-2"
                      onClick={() => form.setValue("driversLicenseUrl", "")}
                    >
                      حذف
                    </Button>
                  </div>
                ) : (
                  <>
                    <FileText className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">اضغط لرفع صورة الرخصة</span>
                  </>
                )}
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept="image/*"
                  onChange={handleLicenseUpload}
                  disabled={isUploadingLicense}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 ml-2" />}
              حفظ التعديلات
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
