import type {
  ActSummary,
  BookmarkResponse,
  CastableUserResponse,
  CharacterDetailResponse,
  CreateUserRequest,
  GroupResponse,
  ImportLineErrorDetail,
  ImportSuccessResponse,
  LoginRequest,
  MomentDetailResponse,
  MomentListFilters,
  MomentSummary,
  NoteResponse,
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

function momentQuery(filters?: MomentListFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.characterIds?.length) {
    params.set("character_ids", filters.characterIds.join(","));
  }
  if (filters.groupId) {
    params.set("group_id", String(filters.groupId));
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.cueOnly) {
    params.set("cue_only", "true");
  }
  const query = params.toString();
  return query ? `?${query}` : "";
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

  getProduction(id: number) {
    return request<ProductionResponse>(`/productions/${id}`);
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

  listMoments(productionId: number, sceneId: number, filters?: MomentListFilters) {
    return request<MomentSummary[]>(
      `/productions/${productionId}/scenes/${sceneId}/moments${momentQuery(filters)}`,
    );
  },

  getMoment(productionId: number, momentId: number) {
    return request<MomentDetailResponse>(
      `/productions/${productionId}/moments/${momentId}`,
    );
  },

  listCharacters(productionId: number) {
    return request<CharacterDetailResponse[]>(`/productions/${productionId}/characters`);
  },

  createCharacter(productionId: number, body: { name: string; description?: string | null }) {
    return request<CharacterDetailResponse>(`/productions/${productionId}/characters`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateCharacter(
    productionId: number,
    characterId: number,
    body: { description?: string | null },
  ) {
    return request<CharacterDetailResponse>(
      `/productions/${productionId}/characters/${characterId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
  },

  castCharacter(productionId: number, characterId: number, userId: number | null) {
    return request<{ character_id: number; user_id: number | null; user_display_name: string | null }>(
      `/productions/${productionId}/characters/${characterId}/cast`,
      {
        method: "PUT",
        body: JSON.stringify({ user_id: userId }),
      },
    );
  },

  listCastableUsers(productionId: number) {
    return request<CastableUserResponse[]>(
      `/productions/${productionId}/castable-users`,
    );
  },

  createNote(
    productionId: number,
    body: { moment_id?: number; character_id?: number; visibility: "public" | "private"; content: string },
  ) {
    return request<NoteResponse>(`/productions/${productionId}/notes`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  deleteNote(productionId: number, noteId: number) {
    return request<void>(`/productions/${productionId}/notes/${noteId}`, {
      method: "DELETE",
    });
  },

  createBookmark(momentId: number, label?: string | null) {
    return request<BookmarkResponse>("/bookmarks", {
      method: "POST",
      body: JSON.stringify({ moment_id: momentId, label }),
    });
  },

  deleteBookmark(bookmarkId: number) {
    return request<void>(`/bookmarks/${bookmarkId}`, { method: "DELETE" });
  },

  listBookmarks(productionId?: number) {
    const query = productionId ? `?production_id=${productionId}` : "";
    return request<BookmarkResponse[]>(`/users/me/bookmarks${query}`);
  },

  listGroups(productionId: number) {
    return request<GroupResponse[]>(`/productions/${productionId}/groups`);
  },

  createGroup(productionId: number, body: { name: string; description?: string | null }) {
    return request<GroupResponse>(`/productions/${productionId}/groups`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateGroup(
    productionId: number,
    groupId: number,
    body: { name?: string; description?: string | null },
  ) {
    return request<GroupResponse>(`/productions/${productionId}/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteGroup(productionId: number, groupId: number) {
    return request<void>(`/productions/${productionId}/groups/${groupId}`, {
      method: "DELETE",
    });
  },

  updateGroupMembers(
    productionId: number,
    groupId: number,
    body: { character_ids?: number[]; user_ids?: number[] },
  ) {
    return request<GroupResponse>(
      `/productions/${productionId}/groups/${groupId}/members`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
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
