// Hand-written row types matching supabase/migrations/001_schema.sql.
// Money fields are whole credits.
export type RoomStatus = 'draft' | 'lobby' | 'live' | 'paused' | 'ended';
export type LotStatus = 'upcoming' | 'live' | 'paused' | 'sold' | 'unsold';
export type ParticipantStatus = 'pending' | 'approved' | 'removed';

export interface Room {
  id: string;
  code: string;
  name: string;
  status: RoomStatus;
  default_budget: number;
  min_increment: number;
  timer_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface Lot {
  id: string;
  room_id: string;
  position: number;
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  min_increment: number | null;
  status: LotStatus;
  current_bid: number | null;
  current_team_id: string | null;
  ends_at: string | null;
  paused_remaining_ms: number | null;
}

export interface Team {
  id: string;
  room_id: string;
  name: string;
  budget: number;
}

export interface Participant {
  id: string;
  room_id: string;
  team_id: string | null;
  user_id: string;
  display_name: string;
  status: ParticipantStatus;
  joined_at: string;
}

export interface Bid {
  id: string;
  room_id: string;
  lot_id: string;
  team_id: string;
  participant_id: string | null;
  amount: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  room_id: string;
  lot_id: string;
  team_id: string;
  price: number;
  created_at: string;
}

export interface LeaderRow {
  team_id: string;
  team_name: string;
  budget: number;
  spent: number;
  remaining: number;
  lots_won: number;
}

export interface JoinStatus {
  room_id: string;
  room_code: string;
  room_name: string;
  room_status: RoomStatus;
  participant_status: ParticipantStatus;
  display_name: string;
  team_id: string | null;
  team_name: string | null;
}
