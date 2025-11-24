// src/components/GameLayout.tsx
import React, { useState, useEffect, useRef } from "react";
import type { GameView, PublicPlayer } from "../types";

interface Props {
  view: GameView;
  gameId?: string | null;
  onStartGame: () => void;
  onAction: (action: string, target_id?: string | null) => void;
  onBlock: (block_type: string) => void;
  onChallenge: () => void;
  onNoChallenge: () => void;
  onNoBlock: () => void;
  onFinishExchange: (keepIndices: number[]) => void;
  onChooseLoss: (cardIndex: number) => void;
  youToken: string;
}

const ROLE_IMAGES: Record<string, string> = {
  Duke: "/cards/duke.png",
  Assassin: "/cards/assassin.png",
  Captain: "/cards/captain.png",
  Ambassador: "/cards/ambassador.png",
  Contessa: "/cards/contessa.png",
};

const cardBackImage = "/cards/back.png";

const GameLayout: React.FC<Props> = ({
  view,
  gameId,
  onStartGame,
  onAction,
  onBlock,
  onChallenge,
  onNoChallenge,
  onNoBlock,
  onFinishExchange,
  onChooseLoss,
}) => {
  const you = view.players[view.you];
  const isGameOver = view.phase === "game_over";
  const isYourTurn = view.current_player === view.you;

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  // Auto-scroll table log
  const logEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [view.logs.length]);

  // Rotate turn order so you're always bottom seat (index 0), then clockwise
  const orderedIds = view.turn_order;
  const youIndex = orderedIds.indexOf(you.player_id);
  const rotatedIds =
    youIndex === -1
      ? orderedIds
      : [...orderedIds.slice(youIndex), ...orderedIds.slice(0, youIndex)];

  const seats: PublicPlayer[] = rotatedIds
    .map((id) => view.players[id])
    .filter(Boolean) as PublicPlayer[];

  const canAct =
    view.phase === "action_selection" && isYourTurn && !isGameOver;

  const targetRequiredActions = new Set([
    "coup",
    "assassinate",
    "super_assassinate",
    "steal",
    "super_steal",
    "super_coup",
  ]);

  const selectedTargetPlayer =
    selectedTarget && view.players[selectedTarget]
      ? view.players[selectedTarget]
      : null;
  const targetHasCoins =
    selectedTargetPlayer && selectedTargetPlayer.coins > 0;

  const selectOrUseTarget = (action: string) => {
    if (targetRequiredActions.has(action)) {
      if (!selectedTarget) return;
      onAction(action, selectedTarget);
      setSelectedTarget(null);
    } else {
      onAction(action);
    }
  };

  const handleSeatClick = (player: PublicPlayer) => {
    if (!player.alive) return;
    if (player.team === you.team) return;
    if (player.player_id === you.player_id) return;
    setSelectedTarget((prev) =>
      prev === player.player_id ? null : player.player_id
    );
  };

  const currentActionSummary = buildCurrentActionSummary(view);

  return (
    <div className="grid lg:grid-cols-[2.2fr_1fr] gap-5">
      {/* Main table area */}
      <div className="rounded-3xl bg-slate-950/60 border border-slate-800 p-4 md:p-5 flex flex-col gap-4">
        {/* Header status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs uppercase tracking-wide text-slate-300">
              {view.mode === "super_team" ? "Super Team Coup" : "Team Coup"}
            </div>
            <div className="text-xs text-slate-400">
              Phase:{" "}
              <span className="font-semibold text-table-accent">
                {view.phase.replace("_", " ")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700">
              You:{" "}
              <span className="font-semibold text-table-accent">
                {you.name}
              </span>
              <span className="ml-1 text-slate-400">
                {" "}
                Team {you.team} · {you.coins} coins
              </span>
            </div>
          </div>
        </div>

        {/* Circular table */}
        <div className="relative h-72 md:h-80 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 overflow-hidden">
          <div className="absolute inset-10 rounded-full border border-slate-800/70 bg-slate-900/70 shadow-inner" />

          {/* Center: deck + revealed cards */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-3">
              {/* Deck */}
              <div className="relative w-10 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shadow-card">
                <img
                  src={cardBackImage}
                  alt="Deck"
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="px-2 py-1 rounded-md bg-slate-950/80 border border-slate-600 text-[10px] font-mono text-slate-50">
                    {view.deck_size ?? 0}
                  </div>
                </div>
              </div>
              {/* Revealed cards */}
              {view.revealed_cards && view.revealed_cards.length > 0 && (
                <div className="flex -space-x-3">
                  {view.revealed_cards.slice(-5).map((role, idx) => {
                    const img = ROLE_IMAGES[role] ?? cardBackImage;
                    return (
                      <div
                        key={idx}
                        className="w-10 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shadow-sm"
                      >
                        <img
                          src={img}
                          alt={role}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Player seats (clockwise) */}
          {seats.map((p, idx) => (
            <PlayerSeat
              key={p.player_id}
              player={p}
              index={idx}
              total={seats.length}
              isYou={p.player_id === you.player_id}
              isTurn={view.current_player === p.player_id}
              isTarget={selectedTarget === p.player_id}
              onClick={() => handleSeatClick(p)}
            />
          ))}
        </div>

        {/* Your cards */}
        <div className="mt-2">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">
            Your influence
          </h3>
          <div className="flex gap-3">
            {you.cards && you.cards.length > 0 ? (
              you.cards.map((role, idx) => {
                const img = ROLE_IMAGES[role] ?? cardBackImage;
                return (
                  <div
                    key={idx}
                    className="relative w-24 h-36 rounded-3xl overflow-hidden shadow-card border border-slate-700 bg-slate-900/90"
                  >
                    <img
                      src={img}
                      alt={role}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 left-1 right-1 text-[11px] bg-slate-950/80 rounded-xl px-2 py-1 text-center border border-slate-700/80">
                      {role}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-500">
                You have no remaining influence.
              </div>
            )}
          </div>
        </div>

        {/* Phase / action controls */}
        <ActionPanel
          view={view}
          you={you}
          canAct={canAct}
          selectedTarget={selectedTarget}
          targetHasCoins={!!targetHasCoins}
          selectOrUseTarget={selectOrUseTarget}
          onStartGame={onStartGame}
          onBlock={onBlock}
          onChallenge={onChallenge}
          onNoChallenge={onNoChallenge}
          onNoBlock={onNoBlock}
          onFinishExchange={onFinishExchange}
          onChooseLoss={onChooseLoss}
          currentActionSummary={currentActionSummary}
        />
      </div>

      {/* Right sidebar: table log */}
      <div className="rounded-3xl bg-slate-950/70 border border-slate-800 p-4 flex flex-col gap-3 max-h-[32rem]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">Table log</h3>
          {gameId && (
            <div className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 font-mono text-slate-300">
              Game {gameId}
            </div>
          )}
        </div>

        {currentActionSummary && (
          <div className="text-[11px] rounded-2xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-slate-200">
            <span className="font-semibold text-table-accent">
              Current action:
            </span>{" "}
            {currentActionSummary}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1 text-xs">
          {view.logs.length === 0 && (
            <div className="text-slate-500 italic">
              Game events will appear here.
            </div>
          )}
          {view.logs.map((entry, idx) => (
            <div
              key={idx}
              className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80"
            >
              {entry}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {view.winner_team && (
          <div className="text-xs text-table-accentSoft bg-emerald-900/40 border border-emerald-700/60 px-3 py-2 rounded-2xl">
            Team {view.winner_team} wins! You can create a new table from the
            lobby.
          </div>
        )}
      </div>
    </div>
  );
};

function formatActionPhrase(
  base: string,
  action: string,
  targetName: string | null
): string {
  if (!targetName) return base;
  if (action === "steal" || action === "super_steal") {
    return `${base} from ${targetName}`;
  }
  if (
    action === "assassinate" ||
    action === "super_assassinate" ||
    action === "coup" ||
    action === "super_coup"
  ) {
    return `${base} on ${targetName}`;
  }
  return `${base} on ${targetName}`;
}

// This one is global (no "you" personalization), so we keep names as-is
function buildCurrentActionSummary(view: GameView): string | null {
  const pa = view.pending_action;
  const pb = view.pending_block;

  if (pb && pa) {
    const blocker = view.players[pb.blocker_id];
    const actor = view.players[pa.actor_id];
    if (!blocker || !actor) return null;

    const targetName =
      pa.target_id && view.players[pa.target_id]
        ? view.players[pa.target_id].name
        : null;
    const base = humanAction(pa.action);
    const actionPhrase = formatActionPhrase(base, pa.action, targetName);

    return `${blocker.name} attempts to block ${actor.name}'s ${actionPhrase}`;
  }

  if (pa) {
    const actor = view.players[pa.actor_id];
    if (!actor) return null;
    const targetName =
      pa.target_id && view.players[pa.target_id]
        ? view.players[pa.target_id].name
        : null;
    const base = humanAction(pa.action);
    const phrase = formatActionPhrase(base, pa.action, targetName);
    return `${actor.name} attempts ${phrase}`;
  }
  return null;
}

interface PlayerSeatProps {
  player: PublicPlayer;
  index: number;
  total: number;
  isYou: boolean;
  isTurn: boolean;
  isTarget: boolean;
  onClick: () => void;
}

function seatPositionClass(index: number, total: number): string {
  // 2v2: 0 bottom, then clockwise: left, top, right
  if (total === 4) {
    switch (index) {
      case 0:
        return "bottom-4 left-1/2 -translate-x-1/2";
      case 1:
        return "top-1/2 left-4 -translate-y-1/2";
      case 2:
        return "top-4 left-1/2 -translate-x-1/2";
      case 3:
        return "top-1/2 right-4 -translate-y-1/2";
      default:
        return "";
    }
  }
  // 3v3: 0 bottom, then clockwise hex
  if (total === 6) {
    switch (index) {
      case 0:
        return "bottom-4 left-1/2 -translate-x-1/2";
      case 1:
        return "bottom-10 left-10";
      case 2:
        return "top-10 left-10";
      case 3:
        return "top-4 left-1/2 -translate-x-1/2";
      case 4:
        return "top-10 right-10";
      case 5:
        return "bottom-10 right-10";
      default:
        return "";
    }
  }
  return "bottom-4 left-1/2 -translate-x-1/2";
}

const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  index,
  total,
  isYou,
  isTurn,
  isTarget,
  onClick,
}) => {
  const pos = seatPositionClass(index, total);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute ${pos} w-36 max-w-[9rem] px-3 py-2 rounded-2xl border text-xs transition ${
        isTarget
          ? "border-table-accent bg-slate-900/90"
          : "border-slate-800 bg-slate-950/80 hover:border-slate-700"
      } ${!player.alive ? "opacity-40 cursor-default" : ""}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              player.team === "A" ? "bg-sky-400" : "bg-rose-400"
            }`}
          />
          <span
            className={`font-medium truncate ${
              isYou ? "text-table-accent" : "text-slate-200"
            }`}
          >
            {player.name}
          </span>
          {isYou && (
            <span className="text-[10px] uppercase text-slate-500">
              (you)
            </span>
          )}
        </div>
        {isTurn && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-table-accent text-slate-900 font-semibold">
            Acting
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
        <span>
          Coins:{" "}
          <span className="font-semibold text-slate-200">
            {player.coins}
          </span>
        </span>
      </div>
      <div className="flex -space-x-2 mt-1">
        {Array.from({ length: player.num_cards }).map((_, i) => (
          <div
            key={i}
            className="w-6 h-9 rounded-md overflow-hidden border border-slate-700 bg-slate-900"
          >
            <img
              src={cardBackImage}
              alt="Card back"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </button>
  );
};

interface ActionPanelProps {
  view: GameView;
  you: PublicPlayer;
  canAct: boolean;
  selectedTarget: string | null;
  targetHasCoins: boolean;
  selectOrUseTarget: (action: string) => void;
  onStartGame: () => void;
  onBlock: (block_type: string) => void;
  onChallenge: () => void;
  onNoChallenge: () => void;
  onNoBlock: () => void;
  onFinishExchange: (keepIndices: number[]) => void;
  onChooseLoss: (cardIndex: number) => void;
  currentActionSummary: string | null;
}

const ActionPanel: React.FC<ActionPanelProps> = ({
  view,
  you,
  canAct,
  selectedTarget,
  targetHasCoins,
  selectOrUseTarget,
  onStartGame,
  onBlock,
  onChallenge,
  onNoChallenge,
  onNoBlock,
  onFinishExchange,
  onChooseLoss,
}) => {
  const phase = view.phase;
  const superMode = view.mode === "super_team";

  // Lobby
  if (phase === "lobby") {
    return (
      <div className="mt-3 rounded-2xl bg-slate-950/90 border border-slate-800 px-3 py-3 text-sm flex items-center justify-between">
        <div className="text-slate-300">
          Waiting in lobby. Players:{" "}
          <span className="font-mono">
            {Object.keys(view.players).length}
          </span>
          . Need 4 or 6.
        </div>
        <button
          type="button"
          onClick={onStartGame}
          className="px-3 py-1.5 rounded-xl bg-table-accent text-slate-900 text-xs font-semibold hover:bg-table-accentSoft transition"
        >
          Start game
        </button>
      </div>
    );
  }

  // Game over
  if (phase === "game_over") {
    return (
      <div className="mt-3 rounded-2xl bg-slate-950/90 border border-slate-800 px-3 py-3 text-sm text-table-accentSoft">
        Game over. Team {view.winner_team} wins. You can create a new table from
        the lobby.
      </div>
    );
  }

  // Ambassador exchange
  if (phase === "swap_choice") {
    return (
      <SwapChoicePanel
        view={view}
        you={you}
        onFinishExchange={onFinishExchange}
      />
    );
  }

  // Loss-choice
  if (phase === "loss_choice") {
    return (
      <LossChoicePanel
        view={view}
        you={you}
        onChooseLoss={onChooseLoss}
      />
    );
  }

  // Challenge window (actions or blocks)
  if (phase === "challenge_window") {
    const pa = view.pending_action;
    const pb = view.pending_block;

    if (!pa && !pb) return null;

    let text = "";
    let canChallenge = false;

    if (pb && pa) {
      // Challenging a block
      const blocker = view.players[pb.blocker_id];
      const actor = view.players[pa.actor_id];
      if (!blocker || !actor) return null;

      const targetPlayer =
        pa.target_id && view.players[pa.target_id]
          ? view.players[pa.target_id]
          : null;
      const targetNameForViewer =
        targetPlayer && targetPlayer.player_id === you.player_id
          ? "you"
          : targetPlayer
          ? targetPlayer.name
          : null;

      const base = humanAction(pa.action);
      const actionPhrase = formatActionPhrase(
        base,
        pa.action,
        targetNameForViewer
      );

      const isYouBlocker = blocker.player_id === you.player_id;
      const isYouActor = actor.player_id === you.player_id;
      const blockerSameTeam = blocker.team === you.team;

      const actorLabel = isYouActor ? "your" : `${actor.name}'s`;

      if (isYouBlocker) {
        text = `You are attempting to block ${actorLabel} ${actionPhrase}.`;
        canChallenge = false;
      } else if (blockerSameTeam) {
        const whose = isYouActor ? "your" : `${actor.name}'s`;
        text = `Your teammate ${blocker.name} is attempting to block ${whose} ${actionPhrase}.`;
        canChallenge = false;
      } else {
        const whose = isYouActor ? "your" : `${actor.name}'s`;
        text = `Opponent ${blocker.name} is attempting to block ${whose} ${actionPhrase}.`;
        canChallenge = you.alive;
      }
    } else if (pa) {
      // Challenging an action
      const actor = view.players[pa.actor_id];
      if (!actor) return null;

      const targetPlayer =
        pa.target_id && view.players[pa.target_id]
          ? view.players[pa.target_id]
          : null;
      const targetNameForViewer =
        targetPlayer && targetPlayer.player_id === you.player_id
          ? "you"
          : targetPlayer
          ? targetPlayer.name
          : null;

      const base = humanAction(pa.action);
      const phrase = formatActionPhrase(
        base,
        pa.action,
        targetNameForViewer
      );

      const isYouActor = actor.player_id === you.player_id;
      const actorSameTeam = actor.team === you.team;

      if (isYouActor) {
        text = `You are attempting ${phrase}.`;
        canChallenge = false;
      } else if (actorSameTeam) {
        text = `Your teammate ${actor.name} is attempting ${phrase}.`;
        canChallenge = false;
      } else {
        text = `Opponent ${actor.name} is attempting ${phrase}.`;
        canChallenge = you.alive;
      }
    } else {
      return null;
    }

    if (!canChallenge) {
      return (
        <div className="mt-3 rounded-2xl bg-slate-950/90 border border-amber-600/60 px-3 py-3 text-xs">
          <div className="text-amber-100 mb-1">{text}</div>
        </div>
      );
    }

    return (
      <div className="mt-3 rounded-2xl bg-slate-950/90 border border-amber-600/60 px-3 py-3 text-xs flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="text-amber-100">
          {text} Do you want to{" "}
          <span className="font-semibold">challenge</span>?
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onChallenge}
            className="px-3 py-1.5 rounded-xl bg-red-600 text-xs font-semibold hover:bg-red-500 transition"
          >
            Challenge
          </button>
          <button
            type="button"
            onClick={onNoChallenge}
            className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-semibold hover:bg-slate-700 transition"
          >
            Pass (no challenge)
          </button>
        </div>
      </div>
    );
  }

  // Block window
  if (phase === "block_window") {
    const act = view.pending_action;
    if (!act) return null;
    const actor = view.players[act.actor_id];
    const actorName = actor?.name ?? "Someone";

    const isTarget = act.target_id === you.player_id;
    const isSameTeam = actor && actor.team === you.team;

    const isTargetedAction = [
      "steal",
      "super_steal",
      "assassinate",
      "super_assassinate",
      "coup",
    ].includes(act.action);

    const canBlockForeignAid =
      act.action === "foreign_aid" && !isSameTeam && actor;

    const canBlockSteal =
      (act.action === "steal" || act.action === "super_steal") && isTarget;

    const canBlockAssassinate =
      (act.action === "assassinate" || act.action === "super_assassinate") &&
      isTarget;

    const canBlockCoup =
      view.mode === "super_team" &&
      act.action === "coup" &&
      isTarget &&
      you.num_cards >= 2; // need 2 cards for Super Contessa

    const targetPlayer =
      act.target_id && view.players[act.target_id]
        ? view.players[act.target_id]
        : null;
    const targetNameForViewer =
      targetPlayer && targetPlayer.player_id === you.player_id
        ? "you"
        : targetPlayer
        ? targetPlayer.name
        : null;

    const base = humanAction(act.action);
    const human = formatActionPhrase(
      base,
      act.action,
      targetNameForViewer
    );

    // Same team as actor: info only
    if (isSameTeam && actor) {
      const youAreActor = actor.player_id === you.player_id;
      const sentence = youAreActor
        ? `You are performing ${human}. Opponents may choose to block.`
        : `Your teammate ${actorName} is performing ${human}. Opponents may choose to block.`;
      return (
        <div className="mt-3 rounded-2xl bg-slate-950/90 border border-sky-600/60 px-3 py-3 text-xs">
          <div className="text-sky-100">{sentence}</div>
        </div>
      );
    }

    // For targeted actions, non-target opponents can't block / let through
    if (isTargetedAction && !isTarget) {
      return (
        <div className="mt-3 rounded-2xl bg-slate-950/90 border border-sky-600/60 px-3 py-3 text-xs">
          <div className="text-sky-100">
            Opponent {actorName} is performing {human}. Only the targeted
            player can decide to block or let it through.
          </div>
        </div>
      );
    }

    // Full block controls (you are eligible)
    return (
      <div className="mt-3 rounded-2xl bg-slate-950/90 border border-sky-600/60 px-3 py-3 text-xs flex flex-col gap-2">
        <div className="text-sky-100">
          Opponent {actorName} is performing {human}.
        </div>
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <div className="flex flex-wrap gap-2">
            {canBlockForeignAid && (
              <button
                type="button"
                onClick={() => onBlock("block_foreign_aid")}
                className="px-3 py-1.5 rounded-xl bg-red-900 text-xs font-semibold hover:bg-red-800 border border-red-600 transition"
              >
                Block Foreign Aid (Duke)
              </button>
            )}
            {canBlockSteal && (
              <>
                <button
                  type="button"
                  onClick={() => onBlock("block_steal_captain")}
                  className="px-3 py-1.5 rounded-xl bg-sky-900 text-xs font-semibold hover:bg-sky-800 border border-sky-600 transition"
                >
                  Block steal (Captain)
                </button>
                <button
                  type="button"
                  onClick={() => onBlock("block_steal_ambassador")}
                  className="px-3 py-1.5 rounded-xl bg-yellow-900 text-xs font-semibold hover:bg-yellow-800 border border-yellow-600 transition"
                >
                  Block steal (Ambassador)
                </button>
              </>
            )}
            {canBlockAssassinate && (
              <button
                type="button"
                onClick={() => onBlock("block_assassinate")}
                className="px-3 py-1.5 rounded-xl bg-amber-900 text-xs font-semibold hover:bg-amber-800 border border-amber-600 transition"
              >
                Block Assassin (Contessa)
              </button>
            )}
            {canBlockCoup && (
              <button
                type="button"
                onClick={() => onBlock("block_coup")}
                className="px-3 py-1.5 rounded-xl bg-amber-900 text-xs font-semibold hover:bg-amber-800 border border-amber-600 transition"
              >
                Block Coup (Super Contessa)
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onNoBlock}
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-xs font-semibold hover:bg-slate-800 transition"
          >
            Let it through
          </button>
        </div>
      </div>
    );
  }

  // Action selection
  if (phase === "action_selection") {
    const canUseSupers = you.num_cards >= 2 && superMode;

    return (
      <div className="mt-3 rounded-2xl bg-slate-950/90 border border-slate-800 px-3 py-3 text-xs flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-slate-300">
            {view.current_player === you.player_id ? (
              <span className="font-semibold text-table-accent">
                Your turn.
              </span>
            ) : (
              <>
                Waiting for{" "}
                <span className="font-semibold">
                  {view.players[view.current_player ?? ""]?.name ??
                    "someone"}
                </span>{" "}
                to act.
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            Target:{" "}
            {selectedTarget
              ? view.players[selectedTarget].name
              : "click an enemy seat for Coup/Assassin/Captain"}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* Row 1: Income / Foreign Aid / Coup / Super Coup */}
          <button
            disabled={!canAct}
            onClick={() => selectOrUseTarget("income")}
            className={actionBtnClass(canAct, "neutral")}
          >
            Income
            <span className="block text-[10px] text-slate-400">
              +1 coin
            </span>
          </button>

          <button
            disabled={!canAct}
            onClick={() => selectOrUseTarget("foreign_aid")}
            className={actionBtnClass(canAct, "foreign")}
          >
            Foreign Aid
            <span className="block text-[10px] text-slate-400">
              +2 coins
            </span>
          </button>

          <button
            disabled={!canAct || you.coins < 7 || !selectedTarget}
            onClick={() => selectOrUseTarget("coup")}
            className={actionBtnClass(
              canAct && you.coins >= 7 && !!selectedTarget,
              "coup"
            )}
          >
            Coup
            <span className="block text-[10px] text-slate-400">
              Pay 7, force influence loss
            </span>
          </button>

          {superMode && (
            <button
              disabled={!canAct || you.coins < 12 || !selectedTarget}
              onClick={() => selectOrUseTarget("super_coup")}
              className={actionBtnClass(
                canAct && you.coins >= 12 && !!selectedTarget,
                "coupSuper"
              )}
            >
              Super Coup
              <span className="block text-[10px] text-slate-400">
                Pay 12, kills Super Contessa
              </span>
            </button>
          )}

          {/* Row 2: Assassin / Super Assassin / Captain / Super Captain */}
          <button
            disabled={!canAct || you.coins < 3 || !selectedTarget}
            onClick={() => selectOrUseTarget("assassinate")}
            className={actionBtnClass(
              canAct && you.coins >= 3 && !!selectedTarget,
              "assassin"
            )}
          >
            Assassin
            <span className="block text-[10px] text-slate-400">
              Pay 3 to assassinate
            </span>
          </button>

          {superMode && (
            <button
              disabled={
                !canAct ||
                you.coins < 3 ||
                !selectedTarget ||
                !canUseSupers
              }
              onClick={() => selectOrUseTarget("super_assassinate")}
              className={actionBtnClass(
                canAct &&
                  you.coins >= 3 &&
                  !!selectedTarget &&
                  canUseSupers,
                "assassinSuper"
              )}
            >
              Super Assassin
              <span className="block text-[10px] text-slate-400">
                Pay 3 to assassinate, coins refunded if unblocked
              </span>
            </button>
          )}

          <button
            disabled={!canAct || !selectedTarget || !targetHasCoins}
            onClick={() => selectOrUseTarget("steal")}
            className={actionBtnClass(
              canAct && !!selectedTarget && targetHasCoins,
              "captain"
            )}
          >
            Captain
            <span className="block text-[10px] text-slate-400">
              Steal 2 coins
            </span>
          </button>

          {superMode && (
            <button
              disabled={
                !canAct || !selectedTarget || !targetHasCoins || !canUseSupers
              }
              onClick={() => selectOrUseTarget("super_steal")}
              className={actionBtnClass(
                canAct && !!selectedTarget && targetHasCoins && canUseSupers,
                "captainSuper"
              )}
            >
              Super Captain
              <span className="block text-[10px] text-slate-400">
                Steal 3 coins
              </span>
            </button>
          )}

          {/* Row 3: Duke / Super Duke / Ambassador / Super Ambassador */}
          <button
            disabled={!canAct}
            onClick={() => selectOrUseTarget("tax")}
            className={actionBtnClass(canAct, "duke")}
          >
            Duke
            <span className="block text-[10px] text-slate-400">
              +3 coins
            </span>
          </button>

          {superMode && (
            <button
              disabled={!canAct || !canUseSupers}
              onClick={() => selectOrUseTarget("super_tax")}
              className={actionBtnClass(
                canAct && canUseSupers,
                "dukeSuper"
              )}
            >
              Super Duke
              <span className="block text-[10px] text-slate-400">
                +5 coins
              </span>
            </button>
          )}

          <button
            disabled={!canAct}
            onClick={() => selectOrUseTarget("exchange")}
            className={actionBtnClass(canAct, "ambassador")}
          >
            Ambassador
            <span className="block text-[10px] text-slate-400">
              Look at 2 cards & swap
            </span>
          </button>

          {superMode && (
            <button
              disabled={!canAct || !canUseSupers}
              onClick={() => selectOrUseTarget("super_exchange")}
              className={actionBtnClass(
                canAct && canUseSupers,
                "ambassadorSuper"
              )}
            >
              Super Ambassador
              <span className="block text-[10px] text-slate-400">
                Look at 3 cards & swap
              </span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

const actionBtnClass = (
  enabled: boolean,
  variant:
    | "neutral"
    | "foreign"
    | "coup"
    | "coupSuper"
    | "duke"
    | "dukeSuper"
    | "captain"
    | "captainSuper"
    | "ambassador"
    | "ambassadorSuper"
    | "assassin"
    | "assassinSuper"
) => {
  const base =
    "text-left px-3 py-2 rounded-2xl border text-xs transition focus:outline-none focus:ring-1 focus:ring-table-accent";
  const disabled =
    "border-slate-800 bg-slate-950/60 text-slate-500 cursor-not-allowed";

  if (!enabled) return `${base} ${disabled}`;

  const map: Record<string, string> = {
    neutral:
      "border-slate-700 bg-slate-900/80 hover:border-slate-500 hover:bg-slate-900",
    foreign:
      "border-teal-600 bg-teal-950/60 hover:bg-teal-900/80 hover:border-teal-400",
    coup:
      "border-violet-500 bg-violet-950/80 hover:bg-violet-900 hover:border-violet-300",
    coupSuper:
      "border-fuchsia-500 bg-fuchsia-900/90 hover:bg-fuchsia-800 hover:border-fuchsia-300",
    duke:
      "border-red-700 bg-red-950/70 hover:bg-red-900/80 hover:border-red-500",
    dukeSuper:
      "border-red-500 bg-red-900/80 hover:bg-red-800 hover:border-red-300",
    captain:
      "border-sky-700 bg-sky-950/70 hover:bg-sky-900/80 hover:border-sky-500",
    captainSuper:
      "border-sky-500 bg-sky-900/80 hover:bg-sky-800 hover:border-sky-300",
    ambassador:
      "border-yellow-600 bg-yellow-950/70 hover:bg-yellow-900/80 hover:border-yellow-400",
    ambassadorSuper:
      "border-yellow-500 bg-yellow-900/80 hover:bg-yellow-800 hover:border-yellow-300",
    assassin:
      "border-slate-600 bg-slate-900/90 hover:bg-slate-800 hover:border-slate-400",
    assassinSuper:
      "border-black bg-black hover:bg-zinc-900 text-slate-50",
  };

  return `${base} ${map[variant] ?? map.neutral}`;
};

function humanAction(action: string): string {
  switch (action) {
    case "income":
      return "income";
    case "foreign_aid":
      return "Foreign Aid";
    case "tax":
      return "Duke";
    case "super_tax":
      return "Super Duke";
    case "steal":
      return "Captain";
    case "super_steal":
      return "Super Captain";
    case "exchange":
      return "Ambassador";
    case "super_exchange":
      return "Super Ambassador";
    case "assassinate":
      return "Assassin";
    case "super_assassinate":
      return "Super Assassin";
    case "coup":
      return "Coup";
    case "super_coup":
      return "Super Coup";
    default:
      return action;
  }
}

// Ambassador swap panel
const SwapChoicePanel: React.FC<{
  view: GameView;
  you: PublicPlayer;
  onFinishExchange: (keep: number[]) => void;
}> = ({ view, you, onFinishExchange }) => {
  const isYouChoosing = view.current_player === you.player_id;
  const cards = view.exchange_cards ?? [];
  const [selected, setSelected] = useState<number[]>([]);

  const mustKeep = you.num_cards;

  const toggleIndex = (idx: number) => {
    setSelected((prev) => {
      if (prev.includes(idx)) return prev.filter((x) => x !== idx);
      if (prev.length >= mustKeep) return prev;
      return [...prev, idx];
    });
  };

  if (!isYouChoosing) {
    const chooserName =
      view.players[view.current_player ?? ""]?.name ?? "Someone";
    return (
      <div className="mt-3 rounded-2xl bg-slate-950/90 border border-yellow-700/70 px-3 py-3 text-xs text-slate-200">
        <span className="font-semibold">{chooserName}</span> is choosing which
        cards to keep (Ambassador). Please wait.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl bg-slate-950/90 border border-yellow-700/70 px-3 py-3 text-xs">
      <div className="mb-2 text-slate-200">
        Ambassador exchange: choose{" "}
        <span className="font-semibold text-table-accent">{mustKeep}</span>{" "}
        cards to keep.
      </div>
      <div className="flex flex-wrap gap-2">
        {cards.map((role, idx) => {
          const img = ROLE_IMAGES[role] ?? cardBackImage;
          const isSel = selected.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggleIndex(idx)}
              className={`relative w-24 h-32 rounded-2xl overflow-hidden border text-[10px] ${
                isSel
                  ? "border-table-accent shadow-card"
                  : "border-slate-700 bg-slate-900/80 hover:border-slate-500"
              }`}
            >
              <img
                src={img}
                alt={role}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 text-[10px] bg-slate-950/85 border-t border-slate-700/80 px-1.5 py-1 text-center">
                {role}
              </div>
            </button>
          );
        })}
        {cards.length === 0 && (
          <div className="text-slate-500 text-xs italic">
            Waiting for Ambassador cards…
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-[11px] text-slate-400">
          Selected:{" "}
          <span className="font-mono">
            {selected.length}/{mustKeep}
          </span>
        </div>
        <button
          type="button"
          disabled={selected.length !== mustKeep}
          onClick={() => onFinishExchange(selected)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
            selected.length === mustKeep
              ? "bg-table-accent text-slate-900 hover:bg-table-accentSoft"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }`}
        >
          Confirm exchange
        </button>
      </div>
    </div>
  );
};

// Loss-choice panel
const LossChoicePanel: React.FC<{
  view: GameView;
  you: PublicPlayer;
  onChooseLoss: (idx: number) => void;
}> = ({ view, you, onChooseLoss }) => {
  const lossPlayerId = view.loss_choice_player_id ?? null;
  const lossPlayer = lossPlayerId ? view.players[lossPlayerId] : null;
  const isYouChoosing = lossPlayerId === you.player_id;
  const cards = (view.loss_choice_cards ?? you.cards) ?? [];

  if (!lossPlayer) return null;

  const [selected, setSelected] = useState<number | null>(null);

  if (!isYouChoosing) {
    return (
      <div className="mt-3 rounded-2xl bg-slate-950/90 border border-red-700/70 px-3 py-3 text-xs text-slate-200">
        <span className="font-semibold">{lossPlayer.name}</span> is choosing
        which influence to lose.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl bg-slate-950/90 border border-red-700/70 px-3 py-3 text-xs">
      <div className="mb-2 text-slate-200">
        You must choose which card to lose.
      </div>
      <div className="flex gap-2">
        {cards.map((role, idx) => {
          const img = ROLE_IMAGES[role] ?? cardBackImage;
          const isSel = selected === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelected(idx)}
              className={`relative w-24 h-32 rounded-2xl overflow-hidden border text-[10px] ${
                isSel
                  ? "border-red-500 shadow-card"
                  : "border-slate-700 bg-slate-900/80 hover:border-slate-500"
              }`}
            >
              <img
                src={img}
                alt={role}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 text-[10px] bg-slate-950/85 border-t border-slate-700/80 px-1.5 py-1 text-center">
                {role}
              </div>
            </button>
          );
        })}
        {cards.length === 0 && (
          <div className="text-slate-500 text-xs italic">
            Waiting for loss-choice cards…
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-[11px] text-slate-400">
          Click a card to choose which to discard.
        </div>
        <button
          type="button"
          disabled={selected === null}
          onClick={() => selected !== null && onChooseLoss(selected)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
            selected !== null
              ? "bg-red-600 text-slate-50 hover:bg-red-500"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }`}
        >
          Confirm discard
        </button>
      </div>
    </div>
  );
};

export default GameLayout;
