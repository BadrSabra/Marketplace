import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
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
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const productFormSchema = insertProductSchema.extend({
  price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Price must be a positive number",
  }),
  stock: z.number().int().nonnegative("Stock must be a non-negative integer"),
});

export default function StoreInventory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stores } = useQuery<any[]>({
    queryKey: ["/api/stores"],
  });
  
  const myStore = stores?.find(s => s.ownerId === user?.id);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", { storeId: myStore?.id }],
    enabled: !!myStore?.id,
  });

  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "0.00",
      stock: 0,
      storeId: myStore?.id || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof productFormSchema>) => {
      const res = await apiRequest("POST", "/api/products", {
        ...values,
        storeId: myStore?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", { storeId: myStore?.id }] });
      toast({ title: "Product created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof productFormSchema>) => {
      const res = await apiRequest("PUT", `/api/products/${editingProduct?.id}`, values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", { storeId: myStore?.id }] });
      toast({ title: "Product updated successfully" });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
    },
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

  const onSubmit = (values: z.infer<typeof productFormSchema>) => {
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
      storeId: product.storeId,
    });
    setIsDialogOpen(true);
  };

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

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
            <h1 className="text-3xl font-bold tracking-tight">Inventory Catalog</h1>
            <p className="text-muted-foreground">Manage your product offerings and monitor stock levels.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingProduct(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 shadow-md shadow-primary/20">
                <Plus className="h-5 w-5 mr-2" />
                Add New Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
                <DialogDescription>
                  Enter the details for your product. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">Product Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Fresh Milk" className="h-11" />
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
                          <Input {...field} placeholder="Brief product details..." className="h-11" />
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
                          <FormLabel className="font-bold">Price ($)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" className="h-11" />
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
                          <FormLabel className="font-bold">Initial Stock</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              className="h-11"
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button 
                      type="submit" 
                      className="w-full h-11 text-lg font-bold"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                      {editingProduct ? "Update Product" : "Save Product"}
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
              placeholder="Search products..." 
              className="pl-10 h-11"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-11 px-4 gap-2">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Inventory List
            </CardTitle>
            <CardDescription>
              {filteredProducts.length} items found in your catalog.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                            <Package className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <div className="font-bold text-base">{product.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{product.description || "No description"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-black text-primary">
                        ${parseFloat(product.price.toString()).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-lg">{product.stock}</span>
                          {product.stock < 5 && product.stock > 0 && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 flex gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Low
                            </Badge>
                          )}
                          {product.stock === 0 && (
                            <Badge variant="destructive" className="animate-pulse">Out of Stock</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.stock > 0 ? "default" : "secondary"} className={product.stock > 0 ? "bg-green-500 hover:bg-green-600" : ""}>
                          {product.stock > 0 ? "Live" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 bg-secondary/50 hover:bg-secondary"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-destructive bg-destructive/5 hover:bg-destructive/20"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this product?")) {
                                deleteMutation.mutate(product.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-12 w-12 opacity-20" />
                        <p className="text-lg font-medium">No products found</p>
                        <p className="text-sm">Try changing your search or add a new product.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </StoreLayout>
  );
}
