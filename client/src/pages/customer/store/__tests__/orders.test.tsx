import { render, screen, fireEvent } from "@testing-library/react";
import StoreOrders from "../orders";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "@/hooks/use-auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const mockUser = {
  id: "1",
  name: "Store Owner",
  role: "STORE_OWNER",
};

describe("StoreOrders Page", () => {
  it("renders order management title", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ user: mockUser, isLoading: false, error: null, login: jest.fn(), logout: jest.fn(), register: jest.fn() }}>
          <StoreOrders />
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    expect(screen.getByText("Order Management")).toBeInTheDocument();
  });
});
