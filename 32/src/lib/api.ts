export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  // Authentication is cookie-based and HttpOnly. Keeping tokens out of
  // localStorage prevents JavaScript/XSS from reading privileged sessions.
  return fetch(input, {
    ...init,
    headers: new Headers(init.headers || {}),
    credentials: init.credentials || 'include'
  });
}
