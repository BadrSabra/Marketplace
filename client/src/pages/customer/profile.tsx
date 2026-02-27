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
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2, Save, User } from "lucide-react";
import { useTranslation } from "react-i18next";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Max 50 characters").regex(/^[a-zA-Z\s]*$/, "Letters only"),
  phone: z.string().min(10, "Min 10 digits").max(15, "Max 15 digits").regex(/^\d+$/, "Digits only"),
  transportType: z.string().min(1, "Required"),
  avatarUrl: z.string().url("Invalid URL").or(z.literal("")),
  addresses: z.array(z.string().min(1, "Address cannot be empty")).min(1, "At least one address is required"),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function CustomerProfile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/customer/profile"],
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
      transportType: "Walk",
      avatarUrl: "",
      addresses: [""],
    },
    values: user ? {
      name: user.name || "",
      phone: user.phone || "",
      transportType: user.transportType || "Walk",
      avatarUrl: user.avatarUrl || "",
      addresses: user.addresses?.length ? user.addresses : [""],
    } : undefined,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "addresses",
  });

  const mutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      const res = await apiRequest("PATCH", "/api/customer/profile", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/profile"] });
      toast({ 
        title: t('customer.profile.success_update_title'), 
        description: t('customer.profile.success_update_desc') 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: t('customer.profile.error_update_title'), 
        description: error.message || t('customer.profile.error_update_desc'),
        variant: "destructive" 
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="xl" />
      </div>
    );
  }

  const avatarUrl = form.watch("avatarUrl");
  const isDirty = form.formState.isDirty;

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl rtl:text-right" dir="auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{t('customer.profile.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
              <div className="flex flex-col items-center space-y-4 mb-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
                </Avatar>
                <FormField
                  control={form.control}
                  name="avatarUrl"
                  render={({ field }) => (
                    <FormItem className="w-full rtl:text-right">
                      <FormLabel>{t('customer.profile.avatar_url')}</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} data-testid="input-avatar-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rtl:flex-row-reverse">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="rtl:text-right">
                      <FormLabel>{t('customer.profile.full_name')}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem className="rtl:text-right">
                  <FormLabel>{t('customer.profile.email_readonly')}</FormLabel>
                  <Input value={user?.email} disabled className="bg-muted" />
                </FormItem>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rtl:flex-row-reverse">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="rtl:text-right">
                      <FormLabel>{t('customer.profile.phone_number')}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="transportType"
                  render={({ field }) => (
                    <FormItem className="rtl:text-right">
                      <FormLabel>{t('customer.profile.transport_type')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-transport">
                            <SelectValue placeholder={t('customer.profile.select_transport')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Walk">{t('customer.profile.transport.Walk')}</SelectItem>
                          <SelectItem value="Bike">{t('customer.profile.transport.Bike')}</SelectItem>
                          <SelectItem value="Car">{t('customer.profile.transport.Car')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rtl:flex-row-reverse">
                  <FormLabel className="rtl:text-right">{t('customer.profile.delivery_addresses')}</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append("")}
                    className="gap-2 rtl:flex-row-reverse"
                    data-testid="button-add-address"
                  >
                    <Plus className="h-4 w-4" /> {t('customer.profile.add_address')}
                  </Button>
                </div>
                {fields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`addresses.${index}`}
                    render={({ field }) => (
                      <FormItem className="rtl:text-right">
                        <div className="flex gap-2 rtl:flex-row-reverse">
                          <FormControl>
                            <Input {...field} data-testid={`input-address-${index}`} />
                          </FormControl>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="text-destructive"
                              data-testid={`button-remove-address-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <Button
                type="submit"
                className="w-full gap-2 rtl:flex-row-reverse"
                disabled={!isDirty || mutation.isPending}
                data-testid="button-save-profile"
              >
                {mutation.isPending ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                {t('customer.profile.save_changes')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
