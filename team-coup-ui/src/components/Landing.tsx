import React, { useState } from "react";
import type { Team } from "../types";

interface Props {
  onCreate: (args: { mode: "normal" | "super"; name: string; team: Team }) => void;
  onJoin: (args: { game_id: string; name: string; team: Team }) => void;
  loading: boolean;
}

const Landing: React.FC<Props> = ({ onCreate, onJoin, loading }) => {
  const [name, setName] = useState("");
  const [team, setTeam] = useState<Team>("A");
  const [mode, setMode] = useState<"normal" | "super">("super");
  const [joinGameId, setJoinGameId] = useState("");

  const disabled = loading || !name.trim();

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2">Host a new table</h2>
          <p className="text-sm text-slate-400 mb-4">
            Choose your name, team, and mode. Share the Game ID with your friends to start.
          </p>

          <label className="block mb-3 text-sm">
            <span className="block mb-1 text-slate-300">Display name</span>
            <input
              className="w-full rounded-xl bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-table-accent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Duke of Lies"
            />
          </label>

          <div className="flex gap-4 mb-3 text-sm">
            <div>
              <div className="mb-1 text-slate-300">Team</div>
              <div className="inline-flex rounded-full bg-slate-950/60 border border-slate-700 p-1">
                {(["A", "B"] as Team[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTeam(t)}
                    className={`px-3 py-1 rounded-full text-xs ${
                      team === t
                        ? "bg-table-accent text-slate-900"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Team {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-slate-300">Mode</div>
              <div className="inline-flex rounded-full bg-slate-950/60 border border-slate-700 p-1">
                {(["normal", "super"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-3 py-1 rounded-full text-xs capitalize ${
                      mode === m
                        ? "bg-table-accent text-slate-900"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Super mode adds double-card powers like Super Duke (+5) and Super Coup (12).
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onCreate({ mode, name: name.trim(), team })}
          className={`mt-4 inline-flex items-center justify-center px-4 py-2 rounded-2xl text-sm font-medium shadow-card transition ${
            disabled
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-table-accent text-slate-900 hover:bg-table-accentSoft"
          }`}
        >
          {loading ? "Creating..." : "Create table"}
        </button>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2">Join an existing table</h2>
          <p className="text-sm text-slate-400 mb-4">
            Ask the host for the Game ID and choose your team. Voice chat happens elsewhere.
          </p>

          <label className="block mb-3 text-sm">
            <span className="block mb-1 text-slate-300">Display name</span>
            <input
              className="w-full rounded-xl bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-table-accent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contessa of Chaos"
            />
          </label>

          <label className="block mb-3 text-sm">
            <span className="block mb-1 text-slate-300">Game ID</span>
            <input
              className="w-full rounded-xl bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-table-accent"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value.trim())}
              placeholder="e.g. 3f9a2c1b"
            />
          </label>

          <div className="mb-3 text-sm">
            <div className="mb-1 text-slate-300">Team</div>
            <div className="inline-flex rounded-full bg-slate-950/60 border border-slate-700 p-1">
              {(["A", "B"] as Team[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTeam(t)}
                  className={`px-3 py-1 rounded-full text-xs ${
                    team === t
                      ? "bg-table-accent text-slate-900"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Team {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={loading || !name.trim() || !joinGameId.trim()}
          onClick={() =>
            onJoin({ game_id: joinGameId.trim(), name: name.trim(), team })
          }
          className={`mt-4 inline-flex items-center justify-center px-4 py-2 rounded-2xl text-sm font-medium shadow-card transition ${
            loading || !name.trim() || !joinGameId.trim()
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-slate-900 text-slate-100 border border-table-accent hover:bg-slate-800"
          }`}
        >
          {loading ? "Joining..." : "Join table"}
        </button>
      </div>
    </div>
  );
};

export default Landing;
