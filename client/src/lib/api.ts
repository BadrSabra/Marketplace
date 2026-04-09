/**
 * Custom fetch wrapper that automatically attaches the JWT token
 * from localStorage to every request.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("jwt_token");
  
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || (typeof errorData.error === "string" ? errorData.error : undefined) || errorData.message || errorMessage;
      }
    } catch (e) {
      // Ignore JSON parse errors for non-JSON error responses
    }
    
    if (response.status === 401) {
      // BUG-FIX: Token was cleared but user was NOT redirected to the login page,
      // leaving them on a broken page with empty/failed data until a manual refresh.
      // Now the user is immediately redirected to /login on any 401 response.
      localStorage.removeItem("jwt_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    
    throw new Error(errorMessage);
  }

  return response;
}
