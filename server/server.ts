import { createServer } from "node:http";
import { resolve } from "node:path";
import express from "express";
import { Server } from "socket.io";
import { FIXED_DT } from "../src/game/movement";
import type { ClientEvents, ServerEvents, Ack } from "../src/network/protocol";
import { RoomStore } from "./rooms";
import type { Room, ServerMember } from "./rooms";
import { ProfileStore } from "./profiles";

export function createHeistServer(
  options: { graceMs?: number; profileFile?: string } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.get("/health", (_req, res) => res.json({ ok: true, version: "1.0.0" }));
  app.use(express.static(resolve("dist")));
  const http = createServer(app);
  const io = new Server<ClientEvents, ServerEvents>(http, {
    serveClient: false,
    maxHttpBufferSize: 8192,
    pingInterval: 5000,
    pingTimeout: 5000,
  });
  const profiles = new ProfileStore(options.profileFile);
  const store = new RoomStore(options.graceMs, profiles);
  const broadcast = (room: Room) =>
    io.to(room.code).emit("room:state", store.snapshot(room));
  io.on("connection", (socket) => {
    const auth = profiles.authenticate(socket.handshake.auth.profileKey);
    socket.emit("profile:state", { token: auth.token, profile: auth.profile });
    let current: { room: Room; member: ServerMember } | null = null;
    let windowStart = Date.now(),
      actions = 0;
    const action = (ack: Ack, fn: () => void) => {
      if (typeof ack !== "function") return;
      if (Date.now() - windowStart > 1000) {
        actions = 0;
        windowStart = Date.now();
      }
      if (++actions > 12) {
        ack({ ok: false, error: "Too many requests. Wait a moment." });
        return;
      }
      try {
        fn();
      } catch (e) {
        ack({
          ok: false,
          error: e instanceof Error ? e.message : "Request failed.",
        });
      }
    };
    const requireRoom = () => {
      if (!current) throw new Error("Join a room first.");
      return current;
    };
    const enter = (ack: Ack, fn: () => NonNullable<typeof current>) =>
      action(ack, () => {
        if (current) throw new Error("Leave your current room first.");
        current = fn();
        void socket.join(current.room.code);
        ack({
          ok: true,
          data: {
            room: store.snapshot(current.room),
            playerId: current.member.id,
            token: current.member.token,
          },
        });
        broadcast(current.room);
      });
    socket.on("room:create", (data, ack) =>
      enter(ack, () =>
        store.create(data?.name, socket.id, auth.token, data?.solo === true),
      ),
    );
    socket.on("room:join", (data, ack) =>
      enter(ack, () =>
        store.join(data?.code, data?.name, socket.id, auth.token),
      ),
    );
    socket.on("room:resume", (data, ack) =>
      enter(ack, () =>
        store.resume(data?.code, data?.token, socket.id, Date.now()),
      ),
    );
    socket.on("room:ready", (ready, ack) =>
      action(ack, () => {
        const { room, member } = requireRoom();
        if (room.phase !== "lobby" || typeof ready !== "boolean")
          throw new Error("Ready is only available in the lobby.");
        member.ready = ready;
        ack({ ok: true });
        broadcast(room);
      }),
    );
    socket.on("room:configure", (data, ack) =>
      action(ack, () => {
        const { room, member } = requireRoom();
        store.configure(room, member, data);
        ack({ ok: true });
        broadcast(room);
      }),
    );
    socket.on("player:interact", (held) => {
      if (current) store.interact(current.room, current.member, held);
    });
    socket.on("player:gadget", (gadget, ack) =>
      action(ack, () => {
        const { room, member } = requireRoom();
        store.gadget(room, member, gadget);
        ack({ ok: true });
        broadcast(room);
      }),
    );
    socket.on("profile:mask", (mask, ack) =>
      action(ack, () => {
        if (current && current.room.phase !== "lobby")
          throw new Error("Change masks in the lobby.");
        profiles.mask(auth.token, mask);
        socket.emit("profile:state", {
          token: auth.token,
          profile: auth.profile,
        });
        ack({ ok: true });
        if (current) broadcast(current.room);
      }),
    );
    socket.on("room:start", (ack) =>
      action(ack, () => {
        const { room, member } = requireRoom();
        store.start(room, member);
        ack({ ok: true });
        broadcast(room);
      }),
    );
    socket.on("room:lobby", (ack) =>
      action(ack, () => {
        const { room, member } = requireRoom();
        store.lobby(room, member);
        ack({ ok: true });
        broadcast(room);
      }),
    );
    socket.on("room:leave", (ack) =>
      action(ack, () => {
        if (current) {
          const { room, member } = current;
          void socket.leave(room.code);
          store.remove(room, member);
          broadcast(room);
          current = null;
        }
        ack({ ok: true });
      }),
    );
    // Bound processing separately from UI actions. Excess input cannot speed up simulation.
    let inputWindow = Date.now(),
      inputs = 0;
    socket.on("player:input", (packet) => {
      const now = Date.now();
      if (now - inputWindow > 1000) {
        inputWindow = now;
        inputs = 0;
      }
      if (++inputs > 90 || !current) return;
      store.input(current.room, current.member, packet, now);
    });
    socket.on("disconnect", () => {
      if (current) {
        store.disconnect(current.room, current.member, Date.now());
        broadcast(current.room);
        current = null;
      }
    });
  });
  let previous = performance.now(),
    accumulator = 0,
    snapshotTime = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    const dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    accumulator += dt;
    snapshotTime += dt;
    while (accumulator >= FIXED_DT) {
      store.tick(Date.now());
      accumulator -= FIXED_DT;
    }
    if (snapshotTime >= 0.05) {
      snapshotTime = 0;
      for (const room of store.rooms.values()) broadcast(room);
    }
  }, 8);
  return {
    http,
    io,
    store,
    close: () =>
      new Promise<void>((done) => {
        clearInterval(timer);
        io.close(() => done());
      }),
  };
}
