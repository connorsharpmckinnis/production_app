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
  song_id: number | null;
  speaking_character_ids: number[];
}

export interface DialogueLineResponse {
  character_id: number;
  character_name: string;
  dialogue_text: string;
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
  notes: NoteResponse[];
  is_bookmarked: boolean;
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
