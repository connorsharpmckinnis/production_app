import type {
  ActSummary,
  CreateUserRequest,
  ImportLineErrorDetail,
  ImportSuccessResponse,
  LoginRequest,
  MomentDetailResponse,
  MomentSummary,
  ProductionCreate,
  ProductionResponse,
  ResetPasswordRequest,
  TokenResponse,
  UserResponse,
} from "./types";

const TOKEN_KEY = "access_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    const message =
      typeof detail === "string"
        ? detail
        : typeof detail === "object" && detail !== null && "message" in detail
          ? String((detail as ImportLineErrorDetail).message)
          : "Request failed";
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function isImportLineError(
  detail: unknown,
): detail is ImportLineErrorDetail {
  return (
    typeof detail === "object" &&
    detail !== null &&
    "line_number" in detail &&
    "line_content" in detail &&
    "message" in detail
  );
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const response = await fetch(`/api${path}`, { ...options, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, data?.detail ?? "Request failed");
  }

  return data as T;
}

export const api = {
  login(body: LoginRequest) {
    return request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  me() {
    return request<UserResponse>("/auth/me");
  },

  listProductions() {
    return request<ProductionResponse[]>("/productions");
  },

  createProduction(body: ProductionCreate) {
    return request<ProductionResponse>("/productions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  deleteProduction(id: number) {
    return request<void>(`/productions/${id}`, { method: "DELETE" });
  },

  importScript(productionId: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return request<ImportSuccessResponse>(`/productions/${productionId}/import`, {
      method: "POST",
      body: formData,
    });
  },

  listActs(productionId: number) {
    return request<ActSummary[]>(`/productions/${productionId}/acts`);
  },

  listMoments(productionId: number, sceneId: number) {
    return request<MomentSummary[]>(
      `/productions/${productionId}/scenes/${sceneId}/moments`,
    );
  },

  getMoment(productionId: number, momentId: number) {
    return request<MomentDetailResponse>(
      `/productions/${productionId}/moments/${momentId}`,
    );
  },

  listUsers() {
    return request<UserResponse[]>("/users");
  },

  createUser(body: CreateUserRequest) {
    return request<UserResponse>("/users", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  resetPassword(userId: number, body: ResetPasswordRequest) {
    return request<UserResponse>(`/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  deactivateUser(userId: number) {
    return request<UserResponse>(`/users/${userId}/deactivate`, {
      method: "POST",
    });
  },
};
