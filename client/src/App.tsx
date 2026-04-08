import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense, Component, type ReactNode } from "react";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";
import { CartContext, useCartState } from "@/hooks/use-cart";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary] Caught error:", error.message, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">حدث خطأ غير متوقع</h2>
            <p className="text-muted-foreground text-sm mb-6">حدث خطأ أثناء تحميل هذه الصفحة. يرجى المحاولة مرة أخرى.</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
import CustomerOrders from "@/pages/customer/orders";
import UsersPage from "@/pages/admin/users";
import StoresPage from "@/pages/admin/stores";
import ProductsPage from "@/pages/admin/products";
import OrdersPage from "@/pages/admin/orders";
import AdminAudit from "@/pages/admin/audit";
import AdminDeposits from "@/pages/admin/deposits";
import AdminWithdrawals from "@/pages/admin/withdrawals";
import DriverNavbar from "@/components/driver/DriverNavbar";
import CartPage from "@/pages/customer/cart";
import ChatListPage from "@/pages/chat/index";
import ChatRoomPage from "@/pages/chat/room";

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
      return <Redirect to="/store/dashboard" />;
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

      {/* Store Owner Routes — MUST be before /store/:id wildcard */}
      <Route path="/store/dashboard">
        {() => <ProtectedRoute component={StoreDashboard} roles={["STORE_OWNER"]} />}
      </Route>
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

      {/* Public store page — wildcard AFTER specific /store/* paths */}
      <Route path="/store/:id" component={PublicStorePage} />
      <Route path="/stores" component={PublicStoresPage} />
      
      {/* Customer Routes */}
      <Route path="/customer/cart">
        {() => <ProtectedRoute component={CartPage} roles={["CUSTOMER"]} />}
      </Route>
      <Route path="/customer/wallet">
        {() => <ProtectedRoute component={CustomerWallet} roles={["CUSTOMER"]} />}
      </Route>
      <Route path="/customer/transactions">
        {() => <ProtectedRoute component={CustomerTransactions} roles={["CUSTOMER"]} />}
      </Route>
      <Route path="/customer/profile">
        {() => <ProtectedRoute component={CustomerProfile} roles={["CUSTOMER"]} />}
      </Route>
      <Route path="/customer/orders">
        {() => <ProtectedRoute component={CustomerOrders} roles={["CUSTOMER"]} />}
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
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard">
        {() => <ProtectedRoute component={AdminDashboard} roles={["ADMIN"]} />}
      </Route>
      <Route path="/admin/deposits">
        {() => <ProtectedRoute component={AdminDeposits} roles={["ADMIN"]} />}
      </Route>
      <Route path="/admin/withdrawals">
        {() => <ProtectedRoute component={AdminWithdrawals} roles={["ADMIN"]} />}
      </Route>
      <Route path="/admin/audit">
        {() => <ProtectedRoute component={AdminAudit} roles={["ADMIN"]} />}
      </Route>
      <Route path="/admin/users">
        {() => <ProtectedRoute component={UsersPage} roles={["ADMIN"]} />}
      </Route>
      <Route path="/admin/stores">
        {() => <ProtectedRoute component={StoresPage} roles={["ADMIN"]} />}
      </Route>
      <Route path="/products">
        {() => <ProtectedRoute component={ProductsPage} />}
      </Route>
      <Route path="/orders">
        {() => <ProtectedRoute component={OrdersPage} />}
      </Route>
      
      {/* Chat Routes */}
      <Route path="/chat">
        {() => <ProtectedRoute component={ChatListPage} />}
      </Route>
      <Route path="/chat/:roomId">
        {() => <ProtectedRoute component={ChatRoomPage} />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function CartWrapper({ children }: { children: React.ReactNode }) {
  const cartState = useCartState();
  return (
    <CartContext.Provider value={cartState}>
      {children}
    </CartContext.Provider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="xl" /></div>}>
        <QueryClientProvider client={queryClient}>
          <CartWrapper>
            <TooltipProvider>
              <Toaster />
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </TooltipProvider>
          </CartWrapper>
        </QueryClientProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
