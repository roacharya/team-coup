// src/App.tsx
import React, { useEffect, useState } from "react";
import {
  createGame,
  joinGame,
  startGame,
  fetchState,
  sendAction,
  sendBlock,
  sendChallenge,
  sendNoChallenge,
  sendNoBlock,
  finishExchange,
  chooseLoss,
} from "./api";
import type { GameView } from "./types";
import GameLayout from "./components/GameLayout";

const POLL_MS = 1200;

const App: React.FC = () => {
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [view, setView] = useState<GameView | null>(null);

  const [name, setName] = useState("");
  const [team, setTeam] = useState<"A" | "B">("A");
  const [mode, setMode] = useState<"normal" | "super">("normal");
  const [joinGameId, setJoinGameId] = useState("");

  const [error, setError] = useState<string | null>(null);

  // Polling
  useEffect(() => {
    if (!playerToken) return;
    let cancel = false;

    const loop = async () => {
      try {
        const v = await fetchState(playerToken);
        if (!cancel) setView(v);
      } catch {
        // ignore polling errors
      }
      if (!cancel) {
        setTimeout(loop, POLL_MS);
      }
    };

    loop();
    return () => {
      cancel = true;
    };
  }, [playerToken]);

  const handleCreateGame = async () => {
    setError(null);
    try {
      const { game_id, player_token } = await createGame(
        mode,
        name || "Player",
        team
      );
      setGameId(game_id);
      setPlayerToken(player_token);
      const v = await fetchState(player_token);
      setView(v);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const handleJoinGame = async () => {
    if (!joinGameId) return;
    setError(null);
    try {
      const { player_token } = await joinGame(
        joinGameId,
        name || "Player",
        team
      );
      setGameId(joinGameId);
      setPlayerToken(player_token);
      const v = await fetchState(player_token);
      setView(v);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const handleStartGame = async () => {
    if (!playerToken) return;
    try {
      await startGame(playerToken);
      const v = await fetchState(playerToken);
      setView(v);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const handleAction = async (action: string, target_id?: string | null) => {
    if (!playerToken) return;
    setError(null);
    try {
      const v = await sendAction(playerToken, action, target_id ?? null);
      setView(v);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const handleBlock = async (block_type: string) => {
    if (!playerToken) return;
    setError(null);
    try {
      const v = await sendBlock(playerToken, block_type);
      setView(v);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const handleChallenge = async () => {
    if (!playerToken) return;
    setError(null);
    try {
      const v = await sendChallenge(playerToken);
      setView(v);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const handleNoChallenge = async () => {
    if (!playerToken) return;
    setError(null);
    try {
      const v = await sendNoChallenge(playerToken);
      setView(v);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const handleNoBlock = async () => {
    if (!playerToken) return;
    setError(null);
    try {
      const v = await sendNoBlock(playerToken);
      setView(v);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const handleFinishExchange = async (keepIndices: number[]) => {
    if (!playerToken) return;
    setError(null);
    try {
      const v = await finishExchange(playerToken, keepIndices);
      setView(v);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const handleChooseLoss = async (cardIndex: number) => {
    if (!playerToken) return;
    setError(null);
    try {
      const v = await chooseLoss(playerToken, cardIndex);
      setView(v);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto flex flex-col gap-4">
        {!playerToken || !view ? (
          <div className="rounded-3xl bg-slate-950/80 border border-slate-800 p-4 md:p-6 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-slate-200">
              Create or join a table
            </h2>
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-3 flex flex-col gap-2">
                <div className="font-semibold text-slate-200 mb-1">
                  Create game
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">Name</span>
                  <input
                    className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Player 1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">Team</span>
                  <select
                    className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                    value={team}
                    onChange={(e) => setTeam(e.target.value as "A" | "B")}
                  >
                    <option value="A">Team A</option>
                    <option value="B">Team B</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">Mode</span>
                  <select
                    className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                    value={mode}
                    onChange={(e) =>
                      setMode(e.target.value === "super" ? "super" : "normal")
                    }
                  >
                    <option value="normal">Team Coup</option>
                    <option value="super">Super Team Coup</option>
                  </select>
                </label>
                <button
                  onClick={handleCreateGame}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-table-accent text-slate-900 font-semibold text-xs hover:bg-table-accentSoft"
                >
                  Create
                </button>
              </div>

              <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-3 flex flex-col gap-2">
                <div className="font-semibold text-slate-200 mb-1">
                  Join existing game
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">Game ID</span>
                  <input
                    className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                    value={joinGameId}
                    onChange={(e) => setJoinGameId(e.target.value)}
                    placeholder="from your friend"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">Name</span>
                  <input
                    className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Player 1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">Team</span>
                  <select
                    className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs"
                    value={team}
                    onChange={(e) => setTeam(e.target.value as "A" | "B")}
                  >
                    <option value="A">Team A</option>
                    <option value="B">Team B</option>
                  </select>
                </label>
                <button
                  onClick={handleJoinGame}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-100 font-semibold text-xs hover:bg-slate-700"
                >
                  Join
                </button>
              </div>
            </div>
            {error && (
              <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-700/70 px-3 py-2 rounded-2xl">
                {error}
              </div>
            )}
          </div>
        ) : (
          <>
            {error && (
              <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-700/70 px-3 py-2 rounded-2xl">
                {error}
              </div>
            )}
            <GameLayout
              view={view}
              gameId={gameId}
              onStartGame={handleStartGame}
              onAction={handleAction}
              onBlock={handleBlock}
              onChallenge={handleChallenge}
              onNoChallenge={handleNoChallenge}
              onNoBlock={handleNoBlock}
              onFinishExchange={handleFinishExchange}
              onChooseLoss={handleChooseLoss}
              youToken={playerToken!}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default App;
