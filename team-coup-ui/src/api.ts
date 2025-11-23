// src/api.ts
import type { GameView } from "./types";

// Base URL for the backend API.
// In dev, we'll default to http://localhost:8000
// In production, you'll set VITE_API_BASE_URL to your deployed backend URL.
const RAW_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Ensure no trailing slash, then append /api
const API_BASE = RAW_BASE.replace(/\/+$/, "") + "/api";

async function postJSON<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function createGame(
  mode: "normal" | "super",
  name: string,
  team: "A" | "B"
): Promise<{ game_id: string; player_token: string }> {
  return postJSON("/create_game", { mode, name, team });
}

export async function joinGame(
  game_id: string,
  name: string,
  team: "A" | "B"
): Promise<{ player_token: string }> {
  return postJSON("/join_game", { game_id, name, team });
}

export async function startGame(
  player_token: string
): Promise<{ ok: boolean }> {
  return postJSON("/start_game", { player_token });
}

export async function fetchState(player_token: string): Promise<GameView> {
  return postJSON("/state", { player_token });
}

export async function sendAction(
  player_token: string,
  action: string,
  target_id?: string | null
): Promise<GameView> {
  return postJSON("/action", {
    player_token,
    action,
    target_id: target_id ?? null,
  });
}

export async function sendBlock(
  player_token: string,
  block_type: string
): Promise<GameView> {
  return postJSON("/block", { player_token, block_type });
}

export async function sendChallenge(
  player_token: string
): Promise<GameView> {
  return postJSON("/challenge", { player_token });
}

export async function sendNoChallenge(
  player_token: string
): Promise<GameView> {
  return postJSON("/no_challenge", { player_token });
}

export async function sendNoBlock(
  player_token: string
): Promise<GameView> {
  return postJSON("/no_block", { player_token });
}

export async function finishExchange(
  player_token: string,
  keep_indices: number[]
): Promise<GameView> {
  return postJSON("/finish_exchange", { player_token, keep_indices });
}

export async function chooseLoss(
  player_token: string,
  card_index: number
): Promise<GameView> {
  return postJSON("/choose_loss", { player_token, card_index });
}
