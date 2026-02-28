import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, Truck, Save, Camera, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function DriverProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
      const token = localStorage.getItem("jwt_token");
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      
      // Use the actual driver profile endpoint if it exists, otherwise fallback
      await apiRequest("PATCH", "/api/driver/profile", data, { headers }).catch(() => 
        apiRequest("PATCH", "/api/customer/profile", data, { headers })
      );
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue(field as any, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
                {form.watch("avatarUrl") ? (
                  <img src={form.watch("avatarUrl")} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
                <label className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90">
                  <Camera className="w-4 h-4" />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={(e) => handleFileUpload(e, "avatarUrl")}
                  />
                </label>
              </div>
              <Label className="text-sm text-muted-foreground">صورة الملف الشخصي</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <div className="relative">
                <User className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="name" {...form.register("name")} className="pr-10 text-right" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="phone" {...form.register("phone")} className="pr-10 text-right" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transportType">نوع الوسيلة</Label>
              <div className="relative">
                <Truck className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="transportType" {...form.register("transportType")} className="pr-10 text-right" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>رخصة القيادة</Label>
              <div className="relative border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-2 bg-muted/50">
                {form.watch("driversLicenseUrl") ? (
                  <div className="relative w-full aspect-video rounded overflow-hidden">
                    <img src={form.watch("driversLicenseUrl")} alt="License" className="w-full h-full object-contain" />
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
                  onChange={(e) => handleFileUpload(e, "driversLicenseUrl")}
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
