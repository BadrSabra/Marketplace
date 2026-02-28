import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { User, Phone, Truck, Save } from "lucide-react";

export default function DriverProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const form = useForm({
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      transportType: user?.transportType || "",
    }
  });

  const onSubmit = (data: any) => {
    console.log("Profile Update:", data);
    toast({ title: "Profile updated successfully" });
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">الملف الشخصي</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>معلومات السائق</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="name" {...form.register("name")} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="phone" {...form.register("phone")} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transportType">نوع الوسيلة</Label>
              <div className="relative">
                <Truck className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input id="transportType" {...form.register("transportType")} className="pl-10" />
              </div>
            </div>

            <Button type="submit" className="w-full">
              <Save className="w-4 h-4 mr-2" />
              حفظ التعديلات
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
