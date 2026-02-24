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
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // Ignore JSON parse errors for non-JSON error responses
    }
    
    if (response.status === 401) {
      // Clear token if unauthorized to force re-login
      localStorage.removeItem("jwt_token");
      // Optional: window.location.href = '/login';
    }
    
    throw new Error(errorMessage);
  }

  return response;
}
