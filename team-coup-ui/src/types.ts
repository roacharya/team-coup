// src/types.ts

export type GamePhase =
  | "lobby"
  | "action_selection"
  | "block_window"
  | "challenge_window"
  | "swap_choice"
  | "loss_choice"
  | "game_over";

export type GameMode = "normal_team" | "super_team";
export type Team = "A" | "B";

export interface PublicPlayer {
  player_id: string;
  name: string;
  team: Team;
  coins: number;
  alive: boolean;
  num_cards: number;
  cards: string[] | null; // full roles only for "you"
}

export interface PublicAction {
  actor_id: string;
  action: string;
  target_id: string | null;
}

export interface PublicBlock {
  blocker_id: string;
  block_type: string;
}

export interface GameView {
  game_id: string;
  mode: GameMode;
  phase: GamePhase;

  you: string;
  current_player: string | null;
  turn_order: string[];

  players: Record<string, PublicPlayer>;
  winner_team: Team | null;

  logs: string[];

  pending_action: PublicAction | null;
  pending_block: PublicBlock | null;

  exchange_pool_size: number;
  exchange_cards?: string[] | null;

  loss_choice_player_id?: string | null;
  loss_choice_cards?: string[] | null;

  deck_size: number;
  revealed_cards: string[];
}
