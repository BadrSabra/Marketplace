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
import Dashboard from "@/pages/admin/dashboard";
import UsersPage from "@/pages/admin/users";
import StoresPage from "@/pages/admin/stores";
import ProductsPage from "@/pages/admin/products";
import OrdersPage from "@/pages/admin/orders";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
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

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute component={UsersPage} />}
      </Route>
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
