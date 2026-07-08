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
}

export interface DialogueLineResponse {
  character_name: string;
  dialogue_text: string;
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
