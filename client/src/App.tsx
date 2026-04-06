import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense } from "react";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

// Pages
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import AdminDashboard from "@/pages/admin/dashboard";
import CustomerDashboard from "@/pages/customer/dashboard";
import CustomerWallet from "@/pages/customer/wallet";
import CustomerTransactions from "@/pages/customer/transactions";
import CustomerProfile from "@/pages/customer/profile";
import StoreDashboard from "@/pages/customer/store/dashboard";
import StoreOrders from "@/pages/customer/store/orders";
import StoreEarnings from "@/pages/customer/store/earnings";
import StoreInventory from "@/pages/customer/store/inventory";
import StoreOrderDetails from "@/pages/customer/store/order/[id]";
import DriverDashboard from "@/pages/driver/dashboard";
import DriverEarnings from "@/pages/driver/earnings";
import DriverTasks from "@/pages/driver/tasks";
import DriverWallet from "@/pages/driver/wallet";
import DriverProfile from "@/pages/driver/profile";
import ActiveDelivery from "@/pages/driver/active-delivery";
import CustomerOrderDetails from "@/pages/customer/order";
import UsersPage from "@/pages/admin/users";
import StoresPage from "@/pages/admin/stores";
import ProductsPage from "@/pages/admin/products";
import OrdersPage from "@/pages/admin/orders";
import AdminAudit from "@/pages/admin/audit";
import DriverNavbar from "@/components/driver/DriverNavbar";

function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DriverNavbar />
      <main className="pb-20 md:pb-8">
        {children}
      </main>
    </div>
  );
}

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

import LandingPage from "@/pages/public/LandingPage";
import PublicStorePage from "@/pages/public/PublicStorePage";
import PublicStoresPage from "@/pages/public/StoresPage";
import HowItWorks from "@/pages/public/HowItWorks";
import AboutPage from "@/pages/public/about";
import FAQPage from "@/pages/public/faq";

function RoleBasedDashboard() {
  const { user } = useAuth();
  
  if (!user) return <LandingPage />;

  switch (user.role) {
    case "ADMIN":
      return <AdminDashboard />;
    case "STORE_OWNER":
      return <StoreDashboard />;
    case "DRIVER":
      return <Redirect to="/driver/tasks" />;
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
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/about" component={AboutPage} />
      <Route path="/faq" component={FAQPage} />
      <Route path="/store/:id" component={PublicStorePage} />
      <Route path="/stores" component={PublicStoresPage} />
      
      {/* Customer Routes */}
      <Route path="/customer/wallet">
        {() => <ProtectedRoute component={CustomerWallet} roles={["CUSTOMER"]} />}
      </Route>
      <Route path="/customer/transactions">
        {() => <ProtectedRoute component={CustomerTransactions} roles={["CUSTOMER"]} />}
      </Route>
      <Route path="/customer/profile">
        {() => <ProtectedRoute component={CustomerProfile} roles={["CUSTOMER"]} />}
      </Route>
      <Route path="/customer/order/:id">
        {() => <ProtectedRoute component={CustomerOrderDetails} roles={["CUSTOMER"]} />}
      </Route>

      {/* Driver Routes */}
      <Route path="/driver/earnings">
        {() => <ProtectedRoute component={() => <DriverLayout><DriverEarnings /></DriverLayout>} roles={["DRIVER"]} />}
      </Route>
      <Route path="/driver/tasks">
        {() => <ProtectedRoute component={() => <DriverLayout><DriverTasks /></DriverLayout>} roles={["DRIVER"]} />}
      </Route>
      <Route path="/driver/wallet">
        {() => <ProtectedRoute component={() => <DriverLayout><DriverWallet /></DriverLayout>} roles={["DRIVER"]} />}
      </Route>
      <Route path="/driver/profile">
        {() => <ProtectedRoute component={() => <DriverLayout><DriverProfile /></DriverLayout>} roles={["DRIVER"]} />}
      </Route>
      <Route path="/driver/active-delivery">
        {() => <ProtectedRoute component={() => <DriverLayout><ActiveDelivery /></DriverLayout>} roles={["DRIVER"]} />}
      </Route>
      
      {/* Store Routes */}
      <Route path="/store/dashboard/orders">
        {() => <ProtectedRoute component={StoreOrders} roles={["STORE_OWNER"]} />}
      </Route>
      <Route path="/store/earnings">
        {() => <ProtectedRoute component={StoreEarnings} roles={["STORE_OWNER"]} />}
      </Route>
      <Route path="/store/inventory">
        {() => <ProtectedRoute component={StoreInventory} roles={["STORE_OWNER"]} />}
      </Route>
      <Route path="/store/order/:id">
        {() => <ProtectedRoute component={StoreOrderDetails} roles={["STORE_OWNER"]} />}
      </Route>
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard">
        {() => <ProtectedRoute component={AdminDashboard} roles={["ADMIN"]} />}
      </Route>
      <Route path="/admin/audit">
        {() => <ProtectedRoute component={AdminAudit} roles={["ADMIN"]} />}
      </Route>
      <Route path="/admin/users">
        {() => <ProtectedRoute component={UsersPage} roles={["ADMIN"]} />}
      </Route>
      
      <Route path="/stores" component={PublicStoresPage} />
      <Route path="/products">
        {() => <ProtectedRoute component={ProductsPage} />}
      </Route>
      <Route path="/orders">
        {() => <ProtectedRoute component={OrdersPage} />}
      </Route>
      <Route path="/admin/stores">
        {() => <ProtectedRoute component={StoresPage} roles={["ADMIN"]} />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="xl" /></div>}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </Suspense>
  );
}

export default App;
