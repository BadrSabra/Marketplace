import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

// Pages
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import AdminDashboard from "@/pages/admin/dashboard";
import CustomerDashboard from "@/pages/customer/dashboard";
import CustomerWallet from "@/pages/customer/wallet";
import StoreDashboard from "@/pages/store/dashboard";
import DriverDashboard from "@/pages/driver/dashboard";
import DriverEarnings from "@/pages/driver/earnings";
import UsersPage from "@/pages/admin/users";
import StoresPage from "@/pages/admin/stores";
import ProductsPage from "@/pages/admin/products";
import OrdersPage from "@/pages/admin/orders";

function ProtectedRoute({ 
  component: Component, 
  roles 
}: { 
  component: React.ComponentType;
  roles?: string[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="xl" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function RoleBasedDashboard() {
  const { user } = useAuth();
  
  if (!user) return <Redirect to="/login" />;

  switch (user.role) {
    case "ADMIN":
      return <AdminDashboard />;
    case "STORE_OWNER":
      return <StoreDashboard />;
    case "DRIVER":
      return <DriverDashboard />;
    case "CUSTOMER":
    default:
      return <CustomerDashboard />;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/" component={RoleBasedDashboard} />
      
      {/* Customer Routes */}
      <Route path="/customer/wallet">
        {() => <ProtectedRoute component={CustomerWallet} roles={["CUSTOMER"]} />}
      </Route>

      {/* Driver Routes */}
      <Route path="/driver/earnings">
        {() => <ProtectedRoute component={DriverEarnings} roles={["DRIVER"]} />}
      </Route>
      
      {/* Admin Routes */}
      <Route path="/admin/users">
        {() => <ProtectedRoute component={UsersPage} roles={["ADMIN"]} />}
      </Route>
      
      {/* Shared/Common Protected Routes */}
      <Route path="/stores">
        {() => <ProtectedRoute component={StoresPage} />}
      </Route>
      <Route path="/products">
        {() => <ProtectedRoute component={ProductsPage} />}
      </Route>
      <Route path="/orders">
        {() => <ProtectedRoute component={OrdersPage} />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
