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
      toast({ title: "Product created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Creation failed", 
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
      toast({ title: "Product updated successfully" });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Update failed", 
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
      toast({ title: "Product deleted successfully" });
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
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Product Management</h1>
            <p className="text-muted-foreground">Manage your store's products, inventory, and pricing.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingProduct(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 shadow-md shadow-primary/20" data-testid="button-add-product">
                <Plus className="h-5 w-5 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
                <DialogDescription>
                  Enter the details for your product. All fields marked with * are required.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">Product Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Fresh Milk" className="h-11" data-testid="input-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">Description</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Brief product details..." className="h-11" data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Price ($) *</FormLabel>
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
                        <FormItem>
                          <FormLabel className="font-bold">Stock Quantity *</FormLabel>
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
                      <FormItem>
                        <FormLabel className="font-bold">Category *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Dairy, Bakery" className="h-11" data-testid="input-category" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="pt-4">
                    <Button 
                      type="submit" 
                      className="w-full h-11 text-lg font-bold"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-product"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                      {editingProduct ? "Update Product" : "Add Product"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name..." 
              className="pl-10 h-11"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-11">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-[180px] h-11">
              <SelectValue placeholder="Stock Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Stock</SelectItem>
              <SelectItem value="LOW">Low Stock</SelectItem>
              <SelectItem value="OUT">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px] h-11">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="price-asc">Price (Low-High)</SelectItem>
              <SelectItem value="price-desc">Price (High-Low)</SelectItem>
              <SelectItem value="stock-asc">Stock (Low-High)</SelectItem>
              <SelectItem value="stock-desc">Stock (High-Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Products List
            </CardTitle>
            <CardDescription>
              Displaying {filteredProducts.length} products from your store.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU / ID</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id} className="group" data-testid={`row-product-${product.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                              <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm" data-testid={`text-name-${product.id}`}>{product.name}</span>
                              <span className="text-xs text-muted-foreground line-clamp-1 max-w-[150px]">{product.description || "No description"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-[10px] text-muted-foreground">#{product.id.split("-")[0].toUpperCase()}</span>
                        </TableCell>
                        <TableCell className="font-black text-primary text-sm">
                          ${parseFloat(product.price.toString()).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{product.stock}</span>
                            {product.stock < 5 && product.stock > 0 && (
                              <AlertTriangle className="h-3 w-3 text-yellow-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.stock > 0 ? "default" : "secondary"} className={product.stock > 0 ? "bg-green-500 hover:bg-green-600" : ""}>
                            {product.stock > 0 ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
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
                                if (confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
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
                          <p className="text-lg font-medium">No products found</p>
                          <p className="text-sm">Start by adding your first product to the catalog.</p>
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
