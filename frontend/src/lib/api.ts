import {
  CATALOG_CSV_CONFIGS,
  parseContentDispositionFilename,
  type CatalogCsvKind,
} from "./catalogCsv";
import type {
  ActSummary,
  AppSettingsResponse,
  BookmarkResponse,
  CastableUserResponse,
  CatalogImportResult,
  CharacterDetailResponse,
  CostumeResponse,
  CostumesBySceneGroup,
  CreateUserRequest,
  CueCategoryResponse,
  CueResponse,
  CueSheetCategory,
  EntranceExitSheetGroup,
  BlockingSheetEntry,
  GroupResponse,
  ImportLineErrorDetail,
  ImportSuccessResponse,
  LoginRequest,
  MicrophoneResponse,
  MomentBlockingResponse,
  MomentEntranceResponse,
  MomentExitResponse,
  MomentDetailResponse,
  MomentListFilters,
  MomentMicrophoneResponse,
  MomentPropResponse,
  MomentSetPieceResponse,
  MomentSummary,
  MomentTypeResponse,
  NoteResponse,
  OverviewMessageDefaultItem,
  OverviewMessageDefaultResponse,
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
  if (filters.songId) {
    params.set("song_id", String(filters.songId));
  }
  if (filters.propId) {
    params.set("prop_id", String(filters.propId));
  }
  if (filters.cueCategoryId) {
    params.set("cue_category_id", String(filters.cueCategoryId));
  }
  if (filters.microphoneId) {
    params.set("microphone_id", String(filters.microphoneId));
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
    body: { prop_id: number; character_id?: number | null; notes?: string | null },
  ) {
    return request<MomentPropResponse>(
      `/productions/${productionId}/moments/${momentId}/props`,
      { method: "POST", body: JSON.stringify(body) },
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
    body: { character_id: number; scene_id: number; name: string; description?: string | null },
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
      scene_id?: number;
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

  listMicrophones(productionId: number) {
    return request<MicrophoneResponse[]>(`/productions/${productionId}/microphones`);
  },

  createMicrophone(
    productionId: number,
    body: { identifier: string; notes?: string | null },
  ) {
    return request<MicrophoneResponse>(`/productions/${productionId}/microphones`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateMicrophone(
    productionId: number,
    microphoneId: number,
    body: { identifier?: string; notes?: string | null },
  ) {
    return request<MicrophoneResponse>(
      `/productions/${productionId}/microphones/${microphoneId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  },

  deleteMicrophone(productionId: number, microphoneId: number) {
    return request<void>(`/productions/${productionId}/microphones/${microphoneId}`, {
      method: "DELETE",
    });
  },

  importMicrophonesCsv(productionId: number, file: File) {
    return this.importCatalogCsv(productionId, "microphones", file);
  },

  downloadMicrophonesCsvTemplate(productionId: number) {
    return this.downloadCatalogCsvTemplate(productionId, "microphones");
  },

  attachMomentMicrophone(
    productionId: number,
    momentId: number,
    body: { microphone_id: number; character_id?: number | null; notes?: string | null },
  ) {
    return request<MomentMicrophoneResponse>(
      `/productions/${productionId}/moments/${momentId}/microphones`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  detachMomentMicrophone(
    productionId: number,
    momentId: number,
    momentMicrophoneId: number,
  ) {
    return request<void>(
      `/productions/${productionId}/moments/${momentId}/microphones/${momentMicrophoneId}`,
      { method: "DELETE" },
    );
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
    body: { set_piece_id: number; notes?: string | null },
  ) {
    return request<MomentSetPieceResponse>(
      `/productions/${productionId}/moments/${momentId}/set-pieces`,
      { method: "POST", body: JSON.stringify(body) },
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

  getCostumesBySceneReport(productionId: number) {
    return request<CostumesBySceneGroup[]>(
      `/productions/${productionId}/reports/costumes-by-scene`,
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
};
