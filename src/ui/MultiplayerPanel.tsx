import { useState } from "react";
import type { RoomState } from "../network/protocol";
import type { ConnectionStatus } from "../network/client";
import { MISSIONS, DIFFICULTIES } from "../game/heist";
import type { Contract, Profile } from "../game/heist";
export interface MultiplayerActions {
  create: (name: string, solo?: boolean) => Promise<void>;
  configure: (
    mission: Contract["mission"],
    difficulty: Contract["difficulty"],
  ) => Promise<void>;
  mask: (mask: Profile["mask"]) => Promise<void>;
  join: (name: string, code: string) => Promise<void>;
  ready: (ready: boolean) => Promise<void>;
  start: () => Promise<void>;
  leave: () => Promise<void>;
}
export function MultiplayerPanel({
  room,
  playerId,
  status,
  error,
  actions,
  onClose,
}: {
  room: RoomState | null;
  playerId: string;
  status: ConnectionStatus;
  error: string;
  actions: MultiplayerActions;
  onClose: () => void;
}) {
  const [name, setName] = useState("Nightjar"),
    [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    [copied, setCopied] = useState(false);
  const me = room?.players.find((p) => p.id === playerId);
  const canStart =
    !!room &&
    room.players.filter((p) => p.connected).length >=
      (room.contract.solo ? 1 : 2) &&
    room.players.filter((p) => p.connected).every((p) => p.ready);
  async function run(fn: () => Promise<void>) {
    setPending(true);
    try {
      await fn();
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="overlay">
      <section
        className="dialog multiplayer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crew-title"
      >
        <div className="eyebrow">
          MUSEUM EDITION / CREW BRIEFING{" "}
          <span className="connection-status">{status}</span>
        </div>
        <h2 id="crew-title">
          {room ? "Assemble the crew." : "A heist is better together."}
        </h2>
        {room ? (
          <>
            <p>
              {room.contract.solo
                ? "A solo operation. Choose your contract and ready up."
                : "Share this code with your crew. Everyone connects to the same game address."}
            </p>
            <div className="room-code">
              <div>
                <small>PRIVATE ROOM CODE</small>
                <strong data-testid="room-code">{room.code}</strong>
              </div>
              <button
                className="copy-code"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(room.code)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>
            <div className="crew-label">
              <span>CREW MANIFEST</span>
              <span>{room.players.length} / 4</span>
            </div>
            <div className="contract-fields">
              <label>
                Mission
                <select
                  aria-label="Mission"
                  disabled={room.hostId !== playerId || pending}
                  value={room.contract.mission}
                  onChange={(e) =>
                    void run(() =>
                      actions.configure(
                        e.target.value as Contract["mission"],
                        room.contract.difficulty,
                      ),
                    )
                  }
                >
                  {Object.entries(MISSIONS).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Difficulty
                <select
                  aria-label="Difficulty"
                  disabled={room.hostId !== playerId || pending}
                  value={room.contract.difficulty}
                  onChange={(e) =>
                    void run(() =>
                      actions.configure(
                        room.contract.mission,
                        e.target.value as Contract["difficulty"],
                      ),
                    )
                  }
                >
                  {Object.entries(DIFFICULTIES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="contract-description">
              {MISSIONS[room.contract.mission].description}
            </p>
            <ul className="crew-list">
              {room.players.map((p) => (
                <li key={p.id}>
                  <span
                    className="crew-swatch"
                    style={{ background: p.color }}
                  />
                  <div>
                    <strong>
                      {p.name} <small>LV {p.profile.level}</small>{" "}
                      {p.id === playerId ? <small>YOU</small> : null}
                    </strong>
                    <small>
                      {p.id === room.hostId ? "HOST" : "CREW MEMBER"}
                    </small>
                  </div>
                  <span className={p.ready ? "ready-state" : "waiting-state"}>
                    {!p.connected
                      ? "Reconnecting…"
                      : p.ready
                        ? "Ready"
                        : "Not ready"}
                  </span>
                </li>
              ))}
              {Array.from({ length: 4 - room.players.length }, (_, i) => (
                <li className="empty-slot" key={i}>
                  <span>＋</span> Waiting for a crewmate
                </li>
              ))}
            </ul>
            <label className="mask-select">
              Your mask
              <select
                aria-label="Your mask"
                value={me?.profile.mask ?? "ivory"}
                onChange={(e) =>
                  void run(() =>
                    actions.mask(e.target.value as Profile["mask"]),
                  )
                }
              >
                <option value="ivory">Ivory · unlocked</option>
                <option value="gold" disabled={(me?.profile.level ?? 1) < 3}>
                  Gold · level 3
                </option>
                <option value="onyx" disabled={(me?.profile.level ?? 1) < 5}>
                  Onyx · level 5
                </option>
              </select>
            </label>
            <button
              className="primary"
              disabled={pending || status !== "connected"}
              onClick={() => void run(() => actions.ready(!me?.ready))}
            >
              {me?.ready ? "Not ready" : "Ready up"}
              <span>{me?.ready ? "−" : "✓"}</span>
            </button>
            {room.hostId === playerId ? (
              <button
                className="primary launch-button"
                disabled={pending || !canStart || status !== "connected"}
                onClick={() => void run(actions.start)}
              >
                {room.contract.mission === "training"
                  ? "Start exploration"
                  : "Start heist"}{" "}
                <span>↗</span>
              </button>
            ) : (
              <p className="lobby-hint">
                The host starts when the crew is ready.
              </p>
            )}
            <p className="lobby-hint">
              {room.contract.solo ? "Solo operation" : "2–4 players"} · smoke LV
              2 · jammer LV 3
            </p>
            <button
              className="secondary"
              disabled={pending}
              onClick={() => void run(actions.leave)}
            >
              Leave room <span>←</span>
            </button>
          </>
        ) : (
          <>
            <p>
              Create a private room or join a friend. You can explore both
              floors together.
            </p>
            <label className="field-label">
              Your name
              <input
                autoFocus
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
              />
            </label>
            <button
              className="primary"
              disabled={pending || !name.trim()}
              onClick={() => void run(() => actions.create(name))}
            >
              {pending ? "Connecting…" : "Create private room"}
              <span>＋</span>
            </button>
            <div className="join-divider">OR JOIN YOUR CREW</div>
            <label className="field-label">
              Room code
              <input
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              className="secondary"
              disabled={pending || code.trim().length !== 6 || !name.trim()}
              onClick={() => void run(() => actions.join(name, code))}
            >
              Join room <span>↗</span>
            </button>
            <button className="secondary" disabled={pending} onClick={onClose}>
              Back <span>←</span>
            </button>
          </>
        )}
        {error ? (
          <p className="network-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
