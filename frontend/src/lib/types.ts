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
  has_microphone: boolean;
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

export interface MomentPropResponse {
  id: number;
  prop_id: number;
  prop_name: string;
  character_id: number | null;
  character_name: string | null;
  notes: string | null;
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

export interface MomentMicrophoneResponse {
  id: number;
  microphone_id: number;
  microphone_identifier: string;
  character_id: number | null;
  character_name: string | null;
  notes: string | null;
}

export interface MomentSetPieceResponse {
  id: number;
  set_piece_id: number;
  set_piece_name: string;
  notes: string | null;
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
  stage_direction: string | null;
  props: MomentPropResponse[];
  microphones: MomentMicrophoneResponse[];
  set_pieces: MomentSetPieceResponse[];
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
}

export interface MicrophoneResponse {
  id: number;
  identifier: string;
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
  scene_id: number;
  scene_number: number;
  scene_title: string | null;
  name: string;
  description: string | null;
}

export interface PropSheetMomentReference {
  moment_id: number;
  sequence_number: number;
  act_number: number;
  scene_number: number;
  scene_title: string | null;
  character_name: string | null;
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

export interface CostumeBySceneEntry {
  costume_id: number;
  character_id: number;
  character_name: string;
  name: string;
  description: string | null;
}

export interface CostumesBySceneGroup {
  scene_id: number;
  act_number: number;
  scene_number: number;
  scene_title: string | null;
  costumes: CostumeBySceneEntry[];
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
  microphoneId?: number;
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
