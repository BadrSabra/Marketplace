import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Lock, Mail, User, Store, Truck, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "CUSTOMER",
    extra: {
      storeName: "",
      storeType: "",
      transportType: "",
    }
  });
  
  const [, setLocation] = useLocation();
  const { register, isRegistering } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(formData);
      toast({ title: "Welcome!", description: "Account created successfully." });
      setLocation("/");
    } catch (error: any) {
      toast({ 
        title: "Registration failed", 
        description: error.message || "Failed to create account",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-card rounded-3xl premium-shadow border border-border/50 p-8 md:p-10 relative z-10"
      >
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create Account</h1>
          <p className="text-muted-foreground">Join Mit Gaber Marketplace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                placeholder="john@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="password" 
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">I am a...</label>
            <Select 
              value={formData.role} 
              onValueChange={(val) => setFormData({ ...formData, role: val })}
            >
              <SelectTrigger className="w-full h-12 rounded-xl border-2">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
                <SelectItem value="STORE_OWNER">Store Owner</SelectItem>
                <SelectItem value="DRIVER">Delivery Driver</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.role === "STORE_OWNER" && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: "auto", opacity: 1 }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Store Name</label>
                <div className="relative">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    type="text" 
                    value={formData.extra.storeName}
                    onChange={(e) => setFormData({ ...formData, extra: { ...formData.extra, storeName: e.target.value } })}
                    className="w-full pl-12 pr-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                    placeholder="My Awesome Store"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Store Type</label>
                <input 
                  type="text" 
                  value={formData.extra.storeType}
                  onChange={(e) => setFormData({ ...formData, extra: { ...formData.extra, storeType: e.target.value } })}
                  className="w-full px-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                  placeholder="Grocery, Electronics, etc."
                  required
                />
              </div>
            </motion.div>
          )}

          {formData.role === "DRIVER" && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: "auto", opacity: 1 }}
              className="space-y-2 pt-2"
            >
              <label className="text-sm font-medium text-foreground">Transport Type</label>
              <div className="relative">
                <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input 
                  type="text" 
                  value={formData.extra.transportType}
                  onChange={(e) => setFormData({ ...formData, extra: { ...formData.extra, transportType: e.target.value } })}
                  className="w-full pl-12 pr-4 py-3 bg-background border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                  placeholder="Bike, Motorcycle, Car"
                  required
                />
              </div>
            </motion.div>
          )}

          <button 
            type="submit"
            disabled={isRegistering}
            className="w-full flex items-center justify-center gap-2 py-4 mt-4 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 transition-all"
          >
            {isRegistering ? "Creating account..." : "Register"}
            {!isRegistering && <ArrowRight className="w-5 h-5" />}
          </button>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}