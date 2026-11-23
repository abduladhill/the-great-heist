import { useEffect, useRef, useState } from "react";
import { GameEngine } from "../game/engine";
import type { HudState, Mode } from "../game/types";
import { MultiplayerClient } from "../network/client";
import type { ConnectionStatus } from "../network/client";
import type { RoomState } from "../network/protocol";
import { MultiplayerPanel } from "./MultiplayerPanel";
import { HeistHud, Results } from "./HeistHud";
import { Soundscape } from "../game/sound";
import { EXIT, JAIL } from "../game/heist";
import type { Profile } from "../game/heist";

const controls = [
  ["W A S D", "Move"],
  ["MOUSE", "Look around"],
  ["SHIFT", "Sprint"],
  ["CTRL / C", "Hold to crouch"],
  ["SPACE", "Jump"],
  ["ESC", "Pause"],
  ["E", "Hold to interact / rescue"],
  ["Q / R", "Smoke / jammer"],
];
function Controls() {
  return (
    <div className="controls">
      {controls.map(([key, label]) => (
        <div key={key}>
          <kbd>{key}</kbd>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
function Map({
  hud,
  room,
  playerId,
}: {
  hud: HudState;
  room: RoomState | null;
  playerId: string;
}) {
  return (
    <div className="map">
      <svg
        viewBox="-16 -18 32 36"
        role="img"
        aria-label="Museum map with player position"
      >
        <path
          d="M-14-16H14V16H-14Z"
          fill="#1d3638"
          stroke="#72918b"
          strokeWidth=".35"
        />
        <path
          d="M-7-8H12V10H-7Z"
          fill="#101e22"
          stroke="#54716c"
          strokeWidth=".2"
        />
        <path d="M8 8V-8H11V8Z" fill="#9d8d60" />
        {[-6, -3, 0, 3, 6].map((z) => (
          <path key={z} d={`M8 ${z}h3`} stroke="#d5c294" strokeWidth=".15" />
        ))}
        <circle cx="0" cy="-1" r="1.5" fill="#bfa975" />
        {room?.heist ? (
          <>
            <rect
              x={EXIT.x - 1}
              y={EXIT.z - 1}
              width="2"
              height="2"
              fill={room.heist.objectiveReady ? "#8ef1bc" : "#876c43"}
            />
            <rect
              x={JAIL.x - 0.7}
              y={JAIL.z - 0.7}
              width="1.4"
              height="1.4"
              fill="#ea8875"
            />
            {room.heist.loot
              .filter((l) => !l.taken)
              .map((l) => (
                <rect
                  key={l.id}
                  x={l.x - 0.4}
                  y={l.z - 0.4}
                  width=".8"
                  height=".8"
                  fill={l.y > 3 ? "#bcb0ee" : "#e4ca80"}
                >
                  <title>
                    {l.name} · {l.y > 3 ? "upper" : "ground"}
                  </title>
                </rect>
              ))}
            {room.heist.guards.map((g) => (
              <path
                key={g.id}
                d={`M${g.x} ${g.z - 0.6}l.5 1h-1z`}
                fill={g.mode === "chase" ? "#ff7463" : "#d9a56e"}
              />
            ))}
          </>
        ) : null}
        {room?.players
          .filter((p) => p.id !== playerId)
          .map((p) => (
            <circle
              key={p.id}
              data-player={p.name}
              data-y={p.state.y}
              cx={p.state.x}
              cy={p.state.z}
              r=".7"
              fill={p.color}
              opacity={p.connected ? 1 : 0.4}
            >
              <title>{p.name}</title>
            </circle>
          ))}
        <circle
          cx={hud.x}
          cy={hud.z}
          r=".75"
          fill="#8ee0c1"
          stroke="#e7fff5"
          strokeWidth=".25"
        />
      </svg>
      <span>N</span>
    </div>
  );
}
export function App() {
  const mount = useRef<HTMLDivElement>(null),
    engine = useRef<GameEngine | null>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const modeRef = useRef<Mode>("menu");
  const sound = useRef<Soundscape | null>(null);
  const [muted, setMuted] = useState(false),
    [profile, setProfile] = useState<Profile | null>(null);
  const network = useRef<MultiplayerClient | null>(null),
    roomRef = useRef<RoomState | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null),
    [status, setStatus] = useState<ConnectionStatus>("offline"),
    [networkError, setNetworkError] = useState(""),
    [lobbyOpen, setLobbyOpen] = useState(false);
  const [hud, setHud] = useState<HudState>({
    x: 0,
    z: 12,
    floor: "Ground floor",
    stance: "Standing",
    fps: 60,
  });
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [help, setHelp] = useState(false),
    [locked, setLocked] = useState(false);
  function transition(next: Mode) {
    modeRef.current = next;
    engine.current?.setMode(next);
    setMode(next);
    if (next !== "playing" && document.pointerLockElement)
      document.exitPointerLock();
  }
  useEffect(() => {
    sound.current = new Soundscape();
    try {
      engine.current = new GameEngine(mount.current!, setHud);
      setReady(true);
    } catch (e) {
      setError(
        `The 3D renderer could not start. Enable hardware acceleration and reload. ${e instanceof Error ? e.message : ""}`,
      );
    }
    network.current = new MultiplayerClient(
      (next) => {
        const previous = roomRef.current;
        roomRef.current = next;
        setRoom(next);
        if (next?.heist) {
          if ((next.heist.progress ?? 0) > (previous?.heist?.progress ?? 0))
            sound.current?.play("loot");
          if (next.heist.alarmTriggered && !previous?.heist?.alarmTriggered)
            sound.current?.play("alarm");
          if (next.heist.result && !previous?.heist?.result)
            sound.current?.play(next.heist.result.won ? "win" : "lose");
        }
        if (next) {
          if (!previous) engine.current?.setMultiplayer(network.current);
          if (next.phase !== previous?.phase) {
            if (next.phase === "playing") {
              engine.current?.reset();
              setLobbyOpen(false);
              transition("playing");
            } else if (next.phase === "results") {
              transition("paused");
              setLobbyOpen(false);
            } else {
              transition("menu");
              setLobbyOpen(true);
            }
          }
        } else if (previous) {
          engine.current?.setMultiplayer(null);
          transition("menu");
          setLobbyOpen(false);
        }
      },
      (next) => {
        setStatus(next);
        if (next === "reconnecting" && roomRef.current?.phase === "playing")
          transition("paused");
      },
      (message) => {
        setNetworkError(message);
        if (!roomRef.current) setLobbyOpen(true);
      },
      setProfile,
    );
    void network.current.loadProfile().catch(() => {});
    const key = (e: KeyboardEvent) => {
      if (e.code === "Escape" && modeRef.current === "playing")
        transition("paused");
      if (
        modeRef.current === "playing" &&
        !e.repeat &&
        roomRef.current?.phase === "playing"
      ) {
        if (e.code === "KeyE") {
          e.preventDefault();
          network.current?.interact(true);
        }
        if (e.code === "KeyQ" || e.code === "KeyR")
          void networkAction(() =>
            network.current!.gadget(e.code === "KeyQ" ? "smoke" : "jammer"),
          );
      }
    };
    const keyup = (e: KeyboardEvent) => {
      if (e.code === "KeyE") network.current?.interact(false);
    };
    const blur = () => {
      if (modeRef.current === "playing") transition("paused");
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    const lock = () => {
      setLocked(!!document.pointerLockElement);
      if (!document.pointerLockElement && modeRef.current === "playing")
        transition("paused");
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerlockchange", lock);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", keyup);
      sound.current?.dispose();
      sound.current = null;
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerlockchange", lock);
      engine.current?.dispose();
      engine.current = null;
      network.current?.dispose();
      network.current = null;
    };
  }, []);
  async function capture() {
    try {
      await mount.current?.querySelector("canvas")?.requestPointerLock();
    } catch {
      /* Drag-to-look and arrow keys remain available when pointer lock is denied. */
    }
  }
  function start(reset: boolean) {
    sound.current?.unlock();
    if (reset) engine.current?.reset();
    transition("playing");
    void capture();
  }
  async function networkAction(action: () => Promise<void>) {
    sound.current?.unlock();
    setNetworkError("");
    try {
      await action();
    } catch (e) {
      setNetworkError(e instanceof Error ? e.message : "Connection failed.");
    }
  }
  const playerId = network.current?.playerId ?? "";
  const me = room?.players.find((p) => p.id === playerId);
  return (
    <main>
      <div
        className="scene"
        ref={mount}
        onClick={() => {
          if (mode === "playing") void capture();
        }}
      />
      <div className="vignette" />
      {mode === "menu" ? (
        <div className="menu">
          <header>
            <a className="brand" href="#" aria-label="The Great Heist home">
              <span className="emblem">◇</span> NIGHTJAR{" "}
              <span className="brand-sub">/ ORIGINALS</span>
            </a>
            <span className="version">
              <i /> MUSEUM EDITION · v1.0
            </span>
          </header>
          <section className="hero">
            <div className="eyebrow">
              <span /> THE MUSEUM IS YOURS TONIGHT
            </div>
            <h1>
              THE GREAT
              <br />
              <em>HEIST.</em>
            </h1>
            <div className="edition">M U S E U M &nbsp; E D I T I O N</div>
            <p>
              Every masterpiece has a way in.
              <br />
              Bring your crew. Learn the halls together.
            </p>
            <button
              className="primary"
              disabled={!ready || !!error}
              onClick={() => {
                setNetworkError("");
                setLobbyOpen(true);
              }}
            >
              {ready ? "Play with friends" : "Preparing museum…"}
              <span>↗</span>
            </button>
            <button
              className="secondary"
              disabled={!ready || !!error}
              onClick={() =>
                void networkAction(() =>
                  network.current!.create("Nightjar", true),
                )
              }
            >
              Solo heist <span>↗</span>
            </button>
            <button
              className="secondary"
              disabled={!ready || !!error}
              onClick={() => start(true)}
            >
              Enter the museum <span>SOLO</span>
            </button>
            <button className="secondary" onClick={() => setHelp(true)}>
              Field guide <span>＋</span>
            </button>
            <div className="solo-note">
              2–4 PLAYERS <b>•</b> PRIVATE ROOMS
            </div>
          </section>
          <div className="location-card">
            <div className="tiny">YOUR FIRST LOCATION</div>
            <h2>The Aurelia Museum</h2>
            <p>Two floors. A thousand possibilities.</p>
            <div>
              <span>01 / 01</span>
              <span>28 × 32 m &nbsp; ◇</span>
            </div>
          </div>
          <footer>
            <span>DESKTOP · KEYBOARD & MOUSE</span>
            <span>Your crew. One museum. Explore together.</span>
            <span>v1.0.0</span>
          </footer>
        </div>
      ) : (
        <>
          <div className="hud-top">
            <div className="museum-title">
              <span className="emblem">◇</span>
              <div>
                <small>AURELIA MUSEUM</small>
                <strong>{hud.floor}</strong>
              </div>
            </div>
            <div className="session-pill">
              <i />{" "}
              {room
                ? `ROOM ${room.code} · ${room.players.filter((p) => p.connected).length}/4`
                : "SOLO EXPLORATION"}{" "}
              <span>{room?.heist ? "LIVE HEIST" : "PRACTICE"}</span>
            </div>
            <button
              className="pause-button"
              onClick={() => transition("paused")}
              aria-label="Pause game"
            >
              Ⅱ <kbd>ESC</kbd>
            </button>
          </div>
          {!room?.heist ? (
            <div className="exploration-note">
              <small>GET YOUR BEARINGS</small>
              <p>Explore the museum’s two floors.</p>
              <span>The east staircase leads to the upper gallery.</span>
            </div>
          ) : null}
          <div className="crosshair">·</div>
          <div className="hud-bottom">
            <div className="player-card">
              <div className="avatar-icon">◈</div>
              <div>
                <small>LOCAL PLAYER · 01</small>
                <strong>{me?.name ?? "The Nightjar"}</strong>
                <span>
                  <i />
                  {hud.stance}
                </span>
              </div>
            </div>
            <div className="quick-controls">
              <span>
                <kbd>WASD</kbd> Move
              </span>
              <span>
                <kbd>SHIFT</kbd> Sprint
              </span>
              <span>
                <kbd>C</kbd> Crouch
              </span>
              <span>
                <kbd>SPACE</kbd> Jump
              </span>
            </div>
            <div className="map-card">
              <Map hud={hud} room={room} playerId={playerId} />
              <div>
                <span>{hud.floor}</span>
                <small>{hud.fps} FPS</small>
              </div>
            </div>
          </div>
          {room ? (
            <div className="live-crew" aria-label="Connected crew">
              {room.players.map((p) => (
                <div key={p.id} data-testid="crew-member">
                  <i style={{ background: p.color }} />
                  <strong>
                    {p.name}
                    {p.id === playerId ? " (you)" : ""}
                  </strong>
                  <span>
                    {p.operative.captured
                      ? "Captured"
                      : p.operative.escaped
                        ? "Escaped"
                        : !p.connected
                          ? "Reconnecting"
                          : p.state.y > 3.8
                            ? "Upper gallery"
                            : "Ground floor"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {!locked && mode === "playing" ? (
            <div className="look-hint">
              Click the museum to capture the mouse · or drag to look / use ← →
            </div>
          ) : null}
        </>
      )}
      {room?.heist && room.phase === "playing" ? (
        <HeistHud room={room} me={me} />
      ) : null}
      {room?.phase === "results" ? (
        <Results
          room={room}
          me={me}
          onLobby={() => void networkAction(() => network.current!.lobby())}
          onLeave={() => void networkAction(() => network.current!.leave())}
        />
      ) : null}
      <button
        className="sound-toggle"
        aria-label={muted ? "Enable sound" : "Mute sound"}
        onClick={() => {
          sound.current?.unlock();
          if (sound.current) sound.current.enabled = muted;
          setMuted(!muted);
        }}
      >
        {muted ? "SOUND OFF" : "SOUND ON"}
      </button>
      {mode === "menu" && !lobbyOpen && profile ? (
        <div className="profile-strip">
          LV {profile.level} · {profile.xp} XP · {profile.wins} wins · $
          {profile.cash}
          <span>
            {profile.level < 2
              ? "Smoke unlocks at level 2"
              : profile.level < 3
                ? "Jammer unlocks at level 3"
                : "Smoke & jammer unlocked"}
          </span>
        </div>
      ) : null}
      {networkError && mode === "playing" ? (
        <button className="action-toast" onClick={() => setNetworkError("")}>
          {networkError} ×
        </button>
      ) : null}
      {mode === "paused" && room?.phase !== "results" ? (
        <div className="overlay">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-title"
          >
            <div className="eyebrow">TAKE A BREATHER</div>
            <h2 id="pause-title">Heist on hold.</h2>
            <p>
              {room
                ? "Your controls are paused. Your crew can keep exploring."
                : "Your position is saved while paused."}
            </p>
            {room && status !== "connected" ? (
              <p className="network-error" role="status">
                Connection lost. Reconnecting… Your place is held for 15 seconds
                after the server detects the disconnect.
              </p>
            ) : null}
            <button
              autoFocus
              className="primary"
              disabled={!!room && status !== "connected"}
              onClick={() => start(false)}
            >
              Resume exploration <span>↗</span>
            </button>
            {!room ? (
              <button className="secondary" onClick={() => start(true)}>
                Return to entrance <span>↺</span>
              </button>
            ) : room.hostId === playerId ? (
              <button
                className="secondary"
                disabled={status !== "connected"}
                onClick={() =>
                  void networkAction(() => network.current!.lobby())
                }
              >
                Return crew to lobby <span>↺</span>
              </button>
            ) : null}
            <button
              className="secondary"
              onClick={() =>
                room
                  ? void networkAction(() => network.current!.leave())
                  : transition("menu")
              }
            >
              {room ? "Leave room" : "Main menu"} <span>←</span>
            </button>
            {networkError ? (
              <p className="network-error" role="alert">
                {networkError}
              </p>
            ) : null}
            <Controls />
          </section>
        </div>
      ) : null}
      {help ? (
        <div className="overlay">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
          >
            <div className="eyebrow">FIELD GUIDE / MUSEUM EDITION</div>
            <h2 id="guide-title">Know your moves.</h2>
            <Controls />
            <p>
              Find the staircase on the east side to reach the upper gallery.
              Mouse capture is optional: drag to look or turn with the arrow
              keys.
            </p>
            <p className="muted">
              Create or join a private room, ready up, and let the host start.
              Hold E near marked objects to collect or hack. Crouch to reduce
              visibility, avoid the guards’ gold sight cones and wait for red
              lasers to switch off. Captured teammates can be rescued in the
              southwest corner. Complete the objective, then everyone holds E at
              the entrance to escape. Smoke unlocks at level 2, jammer at level
              3. Progress is saved for this browser.
            </p>
            <button
              autoFocus
              className="primary"
              onClick={() => setHelp(false)}
            >
              Got it <span>↗</span>
            </button>
          </section>
        </div>
      ) : null}
      {lobbyOpen ? (
        <MultiplayerPanel
          room={room}
          playerId={playerId}
          status={status}
          error={networkError}
          onClose={() => setLobbyOpen(false)}
          actions={{
            create: (name, solo) =>
              networkAction(() => network.current!.create(name, solo)),
            configure: (mission, difficulty) =>
              networkAction(() =>
                network.current!.configure(mission, difficulty),
              ),
            mask: (mask) => networkAction(() => network.current!.mask(mask)),
            join: (name, code) =>
              networkAction(() => network.current!.join(name, code)),
            ready: (ready) =>
              networkAction(() => network.current!.ready(ready)),
            start: () => networkAction(() => network.current!.start()),
            leave: () => networkAction(() => network.current!.leave()),
          }}
        />
      ) : null}
      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}
    </main>
  );
}
