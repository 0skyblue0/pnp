import type { ApiEnvelope } from "@pnp/shared";

const env = import.meta.env as Readonly<Record<string, string | undefined>>;
const apiBaseUrl = env.VITE_API_BASE_URL ?? "/api/v1";
let csrfToken: string | null = null;

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  return (await response.json()) as ApiEnvelope<T>;
}

export async function apiGet<T>(path: string): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json"
    }
  });

  return parseEnvelope<T>(response);
}

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  const envelope = await apiGet<{ csrfToken: string }>("/auth/csrf");
  if (envelope.error) {
    throw new Error(envelope.error.message);
  }

  csrfToken = envelope.data.csrfToken;
  return csrfToken;
}

export async function apiPost<TResponse, TBody>(
  path: string,
  body: TBody
): Promise<ApiEnvelope<TResponse>> {
  const token = await getCsrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": token
    },
    body: JSON.stringify(body)
  });

  return parseEnvelope<TResponse>(response);
}

export async function apiPatch<TResponse, TBody>(
  path: string,
  body: TBody
): Promise<ApiEnvelope<TResponse>> {
  const token = await getCsrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": token
    },
    body: JSON.stringify(body)
  });

  return parseEnvelope<TResponse>(response);
}

export async function apiPut<TResponse, TBody>(
  path: string,
  body: TBody
): Promise<ApiEnvelope<TResponse>> {
  const token = await getCsrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": token
    },
    body: JSON.stringify(body)
  });

  return parseEnvelope<TResponse>(response);
}

export async function apiDelete<TResponse>(path: string): Promise<ApiEnvelope<TResponse>> {
  const token = await getCsrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-CSRF-Token": token
    }
  });

  return parseEnvelope<TResponse>(response);
}
