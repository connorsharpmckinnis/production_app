import {
  CATALOG_CSV_CONFIGS,
  parseContentDispositionFilename,
  type CatalogCsvKind,
} from "./catalogCsv";
import type {
  ActSummary,
  AppSettingsResponse,
  AssetEventKind,
  BookmarkResponse,
  CastableUserResponse,
  CatalogImportResult,
  CharacterDetailResponse,
  CostumeChangeEntry,
  CostumeResponse,
  CreateUserRequest,
  CueCategoryResponse,
  CueResponse,
  CueSheetCategory,
  EntranceExitSheetGroup,
  BlockingSheetEntry,
  OnStageChartReport,
  FeedbackCreate,
  FeedbackResponse,
  GroupResponse,
  ImportErrorsDetail,
  ImportSuccessResponse,
  LoginRequest,
  MomentBlockingResponse,
  MomentCostumeEventResponse,
  MomentEntranceResponse,
  MomentExitResponse,
  MomentDetailResponse,
  MomentListFilters,
  MomentPropEventResponse,
  MomentSetPieceEventResponse,
  MomentSummary,
  MomentTypeResponse,
  NoteResponse,
  AnnouncementCreate,
  AnnouncementResponse,
  AnnouncementUpdate,
  NotificationInboxResponse,
  OverviewMessageDefaultItem,
  OverviewMessageDefaultResponse,
  PackResponse,
  LavChartResponse,
  LavPackCell,
  LavWireCell,
  ProductionCreate,
  ProductionOverviewMessageItem,
  ProductionOverviewMessageResponse,
  ProductionOverviewResponse,
  ProductionOverviewSettingsResponse,
  ProductionResponse,
  PropResponse,
  PropSheetEntry,
  ResetPasswordRequest,
  SetPieceResponse,
  SongDetailResponse,
  TokenResponse,
  UserResponse,
  WireResponse,
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
          ? String((detail as { message: unknown }).message)
          : "Request failed";
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function isImportErrorsDetail(
  detail: unknown,
): detail is ImportErrorsDetail {
  return (
    typeof detail === "object" &&
    detail !== null &&
    "errors" in detail &&
    Array.isArray((detail as ImportErrorsDetail).errors)
  );
}

export function formatApiError(err: unknown, fallback = "Request failed"): string {
  if (err instanceof ApiError) {
    const detail = err.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            if ("msg" in item && item.msg != null) return String(item.msg);
            if ("message" in item && item.message != null) return String(item.message);
          }
          return null;
        })
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
    if (isImportErrorsDetail(detail)) {
      const msgs = detail.errors.map((e) => e.message ?? String(e)).filter(Boolean);
      if (msgs.length) {
        return (
          msgs.slice(0, 5).join("; ") + (msgs.length > 5 ? ` (+${msgs.length - 5} more)` : "")
        );
      }
    }
    if (detail && typeof detail === "object" && "message" in detail) {
      return String((detail as { message: unknown }).message);
    }
    if (err.message && err.message !== "Request failed") return err.message;
    return fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
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
  if (filters.songId) {
    params.set("song_id", String(filters.songId));
  }
  if (filters.propId) {
    params.set("prop_id", String(filters.propId));
  }
  if (filters.cueCategoryId) {
    params.set("cue_category_id", String(filters.cueCategoryId));
  }
  if (filters.setPieceId) {
    params.set("set_piece_id", String(filters.setPieceId));
  }
  if (filters.costumeOnly) {
    params.set("costume_only", "true");
  }
  if (filters.entranceOnly) {
    params.set("entrance_only", "true");
  }
  if (filters.exitOnly) {
    params.set("exit_only", "true");
  }
  if (filters.blockingOnly) {
    params.set("blocking_only", "true");
  }
  if (filters.blockingCharacterId) {
    params.set("blocking_character_id", String(filters.blockingCharacterId));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function downloadAuthenticatedFile(
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`/api${path}`, { headers });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.detail ?? "Request failed");
  }

  const blob = await response.blob();
  const filename =
    parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
    fallbackFilename;
  triggerBlobDownload(blob, filename);
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

  actAs(body: { user_id: number }) {
    return request<TokenResponse>("/auth/act-as", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  stopActAs() {
    return request<TokenResponse>("/auth/stop-act-as", {
      method: "POST",
    });
  },

  listProductions() {
    return request<ProductionResponse[]>("/productions");
  },

  getProduction(id: number) {
    return request<ProductionResponse>(`/productions/${id}`);
  },

  getProductionOverview(id: number) {
    return request<ProductionOverviewResponse>(`/productions/${id}/overview`);
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
  listActiveUsers(productionId: number) {
    return request<CastableUserResponse[]>(
      `/productions/${productionId}/active-users`,
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

  listMomentTypes() {
    return request<MomentTypeResponse[]>("/moment-types");
  },

  updateMoment(
    productionId: number,
    momentId: number,
    body: {
      moment_type_id?: number;
      parsed_text?: string | null;
      song_id?: number | null;
      force_type_change?: boolean;
    },
  ) {
    return request<MomentDetailResponse>(
      `/productions/${productionId}/moments/${momentId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  updateDialogue(
    productionId: number,
    momentId: number,
    lineId: number,
    body: { character_id?: number; dialogue_text?: string },
  ) {
    return request<MomentDetailResponse>(
      `/productions/${productionId}/moments/${momentId}/dialogue/${lineId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  updateStageDirection(
    productionId: number,
    momentId: number,
    body: { direction_text: string },
  ) {
    return request<MomentDetailResponse>(
      `/productions/${productionId}/moments/${momentId}/stage-direction`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  listSongs(productionId: number) {
    return request<SongDetailResponse[]>(`/productions/${productionId}/songs`);
  },

  importSongsCsv(productionId: number, file: File) {
    return this.importCatalogCsv(productionId, "songs", file);
  },

  downloadSongsCsvTemplate(productionId: number) {
    return this.downloadCatalogCsvTemplate(productionId, "songs");
  },

  createSong(
    productionId: number,
    body: { title: string; composer?: string | null; lyricist?: string | null; description?: string | null },
  ) {
    return request<SongDetailResponse>(`/productions/${productionId}/songs`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateSong(
    productionId: number,
    songId: number,
    body: { composer?: string | null; lyricist?: string | null; description?: string | null },
  ) {
    return request<SongDetailResponse>(`/productions/${productionId}/songs/${songId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  listProps(productionId: number) {
    return request<PropResponse[]>(`/productions/${productionId}/props`);
  },

  createProp(
    productionId: number,
    body: { name: string; description?: string | null; notes?: string | null },
  ) {
    return request<PropResponse>(`/productions/${productionId}/props`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateProp(
    productionId: number,
    propId: number,
    body: { name?: string; description?: string | null; notes?: string | null },
  ) {
    return request<PropResponse>(`/productions/${productionId}/props/${propId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteProp(productionId: number, propId: number) {
    return request<void>(`/productions/${productionId}/props/${propId}`, {
      method: "DELETE",
    });
  },

  importPropsCsv(productionId: number, file: File) {
    return this.importCatalogCsv(productionId, "props", file);
  },

  downloadPropsCsvTemplate(productionId: number) {
    return this.downloadCatalogCsvTemplate(productionId, "props");
  },

  attachMomentProp(
    productionId: number,
    momentId: number,
    body: {
      prop_id: number;
      kind: AssetEventKind;
      character_id?: number | null;
      user_id?: number | null;
      notes?: string | null;
    },
  ) {
    return request<MomentPropEventResponse>(
      `/productions/${productionId}/moments/${momentId}/props`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  updateMomentProp(
    productionId: number,
    momentId: number,
    momentPropId: number,
    body: {
      kind: AssetEventKind;
      character_id?: number | null;
      user_id?: number | null;
      notes?: string | null;
    },
  ) {
    return request<MomentPropEventResponse>(
      `/productions/${productionId}/moments/${momentId}/props/${momentPropId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  detachMomentProp(productionId: number, momentId: number, momentPropId: number) {
    return request<void>(
      `/productions/${productionId}/moments/${momentId}/props/${momentPropId}`,
      { method: "DELETE" },
    );
  },

  listCueCategories(productionId: number) {
    return request<CueCategoryResponse[]>(`/productions/${productionId}/cue-categories`);
  },

  createCueCategory(
    productionId: number,
    body: { name: string; description?: string | null },
  ) {
    return request<CueCategoryResponse>(`/productions/${productionId}/cue-categories`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateCueCategory(
    productionId: number,
    categoryId: number,
    body: { name?: string; description?: string | null },
  ) {
    return request<CueCategoryResponse>(
      `/productions/${productionId}/cue-categories/${categoryId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  deleteCueCategory(productionId: number, categoryId: number) {
    return request<void>(`/productions/${productionId}/cue-categories/${categoryId}`, {
      method: "DELETE",
    });
  },

  importCueCategoriesCsv(productionId: number, file: File) {
    return this.importCatalogCsv(productionId, "cue-categories", file);
  },

  downloadCueCategoriesCsvTemplate(productionId: number) {
    return this.downloadCatalogCsvTemplate(productionId, "cue-categories");
  },

  createMomentCue(
    productionId: number,
    momentId: number,
    body: { cue_category_id: number; title: string; notes?: string | null; payload?: Record<string, unknown> | null },
  ) {
    return request<CueResponse>(`/productions/${productionId}/moments/${momentId}/cues`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateMomentCue(
    productionId: number,
    momentId: number,
    cueId: number,
    body: { cue_category_id?: number; title?: string; notes?: string | null; payload?: Record<string, unknown> | null },
  ) {
    return request<CueResponse>(
      `/productions/${productionId}/moments/${momentId}/cues/${cueId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  deleteMomentCue(productionId: number, momentId: number, cueId: number) {
    return request<void>(
      `/productions/${productionId}/moments/${momentId}/cues/${cueId}`,
      { method: "DELETE" },
    );
  },

  getNotificationInbox(params?: { productionId?: number; routeKey?: string }) {
    const search = new URLSearchParams();
    if (params?.productionId != null) {
      search.set("production_id", String(params.productionId));
    }
    if (params?.routeKey) {
      search.set("route_key", params.routeKey);
    }
    const query = search.toString();
    return request<NotificationInboxResponse>(
      `/notifications/inbox${query ? `?${query}` : ""}`,
    );
  },

  markNotificationRead(notificationId: number) {
    return request<void>(`/notifications/${notificationId}/read`, { method: "POST" });
  },

  markAllNotificationsRead() {
    return request<{ updated: number }>("/notifications/read-all", { method: "POST" });
  },

  listOrgAnnouncements(includeInactive = true) {
    return request<AnnouncementResponse[]>(
      `/announcements?include_inactive=${includeInactive ? "true" : "false"}`,
    );
  },

  createOrgAnnouncement(body: AnnouncementCreate) {
    return request<AnnouncementResponse>("/announcements", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  listProductionAnnouncements(productionId: number, includeInactive = true) {
    return request<AnnouncementResponse[]>(
      `/productions/${productionId}/announcements?include_inactive=${includeInactive ? "true" : "false"}`,
    );
  },

  createProductionAnnouncement(productionId: number, body: AnnouncementCreate) {
    return request<AnnouncementResponse>(`/productions/${productionId}/announcements`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateAnnouncement(announcementId: number, body: AnnouncementUpdate) {
    return request<AnnouncementResponse>(`/announcements/${announcementId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  /** Active → deactivate (returns announcement). Inactive → hard delete (204). */
  deleteAnnouncement(announcementId: number) {
    return request<AnnouncementResponse | undefined>(`/announcements/${announcementId}`, {
      method: "DELETE",
    });
  },

  /** @deprecated Prefer deleteAnnouncement */
  deactivateAnnouncement(announcementId: number) {
    return this.deleteAnnouncement(announcementId);
  },

  getAppSettings() {
    return request<AppSettingsResponse>("/settings");
  },

  updateAppSettings(body: Partial<AppSettingsResponse>) {
    return request<AppSettingsResponse>("/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  getOverviewMessageDefaults() {
    return request<OverviewMessageDefaultResponse[]>("/settings/overview-message-defaults");
  },

  replaceOverviewMessageDefaults(messages: OverviewMessageDefaultItem[]) {
    return request<OverviewMessageDefaultResponse[]>("/settings/overview-message-defaults", {
      method: "PUT",
      body: JSON.stringify({ messages }),
    });
  },

  getProductionOverviewMessages(productionId: number) {
    return request<ProductionOverviewMessageResponse[]>(
      `/productions/${productionId}/overview-messages`,
    );
  },

  replaceProductionOverviewMessages(
    productionId: number,
    messages: ProductionOverviewMessageItem[],
  ) {
    return request<ProductionOverviewMessageResponse[]>(
      `/productions/${productionId}/overview-messages`,
      {
        method: "PUT",
        body: JSON.stringify({ messages }),
      },
    );
  },

  getProductionOverviewSettings(productionId: number) {
    return request<ProductionOverviewSettingsResponse>(
      `/productions/${productionId}/overview-settings`,
    );
  },

  updateProductionOverviewSettings(
    productionId: number,
    body: { message_rotation_seconds: number | null },
  ) {
    return request<ProductionOverviewSettingsResponse>(
      `/productions/${productionId}/overview-settings`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
  },

  createMoment(
    productionId: number,
    sceneId: number,
    body: {
      sequence_number: number;
      moment_type_id: number;
      original_text: string;
      character_id?: number | null;
    },
  ) {
    return request<MomentDetailResponse>(
      `/productions/${productionId}/scenes/${sceneId}/moments`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  deleteMoment(productionId: number, momentId: number) {
    return request<void>(`/productions/${productionId}/moments/${momentId}`, {
      method: "DELETE",
    });
  },

  reorderMoment(productionId: number, momentId: number, sequenceNumber: number) {
    return request<MomentDetailResponse>(
      `/productions/${productionId}/moments/${momentId}/sequence`,
      { method: "PATCH", body: JSON.stringify({ sequence_number: sequenceNumber }) },
    );
  },

  listCostumes(productionId: number) {
    return request<CostumeResponse[]>(`/productions/${productionId}/costumes`);
  },

  createCostume(
    productionId: number,
    body: { character_id: number; name: string; description?: string | null },
  ) {
    return request<CostumeResponse>(`/productions/${productionId}/costumes`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateCostume(
    productionId: number,
    costumeId: number,
    body: {
      character_id?: number;
      name?: string;
      description?: string | null;
    },
  ) {
    return request<CostumeResponse>(`/productions/${productionId}/costumes/${costumeId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteCostume(productionId: number, costumeId: number) {
    return request<void>(`/productions/${productionId}/costumes/${costumeId}`, {
      method: "DELETE",
    });
  },

  importCostumesCsv(productionId: number, file: File) {
    return this.importCatalogCsv(productionId, "costumes", file);
  },

  downloadCostumesCsvTemplate(productionId: number) {
    return this.downloadCatalogCsvTemplate(productionId, "costumes");
  },

  attachMomentCostume(
    productionId: number,
    momentId: number,
    body: {
      character_id: number;
      kind: AssetEventKind;
      costume_id?: number | null;
      notes?: string | null;
    },
  ) {
    return request<MomentCostumeEventResponse>(
      `/productions/${productionId}/moments/${momentId}/costumes`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  updateMomentCostume(
    productionId: number,
    momentId: number,
    momentCostumeId: number,
    body: {
      kind: AssetEventKind;
      costume_id?: number | null;
      notes?: string | null;
    },
  ) {
    return request<MomentCostumeEventResponse>(
      `/productions/${productionId}/moments/${momentId}/costumes/${momentCostumeId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  detachMomentCostume(productionId: number, momentId: number, momentCostumeId: number) {
    return request<void>(
      `/productions/${productionId}/moments/${momentId}/costumes/${momentCostumeId}`,
      { method: "DELETE" },
    );
  },

  listWires(productionId: number) {
    return request<WireResponse[]>(`/productions/${productionId}/wires`);
  },

  createWire(productionId: number, body: { identifier: string; notes?: string | null }) {
    return request<WireResponse>(`/productions/${productionId}/wires`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateWire(
    productionId: number,
    wireId: number,
    body: { identifier?: string; notes?: string | null },
  ) {
    return request<WireResponse>(`/productions/${productionId}/wires/${wireId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteWire(productionId: number, wireId: number) {
    return request<void>(`/productions/${productionId}/wires/${wireId}`, {
      method: "DELETE",
    });
  },

  listPacks(productionId: number) {
    return request<PackResponse[]>(`/productions/${productionId}/packs`);
  },

  createPack(productionId: number, body: { identifier: string; notes?: string | null }) {
    return request<PackResponse>(`/productions/${productionId}/packs`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updatePack(
    productionId: number,
    packId: number,
    body: { identifier?: string; notes?: string | null },
  ) {
    return request<PackResponse>(`/productions/${productionId}/packs/${packId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deletePack(productionId: number, packId: number) {
    return request<void>(`/productions/${productionId}/packs/${packId}`, {
      method: "DELETE",
    });
  },

  getLavChart(productionId: number) {
    return request<LavChartResponse>(`/productions/${productionId}/lav-chart`);
  },

  saveLavChart(
    productionId: number,
    body: {
      wire_cells: LavWireCell[];
      pack_cells: LavPackCell[];
      locked_row_keys?: string[];
    },
  ) {
    return request<LavChartResponse>(`/productions/${productionId}/lav-chart`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  proposeLavChart(
    productionId: number,
    sheets: string[] = ["wires", "packs"],
    options: { preserve_filled_and_locked?: boolean } = {},
  ) {
    return request<LavChartResponse>(`/productions/${productionId}/lav-chart/propose`, {
      method: "POST",
      body: JSON.stringify({
        sheets,
        // Default: full overwrite of the requested sheet(s).
        preserve_filled_and_locked: options.preserve_filled_and_locked ?? false,
      }),
    });
  },

  listSetPieces(productionId: number) {
    return request<SetPieceResponse[]>(`/productions/${productionId}/set-pieces`);
  },

  createSetPiece(
    productionId: number,
    body: { name: string; mobile?: boolean; description?: string | null },
  ) {
    return request<SetPieceResponse>(`/productions/${productionId}/set-pieces`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateSetPiece(
    productionId: number,
    setPieceId: number,
    body: { name?: string; mobile?: boolean; description?: string | null },
  ) {
    return request<SetPieceResponse>(
      `/productions/${productionId}/set-pieces/${setPieceId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  deleteSetPiece(productionId: number, setPieceId: number) {
    return request<void>(`/productions/${productionId}/set-pieces/${setPieceId}`, {
      method: "DELETE",
    });
  },

  importSetPiecesCsv(productionId: number, file: File) {
    return this.importCatalogCsv(productionId, "set-pieces", file);
  },

  downloadSetPiecesCsvTemplate(productionId: number) {
    return this.downloadCatalogCsvTemplate(productionId, "set-pieces");
  },

  importCatalogCsv(productionId: number, kind: CatalogCsvKind, file: File) {
    const config = CATALOG_CSV_CONFIGS[kind];
    const formData = new FormData();
    formData.append("file", file);
    return request<CatalogImportResult>(
      `/productions/${productionId}/${config.pathSegment}/import`,
      { method: "POST", body: formData },
    );
  },

  downloadCatalogCsvTemplate(productionId: number, kind: CatalogCsvKind) {
    const config = CATALOG_CSV_CONFIGS[kind];
    return downloadAuthenticatedFile(
      `/productions/${productionId}/${config.pathSegment}/import/template`,
      config.templateFilename,
    );
  },

  attachMomentSetPiece(
    productionId: number,
    momentId: number,
    body: {
      set_piece_id: number;
      kind: AssetEventKind;
      character_id?: number | null;
      user_id?: number | null;
      notes?: string | null;
    },
  ) {
    return request<MomentSetPieceEventResponse>(
      `/productions/${productionId}/moments/${momentId}/set-pieces`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  updateMomentSetPiece(
    productionId: number,
    momentId: number,
    momentSetPieceId: number,
    body: {
      kind: AssetEventKind;
      character_id?: number | null;
      user_id?: number | null;
      notes?: string | null;
    },
  ) {
    return request<MomentSetPieceEventResponse>(
      `/productions/${productionId}/moments/${momentId}/set-pieces/${momentSetPieceId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  detachMomentSetPiece(
    productionId: number,
    momentId: number,
    momentSetPieceId: number,
  ) {
    return request<void>(
      `/productions/${productionId}/moments/${momentId}/set-pieces/${momentSetPieceId}`,
      { method: "DELETE" },
    );
  },

  attachMomentEntrance(
    productionId: number,
    momentId: number,
    body: { character_id: number; notes?: string | null },
  ) {
    return request<MomentEntranceResponse>(
      `/productions/${productionId}/moments/${momentId}/entrances`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  detachMomentEntrance(productionId: number, momentId: number, entranceId: number) {
    return request<void>(
      `/productions/${productionId}/moments/${momentId}/entrances/${entranceId}`,
      { method: "DELETE" },
    );
  },

  attachMomentExit(
    productionId: number,
    momentId: number,
    body: { character_id: number; notes?: string | null },
  ) {
    return request<MomentExitResponse>(
      `/productions/${productionId}/moments/${momentId}/exits`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  detachMomentExit(productionId: number, momentId: number, exitId: number) {
    return request<void>(
      `/productions/${productionId}/moments/${momentId}/exits/${exitId}`,
      { method: "DELETE" },
    );
  },

  attachMomentBlocking(
    productionId: number,
    momentId: number,
    body: { character_id: number; notes: string },
  ) {
    return request<MomentBlockingResponse>(
      `/productions/${productionId}/moments/${momentId}/blocking`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  updateMomentBlocking(
    productionId: number,
    momentId: number,
    blockingId: number,
    body: { notes: string },
  ) {
    return request<MomentBlockingResponse>(
      `/productions/${productionId}/moments/${momentId}/blocking/${blockingId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  detachMomentBlocking(productionId: number, momentId: number, blockingId: number) {
    return request<void>(
      `/productions/${productionId}/moments/${momentId}/blocking/${blockingId}`,
      { method: "DELETE" },
    );
  },

  getPropSheetReport(productionId: number) {
    return request<PropSheetEntry[]>(`/productions/${productionId}/reports/prop-sheet`);
  },

  getCueSheetReport(productionId: number) {
    return request<CueSheetCategory[]>(`/productions/${productionId}/reports/cue-sheet`);
  },

  getCostumeChangesReport(productionId: number) {
    return request<CostumeChangeEntry[]>(
      `/productions/${productionId}/reports/costume-changes`,
    );
  },

  getEntranceExitSheetReport(productionId: number) {
    return request<EntranceExitSheetGroup[]>(
      `/productions/${productionId}/reports/entrance-exit-sheet`,
    );
  },

  getBlockingSheetReport(productionId: number) {
    return request<BlockingSheetEntry[]>(
      `/productions/${productionId}/reports/blocking-sheet`,
    );
  },

  getOnStageChartReport(productionId: number) {
    return request<OnStageChartReport>(
      `/productions/${productionId}/reports/on-stage-chart`,
    );
  },

  submitFeedback(body: FeedbackCreate) {
    return request<FeedbackResponse>("/feedback", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
