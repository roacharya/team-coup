# server.py
from __future__ import annotations

import uuid
from typing import Dict, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from game import GameState, InvalidMove


app = FastAPI()

# CORS: for now allow all origins (easy for dev + simple hosting).
# Later you can replace ["*"] with ["https://your-frontend-domain"] if you want.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for dev; tighten in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage (fine for a hobby project / single process deploy)
GAMES: Dict[str, GameState] = {}
TOKENS: Dict[str, Tuple[str, str]] = {}  # token -> (game_id, player_id)


def _get_game_and_player(token: str) -> tuple[GameState, str]:
    try:
        game_id, player_id = TOKENS[token]
    except KeyError:
        raise HTTPException(status_code=401, detail="Invalid player token")
    game = GAMES.get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game, player_id


# ─────────────────────────────────────────────────────────────────────────
# Simple health/root endpoint (for browser sanity checks)
# ─────────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "message": "Team Coup backend running"}


# ─────────────────────────────────────────────────────────────────────────
# Request models
# ─────────────────────────────────────────────────────────────────────────

class CreateGameRequest(BaseModel):
    mode: str  # "normal" | "super"
    name: str
    team: str  # "A" | "B"


class JoinGameRequest(BaseModel):
    game_id: str
    name: str
    team: str  # "A" | "B"


class StartGameRequest(BaseModel):
    player_token: str


class StateRequest(BaseModel):
    player_token: str


class ActionRequest(BaseModel):
    player_token: str
    action: str
    target_id: str | None = None


class BlockRequest(BaseModel):
    player_token: str
    block_type: str


class ChallengeRequest(BaseModel):
    player_token: str


class NoChallengeRequest(BaseModel):
    player_token: str


class NoBlockRequest(BaseModel):
    player_token: str


class FinishExchangeRequest(BaseModel):
    player_token: str
    keep_indices: list[int]


class ChooseLossRequest(BaseModel):
    player_token: str
    card_index: int


# ─────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────

@app.post("/api/create_game")
def create_game(req: CreateGameRequest):
    if req.mode not in ("normal", "super"):
        raise HTTPException(status_code=400, detail="Invalid mode")
    mode = "normal_team" if req.mode == "normal" else "super_team"

    game_id = uuid.uuid4().hex[:8]
    game = GameState(game_id=game_id, mode=mode)
    player_id = game.add_player(req.name, req.team)

    token = uuid.uuid4().hex
    GAMES[game_id] = game
    TOKENS[token] = (game_id, player_id)

    return {"game_id": game_id, "player_token": token}


@app.post("/api/join_game")
def join_game(req: JoinGameRequest):
    game = GAMES.get(req.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.phase != "lobby":
        raise HTTPException(status_code=400, detail="Game already started")

    player_id = game.add_player(req.name, req.team)
    token = uuid.uuid4().hex
    TOKENS[token] = (req.game_id, player_id)
    return {"player_token": token}


@app.post("/api/start_game")
def start_game(req: StartGameRequest):
    game, player_id = _get_game_and_player(req.player_token)
    try:
        game.start_game()
    except InvalidMove as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@app.post("/api/state")
def get_state(req: StateRequest):
    game, player_id = _get_game_and_player(req.player_token)
    return game.to_public_view(player_id)


@app.post("/api/action")
def do_action(req: ActionRequest):
    game, player_id = _get_game_and_player(req.player_token)
    try:
        game.player_action(player_id, req.action, req.target_id)
    except InvalidMove as e:
        raise HTTPException(status_code=400, detail=str(e))
    return game.to_public_view(player_id)


@app.post("/api/block")
def do_block(req: BlockRequest):
    game, player_id = _get_game_and_player(req.player_token)
    try:
        game.player_block(player_id, req.block_type)
    except InvalidMove as e:
        raise HTTPException(status_code=400, detail=str(e))
    return game.to_public_view(player_id)


@app.post("/api/challenge")
def do_challenge(req: ChallengeRequest):
    game, player_id = _get_game_and_player(req.player_token)
    try:
        game.player_challenge(player_id)
    except InvalidMove as e:
        raise HTTPException(status_code=400, detail=str(e))
    return game.to_public_view(player_id)


@app.post("/api/no_challenge")
def no_challenge(req: NoChallengeRequest):
    game, player_id = _get_game_and_player(req.player_token)
    try:
        game.player_no_challenge(player_id)
    except InvalidMove as e:
        raise HTTPException(status_code=400, detail=str(e))
    return game.to_public_view(player_id)


@app.post("/api/no_block")
def no_block(req: NoBlockRequest):
    game, player_id = _get_game_and_player(req.player_token)
    try:
        game.player_no_block(player_id)
    except InvalidMove as e:
        raise HTTPException(status_code=400, detail=str(e))
    return game.to_public_view(player_id)


@app.post("/api/finish_exchange")
def finish_exchange(req: FinishExchangeRequest):
    game, player_id = _get_game_and_player(req.player_token)
    try:
        game.finish_exchange(player_id, req.keep_indices)
    except InvalidMove as e:
        raise HTTPException(status_code=400, detail=str(e))
    return game.to_public_view(player_id)


@app.post("/api/choose_loss")
def choose_loss(req: ChooseLossRequest):
    game, player_id = _get_game_and_player(req.player_token)
    try:
        game.choose_loss_card(player_id, req.card_index)
    except InvalidMove as e:
        raise HTTPException(status_code=400, detail=str(e))
    return game.to_public_view(player_id)
