import { MISSIONS } from "../game/heist";
import type { Member, RoomState } from "../network/protocol";
export function HeistHud({
  room,
  me,
}: {
  room: RoomState;
  me: Member | undefined;
}) {
  const h = room.heist;
  if (!h || !me) return null;
  const o = me.operative;
  const remaining = Math.max(
    0,
    Math.ceil(
      Math.min(
        h.duration - h.elapsed,
        h.lockdown === null ? Infinity : h.lockdown - h.elapsed,
      ),
    ),
  );
  const action = o.interaction?.startsWith("rescue-")
    ? "Rescue teammate"
    : o.interaction === "escape"
      ? "Escape with the crew"
      : o.interaction?.startsWith("terminal")
        ? "Download archive"
        : o.interaction === "vault"
          ? "Open the vault"
          : "Collect artifact";
  return (
    <>
      <div className="mission-hud">
        <small>
          {room.contract.difficulty.toUpperCase()} /{" "}
          {MISSIONS[room.contract.mission].title}
        </small>
        <div className="mission-progress">
          <strong>
            {h.objectiveReady
              ? "GET TO THE ENTRANCE"
              : `${h.progress} / ${h.target} SECURED`}
          </strong>
          <time>
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </time>
        </div>
        <p>
          {h.objectiveReady
            ? "Hold E in the green extraction ring. Everyone must escape."
            : MISSIONS[room.contract.mission].description}
        </p>
        <div className="meter-label">
          ALARM <span>{Math.round(h.alarm)}%</span>
        </div>
        <meter min="0" max="100" value={h.alarm} />
        {h.alarmTriggered ? (
          <b className="lockdown">LOCKDOWN IN PROGRESS</b>
        ) : null}
      </div>
      <div className="heist-notice" role="status">
        {h.notice}
      </div>
      <div className="stealth-hud">
        <div className="meter-label">
          {o.captured
            ? "CAPTURED"
            : o.escaped
              ? "SAFELY EXTRACTED"
              : "VISIBILITY"}
          <span>{Math.round(o.exposure)}%</span>
        </div>
        <meter className="exposure" min="0" max="100" value={o.exposure} />
        <div className="gadgets">
          <span>
            <kbd>Q</kbd> Smoke ×{o.smoke} {me.profile.level < 2 ? "· LV 2" : ""}
          </span>
          <span>
            <kbd>R</kbd> Jammer ×{o.jammer}{" "}
            {me.profile.level < 3 ? "· LV 3" : ""}
          </span>
        </div>
      </div>
      {o.captured ? (
        <div className="interaction-prompt danger">
          You were captured. A teammate must hold E beside you to rescue you.
        </div>
      ) : o.escaped ? (
        <div className="interaction-prompt">
          You’re safe. Waiting for the rest of the crew…
        </div>
      ) : o.interaction ? (
        <div className="interaction-prompt">
          <kbd>E</kbd> Hold to {action.toLowerCase()}
          <progress max="1" value={o.progress} />
        </div>
      ) : null}
    </>
  );
}
export function Results({
  room,
  me,
  onLobby,
  onLeave,
}: {
  room: RoomState;
  me: Member | undefined;
  onLobby: () => void;
  onLeave: () => void;
}) {
  const r = room.heist?.result;
  if (!r) return null;
  return (
    <div className="overlay">
      <section
        className="dialog results-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
      >
        <div className="eyebrow">
          OPERATION COMPLETE / {room.contract.difficulty.toUpperCase()}
        </div>
        <h2 id="result-title">
          {r.won ? "A clean getaway." : "The museum wins."}
        </h2>
        <p>{r.reason}</p>
        <div className="reward-grid">
          <div>
            <small>EXPERIENCE</small>
            <strong>+{r.xp} XP</strong>
          </div>
          <div>
            <small>HEIST CASH</small>
            <strong>${r.cash}</strong>
          </div>
          <div>
            <small>YOUR LEVEL</small>
            <strong>{me?.profile.level ?? 1}</strong>
          </div>
        </div>
        <p>
          {room.heist?.alarmTriggered ? "Alarm triggered" : "No full alarm"} ·{" "}
          {room.heist?.progress} secured ·{" "}
          {Math.floor(room.heist?.elapsed ?? 0)} seconds
        </p>
        <div className="unlock-line">
          Smoke: level 2 · Jammer & gold mask: level 3 · Onyx mask: level 5
        </div>
        {room.hostId === me?.id ? (
          <button autoFocus className="primary" onClick={onLobby}>
            Plan another heist <span>↗</span>
          </button>
        ) : (
          <p>Waiting for the host to plan the next heist.</p>
        )}
        <button className="secondary" onClick={onLeave}>
          Leave crew <span>←</span>
        </button>
      </section>
    </div>
  );
}
