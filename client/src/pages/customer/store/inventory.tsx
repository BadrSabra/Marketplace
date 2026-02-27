import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit, Trash2, Package, Search, Filter, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Product, insertProductSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StoreLayout } from "@/components/layout/store-layout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";

const productFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().max(500, "Description must be max 500 characters").optional(),
  price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Price must be a positive number",
  }),
  stock: z.number().int().min(0, "Stock must be non-negative"),
  category: z.string().min(1, "Category is required"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export default function StoreInventory() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [stockFilter, setStockFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("name-asc");

  const { data: stores } = useQuery<any[]>({
    queryKey: ["/api/stores"],
  });
  
  const myStore = stores?.find(s => s.ownerId === user?.id);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", { storeId: myStore?.id }],
    enabled: !!myStore?.id,
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "0.00",
      stock: 0,
      category: "General",
      status: "ACTIVE",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const res = await apiRequest("POST", "/api/products", {
        ...values,
        price: parseFloat(values.price),
        store_id: myStore?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", { storeId: myStore?.id }] });
      toast({ title: t('store.inventory.toasts.create_success') });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: t('store.inventory.toasts.create_error'), 
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const res = await apiRequest("PATCH", `/api/products/${editingProduct?.id}`, {
        ...values,
        price: parseFloat(values.price),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", { storeId: myStore?.id }] });
      toast({ title: t('store.inventory.toasts.update_success') });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: t('store.inventory.toasts.update_error'), 
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", { storeId: myStore?.id }] });
      toast({ title: t('store.inventory.toasts.delete_success') });
    },
  });

  const onSubmit = (values: ProductFormValues) => {
    if (editingProduct) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      stock: product.stock,
      category: product.category,
      status: product.stock > 0 ? "ACTIVE" : "INACTIVE",
    });
    setIsDialogOpen(true);
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let result = products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (statusFilter !== "ALL") {
      result = result.filter(p => {
        const isActive = p.stock > 0;
        return statusFilter === "ACTIVE" ? isActive : !isActive;
      });
    }

    if (stockFilter === "LOW") {
      result = result.filter(p => p.stock < 5 && p.stock > 0);
    } else if (stockFilter === "OUT") {
      result = result.filter(p => p.stock === 0);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "price-asc": return parseFloat(a.price.toString()) - parseFloat(b.price.toString());
        case "price-desc": return parseFloat(b.price.toString()) - parseFloat(a.price.toString());
        case "stock-asc": return a.stock - b.stock;
        case "stock-desc": return b.stock - a.stock;
        default: return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [products, searchQuery, statusFilter, stockFilter, sortBy]);

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="space-y-6 rtl:text-right" dir="auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rtl:flex-row-reverse">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('store.inventory.title')}</h1>
            <p className="text-muted-foreground">{t('store.inventory.subtitle')}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingProduct(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 shadow-md shadow-primary/20 rtl:flex-row-reverse" data-testid="button-add-product">
                <Plus className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
                {t('store.inventory.add_product')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader className="rtl:text-right">
                <DialogTitle className="text-2xl font-bold">
                  {editingProduct ? t('store.inventory.edit_product') : t('store.inventory.add_product')}
                </DialogTitle>
                <DialogDescription>
                  {t('store.inventory.form.required_note')}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="rtl:text-right">
                        <FormLabel className="font-bold">{t('store.inventory.form.name')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t('store.inventory.form.name_placeholder')} className="h-11" data-testid="input-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="rtl:text-right">
                        <FormLabel className="font-bold">{t('store.inventory.form.description')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t('store.inventory.form.description_placeholder')} className="h-11" data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4 rtl:flex-row-reverse">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem className="rtl:text-right">
                          <FormLabel className="font-bold">{t('store.inventory.form.price')}</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" className="h-11" data-testid="input-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="stock"
                      render={({ field }) => (
                        <FormItem className="rtl:text-right">
                          <FormLabel className="font-bold">{t('store.inventory.form.stock')}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              className="h-11"
                              data-testid="input-stock"
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem className="rtl:text-right">
                        <FormLabel className="font-bold">{t('store.inventory.form.category')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t('store.inventory.form.category_placeholder')} className="h-11" data-testid="input-category" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="pt-4 rtl:flex-row-reverse">
                    <Button 
                      type="submit" 
                      className="w-full h-11 text-lg font-bold rtl:flex-row-reverse"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-product"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2 animate-spin" />}
                      {editingProduct ? t('store.inventory.form.submit_update') : t('store.inventory.form.submit_add')}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col md:flex-row gap-4 rtl:flex-row-reverse">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
            <Input 
              placeholder={t('store.inventory.search_placeholder')} 
              className="pl-10 rtl:pl-3 rtl:pr-10 h-11"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-11">
              <SelectValue placeholder={t('store.inventory.status_filter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('store.inventory.statuses.ALL')}</SelectItem>
              <SelectItem value="ACTIVE">{t('store.inventory.statuses.ACTIVE')}</SelectItem>
              <SelectItem value="INACTIVE">{t('store.inventory.statuses.INACTIVE')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-[180px] h-11">
              <SelectValue placeholder={t('store.inventory.stock_filter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('store.inventory.stock_levels.ALL')}</SelectItem>
              <SelectItem value="LOW">{t('store.inventory.stock_levels.LOW')}</SelectItem>
              <SelectItem value="OUT">{t('store.inventory.stock_levels.OUT')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px] h-11">
              <SelectValue placeholder={t('store.inventory.sort_by')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">{t('store.inventory.sort_options.name_asc')}</SelectItem>
              <SelectItem value="price-asc">{t('store.inventory.sort_options.price_asc')}</SelectItem>
              <SelectItem value="price-desc">{t('store.inventory.sort_options.price_desc')}</SelectItem>
              <SelectItem value="stock-asc">{t('store.inventory.sort_options.stock_asc')}</SelectItem>
              <SelectItem value="stock-desc">{t('store.inventory.sort_options.stock_desc')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="rtl:text-right">
            <CardTitle className="flex items-center gap-2 rtl:flex-row-reverse">
              <Package className="h-5 w-5 text-primary" />
              {t('store.inventory.list_title')}
            </CardTitle>
            <CardDescription>
              {t('store.inventory.list_description', { count: filteredProducts.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="rtl:flex-row-reverse">
                    <TableHead className="rtl:text-right">{t('store.inventory.table.name')}</TableHead>
                    <TableHead className="rtl:text-right">{t('store.inventory.table.sku')}</TableHead>
                    <TableHead className="rtl:text-right">{t('store.inventory.table.price')}</TableHead>
                    <TableHead className="rtl:text-right">{t('store.inventory.table.stock')}</TableHead>
                    <TableHead className="rtl:text-right">{t('store.inventory.table.status')}</TableHead>
                    <TableHead className="text-right rtl:text-left">{t('store.inventory.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id} className="group rtl:flex-row-reverse" data-testid={`row-product-${product.id}`}>
                        <TableCell className="rtl:text-right">
                          <div className="flex items-center gap-3 rtl:flex-row-reverse">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                              <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex flex-col rtl:text-right">
                              <span className="font-bold text-sm" data-testid={`text-name-${product.id}`}>{product.name}</span>
                              <span className="text-xs text-muted-foreground line-clamp-1 max-w-[150px]">{product.description || "No description"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="rtl:text-right">
                          <span className="font-mono text-[10px] text-muted-foreground">#{product.id.split("-")[0].toUpperCase()}</span>
                        </TableCell>
                        <TableCell className="font-black text-primary text-sm rtl:text-right">
                          ${parseFloat(product.price.toString()).toFixed(2)}
                        </TableCell>
                        <TableCell className="rtl:text-right">
                          <div className="flex items-center gap-2 rtl:flex-row-reverse">
                            <span className="font-mono font-bold">{product.stock}</span>
                            {product.stock < 5 && product.stock > 0 && (
                              <AlertTriangle className="h-3 w-3 text-yellow-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="rtl:text-right">
                          <Badge variant={product.stock > 0 ? "default" : "secondary"} className={product.stock > 0 ? "bg-green-500 hover:bg-green-600" : ""}>
                            {product.stock > 0 ? t('store.inventory.statuses.ACTIVE') : t('store.inventory.statuses.INACTIVE')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right rtl:text-left">
                          <div className="flex justify-end gap-2 rtl:flex-row-reverse">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleEdit(product)}
                              data-testid={`button-edit-${product.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (confirm(t('store.inventory.delete_confirm'))) {
                                  deleteMutation.mutate(product.id);
                                }
                              }}
                              data-testid={`button-delete-${product.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-12 w-12 opacity-20" />
                          <p className="text-lg font-medium">{t('store.inventory.no_history')}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </StoreLayout>
  );
}
