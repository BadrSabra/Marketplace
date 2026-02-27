import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StoreInventory from "../inventory";
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

describe("StoreInventory Page", () => {
  it("renders product management title", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ user: mockUser, isLoading: false, error: null, login: jest.fn(), logout: jest.fn(), register: jest.fn() }}>
          <StoreInventory />
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    expect(screen.getByText("Product Management")).toBeInTheDocument();
  });

  it("opens add product modal on button click", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ user: mockUser, isLoading: false, error: null, login: jest.fn(), logout: jest.fn(), register: jest.fn() }}>
          <StoreInventory />
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    
    const addButton = screen.getByTestId("button-add-product");
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText("Add New Product")).toBeInTheDocument();
    });
  });
});
