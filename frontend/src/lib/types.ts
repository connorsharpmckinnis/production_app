export type AppRole = "Admin" | "Director" | "Actor";

export type MomentType =
  | "stage_direction"
  | "dialogue"
  | "song_header"
  | "song_attribution"
  | "lyric"
  | "author_note";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string | null;
  is_active: boolean;
  roles: AppRole[];
}

export type FeedbackKind = "bug" | "idea";

export interface FeedbackCreate {
  kind: FeedbackKind;
  title: string;
  description: string;
  page_path?: string | null;
  user_agent?: string | null;
}

export interface FeedbackResponse {
  issue_number: number;
  issue_url: string;
}

export interface ProductionCreate {
  title: string;
  season?: string | null;
}

export interface ProductionResponse {
  id: number;
  title: string;
  season: string | null;
  author: string | null;
  created_at: string;
}

export interface ImportSuccessResponse {
  acts_created: number;
  scenes_created: number;
  moments_created: number;
  characters_created: number;
  songs_created: number;
}

export interface ImportLineErrorDetail {
  line_number: number;
  line_content: string;
  message: string;
  kind?: string | null;
  source_format?: string | null;
  paragraph_number?: number | null;
  paragraph_style?: string | null;
  context_snippet?: string | null;
  song_title?: string | null;
}

export interface ImportErrorsDetail {
  message: string;
  errors: ImportLineErrorDetail[];
}

export interface CatalogImportRowError {
  row: number;
  message: string;
}

export interface CatalogImportResult {
  created: number;
  skipped: number;
  errors: CatalogImportRowError[];
  warnings: string[];
}

export interface SceneSummary {
  id: number;
  number: number;
  title: string | null;
  sort_order: number;
}

export interface ActSummary {
  id: number;
  number: number;
  title: string;
  sort_order: number;
  scenes: SceneSummary[];
}

export interface MomentSummary {
  id: number;
  sequence_number: number;
  moment_type: MomentType;
  original_text: string;
  display_text: string;
  song_id: number | null;
  speaking_character_ids: number[];
  has_props: boolean;
  has_cues: boolean;
  has_set_piece: boolean;
  has_costume: boolean;
  has_entrance: boolean;
  has_exit: boolean;
  has_blocking: boolean;
  on_stage_character_ids: number[];
}

export interface DialogueLineResponse {
  id: number;
  character_id: number;
  character_name: string;
  dialogue_text: string;
}

export interface LyricLineResponse {
  id: number;
  character_id: number;
  character_name: string;
  lyric_text: string;
}

export interface MomentTypeResponse {
  id: number;
  name: string;
  description: string | null;
}

export interface SongDetailResponse {
  id: number;
  title: string;
  composer: string | null;
  lyricist: string | null;
  description: string | null;
}

export interface PropResponse {
  id: number;
  name: string;
  description: string | null;
  notes: string | null;
}

export type AssetEventKind = "on" | "off";

export interface MomentPropEventResponse {
  id: number;
  prop_id: number;
  prop_name: string;
  kind: AssetEventKind;
  character_id: number | null;
  character_name: string | null;
  user_id: number | null;
  user_display_name: string | null;
  notes: string | null;
  prior_on_moment_id?: number | null;
  prior_on_scene_id?: number | null;
  prior_on_act_number?: number | null;
  prior_on_scene_number?: number | null;
  prior_on_sequence_number?: number | null;
}

export interface PropInPlayResponse {
  prop_id: number;
  prop_name: string;
  character_id: number | null;
  character_name: string | null;
  user_id: number | null;
  user_display_name: string | null;
  notes: string | null;
  source_moment_id: number;
  source_scene_id: number;
  source_act_number: number;
  source_scene_number: number;
  source_sequence_number: number;
  next_change_moment_id: number | null;
  next_change_scene_id: number | null;
  next_change_act_number: number | null;
  next_change_scene_number: number | null;
  next_change_sequence_number: number | null;
}

export interface CueCategoryResponse {
  id: number;
  name: string;
  description: string | null;
}

export interface CueResponse {
  id: number;
  cue_category_id: number;
  cue_category_name: string;
  title: string;
  notes: string | null;
  payload: Record<string, unknown> | null;
}

export interface NoteResponse {
  id: number;
  user_id: number;
  author_display_name: string;
  visibility: "public" | "private";
  moment_id: number | null;
  character_id: number | null;
  content: string;
  created_at: string;
  is_mine: boolean;
}

export interface MomentSetPieceEventResponse {
  id: number;
  set_piece_id: number;
  set_piece_name: string;
  kind: AssetEventKind;
  character_id: number | null;
  character_name: string | null;
  user_id: number | null;
  user_display_name: string | null;
  notes: string | null;
  prior_on_moment_id?: number | null;
  prior_on_scene_id?: number | null;
  prior_on_act_number?: number | null;
  prior_on_scene_number?: number | null;
  prior_on_sequence_number?: number | null;
}

export interface SetPieceInPlayResponse {
  set_piece_id: number;
  set_piece_name: string;
  character_id: number | null;
  character_name: string | null;
  user_id: number | null;
  user_display_name: string | null;
  notes: string | null;
  source_moment_id: number;
  source_scene_id: number;
  source_act_number: number;
  source_scene_number: number;
  source_sequence_number: number;
  next_change_moment_id: number | null;
  next_change_scene_id: number | null;
  next_change_act_number: number | null;
  next_change_scene_number: number | null;
  next_change_sequence_number: number | null;
}

export interface OnStageCharacterResponse {
  id: number;
  name: string;
}

export interface MomentEntranceResponse {
  id: number;
  character_id: number;
  character_name: string;
  notes: string | null;
}

export interface MomentExitResponse {
  id: number;
  character_id: number;
  character_name: string;
  notes: string | null;
}

export interface MomentBlockingResponse {
  id: number;
  character_id: number;
  character_name: string;
  notes: string;
}

export interface MomentDetailResponse {
  id: number;
  sequence_number: number;
  moment_type: MomentType;
  original_text: string;
  parsed_text: string | null;
  song_id: number | null;
  song_title: string | null;
  dialogue: DialogueLineResponse[];
  lyrics: LyricLineResponse[];
  stage_direction: string | null;
  props: MomentPropEventResponse[];
  props_in_play: PropInPlayResponse[];
  set_pieces: MomentSetPieceEventResponse[];
  set_pieces_in_play: SetPieceInPlayResponse[];
  costume_events: MomentCostumeEventResponse[];
  costumes_wearing: CostumeWearingResponse[];
  entrances: MomentEntranceResponse[];
  exits: MomentExitResponse[];
  blocking: MomentBlockingResponse[];
  on_stage_characters: OnStageCharacterResponse[];
  cues: CueResponse[];
  notes: NoteResponse[];
  is_bookmarked: boolean;
}

export interface AppSettingsResponse {
  show_original_text: boolean;
  show_parsed_text: boolean;
  default_message_rotation_seconds: number;
}

export type OverviewMessageKind = "encouragement" | "scripture" | "announcement";

export type EncouragementBand =
  | "0"
  | "1-24"
  | "25-49"
  | "50-74"
  | "75-89"
  | "90-99"
  | "100";

export interface OverviewMessageDefaultItem {
  band: EncouragementBand | string;
  title?: string | null;
  body: string;
  sort_order?: number;
  active?: boolean;
}

export interface OverviewMessageDefaultResponse extends OverviewMessageDefaultItem {
  id: number;
  sort_order: number;
  active: boolean;
  title: string | null;
}

export interface ProductionOverviewMessageItem {
  kind: OverviewMessageKind | string;
  band?: string | null;
  title?: string | null;
  body: string;
  sort_order?: number;
  active?: boolean;
}

export interface ProductionOverviewMessageResponse extends ProductionOverviewMessageItem {
  id: number;
  sort_order: number;
  active: boolean;
  title: string | null;
  band: string | null;
}

export interface ProductionOverviewSettingsResponse {
  message_rotation_seconds: number | null;
  effective_rotation_seconds: number;
}

export interface SpotlightMessage {
  kind: string;
  band: string | null;
  title: string | null;
  body: string;
  source: string;
}

export interface ReadinessDimension {
  key: string;
  label: string;
  score: number | null;
  summary: string;
  href_hint: string;
  gaps: string[];
}

export interface WireResponse {
  id: number;
  identifier: string;
  notes: string | null;
}

export interface PackResponse {
  id: number;
  identifier: string;
  notes: string | null;
}

export interface LavChartSceneColumn {
  id: number;
  act_id: number;
  act_number: number;
  act_title: string | null;
  scene_number: number;
  scene_title: string | null;
}

export interface LavChartRow {
  row_key: string;
  user_id: number | null;
  character_id: number | null;
  label: string;
  character_ids: number[];
  character_names: string[];
  need_scene_ids: number[];
}

export interface LavWireCell {
  row_key: string;
  scene_id: number;
  wire_id: number | null;
}

export interface LavPackCell {
  row_key: string;
  scene_id: number;
  pack_id: number | null;
}

export interface LavChartIssue {
  code: string;
  severity: string;
  message: string;
  row_key: string | null;
  scene_id: number | null;
  asset_id: number | null;
}

export interface LavChartCatalogItem {
  id: number;
  identifier: string;
  notes: string | null;
}

export interface LavChartResponse {
  scenes: LavChartSceneColumn[];
  rows: LavChartRow[];
  wires: LavChartCatalogItem[];
  packs: LavChartCatalogItem[];
  wire_cells: LavWireCell[];
  pack_cells: LavPackCell[];
  issues: LavChartIssue[];
  rules: string[];
}

export interface SetPieceResponse {
  id: number;
  name: string;
  mobile: boolean;
  description: string | null;
}

export interface CostumeResponse {
  id: number;
  character_id: number;
  character_name: string;
  name: string;
  description: string | null;
}

export interface MomentCostumeEventResponse {
  id: number;
  character_id: number;
  character_name: string;
  kind: AssetEventKind;
  costume_id: number | null;
  costume_name: string | null;
  notes: string | null;
}

export interface CostumeWearingResponse {
  character_id: number;
  character_name: string;
  costume_id: number;
  costume_name: string;
  notes: string | null;
}

export interface PropSheetMomentReference {
  moment_id: number;
  sequence_number: number;
  act_number: number;
  scene_number: number;
  scene_title: string | null;
  kind: AssetEventKind;
  character_name: string | null;
  user_display_name: string | null;
  notes: string | null;
}

export interface PropSheetEntry {
  prop_id: number;
  prop_name: string;
  description: string | null;
  moments: PropSheetMomentReference[];
}

export interface CueSheetMomentReference {
  moment_id: number;
  sequence_number: number;
  act_number: number;
  scene_number: number;
  scene_title: string | null;
  cue_id: number;
  title: string;
  notes: string | null;
  payload: Record<string, unknown> | null;
}

export interface CueSheetCategory {
  cue_category_id: number;
  cue_category_name: string;
  cues: CueSheetMomentReference[];
}

export interface CostumeChangeEntry {
  moment_id: number;
  sequence_number: number;
  act_number: number;
  scene_number: number;
  scene_title: string | null;
  character_id: number;
  character_name: string;
  kind: AssetEventKind;
  costume_id: number | null;
  costume_name: string | null;
  notes: string | null;
}

export interface EntranceExitSheetRow {
  moment_id: number;
  sequence_number: number;
  movement_type: "entrance" | "exit";
  character_id: number;
  character_name: string;
  notes: string | null;
}

export interface EntranceExitSheetGroup {
  scene_id: number;
  act_number: number;
  scene_number: number;
  scene_title: string | null;
  rows: EntranceExitSheetRow[];
}

export interface BlockingSheetEntry {
  moment_id: number;
  sequence_number: number;
  act_number: number;
  scene_number: number;
  scene_title: string | null;
  character_id: number;
  character_name: string;
  notes: string;
}

export interface ProductionOverviewResponse {
  id: number;
  title: string;
  season: string | null;
  author: string | null;
  created_at: string;
  imported_at: string | null;
  act_count: number;
  scene_count: number;
  moment_count: number;
  character_count: number;
  cast_count: number;
  readiness_percent: number | null;
  dimensions: ReadinessDimension[];
  readiness_band: string;
  rotation_seconds: number;
  spotlight: SpotlightMessage[];
}

export interface CharacterDetailResponse {
  id: number;
  name: string;
  description: string | null;
  scene_count: number;
  assigned_actor: { user_id: number; display_name: string } | null;
}

export interface CastableUserResponse {
  id: number;
  display_name: string;
}

export interface BookmarkResponse {
  id: number;
  moment_id: number;
  label: string | null;
  created_at: string;
  production_id: number;
  production_title: string;
  scene_id: number;
  act_number: number;
  scene_number: number;
  sequence_number: number;
  moment_preview: string;
}

export interface GroupResponse {
  id: number;
  name: string;
  description: string | null;
  character_ids: number[];
  user_ids: number[];
}

export interface MomentListFilters {
  characterIds?: number[];
  groupId?: number;
  search?: string;
  cueOnly?: boolean;
  songId?: number;
  propId?: number;
  cueCategoryId?: number;
  setPieceId?: number;
  costumeOnly?: boolean;
  entranceOnly?: boolean;
  exitOnly?: boolean;
  blockingOnly?: boolean;
  blockingCharacterId?: number;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  role_name: AppRole;
}

export interface ResetPasswordRequest {
  password: string;
}

export type NotificationKind = "announcement" | "system" | "mention" | "task_assigned";
export type NotificationSeverity = "info" | "success" | "warning" | "urgent";
export type AnnouncementCtaKind = "internal" | "external";
export type AnnouncementCtaStyle = "primary" | "secondary" | "link";

export interface AnnouncementCtaCreate {
  label: string;
  kind: AnnouncementCtaKind;
  target: string;
  style?: AnnouncementCtaStyle;
  sort_order?: number;
}

export interface AnnouncementCtaResponse {
  id: number;
  label: string;
  kind: AnnouncementCtaKind;
  target: string;
  style: AnnouncementCtaStyle;
  sort_order: number;
}

export interface AnnouncementCreate {
  title: string;
  body: string;
  severity?: NotificationSeverity;
  show_as_banner?: boolean;
  show_as_modal?: boolean;
  audience_roles: AppRole[];
  route_filter?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active?: boolean;
  priority?: number;
  ctas?: AnnouncementCtaCreate[];
}

export interface AnnouncementUpdate {
  title?: string;
  body?: string;
  severity?: NotificationSeverity;
  show_as_banner?: boolean;
  show_as_modal?: boolean;
  audience_roles?: AppRole[];
  route_filter?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active?: boolean;
  priority?: number;
  ctas?: AnnouncementCtaCreate[];
}

export interface AnnouncementResponse {
  id: number;
  title: string;
  body: string;
  severity: NotificationSeverity;
  show_as_banner: boolean;
  show_as_modal: boolean;
  production_id: number | null;
  route_filter: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  priority: number;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
  audience_roles: AppRole[];
  ctas: AnnouncementCtaResponse[];
}

export interface NotificationInboxItem {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string | null;
  production_id: number | null;
  production_title: string | null;
  announcement_id: number | null;
  actor_user_id: number | null;
  actor_display_name: string | null;
  resource_type: string | null;
  resource_id: number | null;
  deep_link: string | null;
  severity: NotificationSeverity | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  show_as_banner: boolean;
  show_as_modal: boolean;
  route_filter: string | null;
  priority: number;
  ctas: AnnouncementCtaResponse[];
}

export interface NotificationInboxResponse {
  unread_count: number;
  items: NotificationInboxItem[];
  active_banner: NotificationInboxItem | null;
  pending_modal: NotificationInboxItem | null;
}
