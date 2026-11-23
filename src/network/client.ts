import { io, Socket } from "socket.io-client";
import type {
  ClientEvents,
  ServerEvents,
  RoomState,
  JoinResult,
  Reply,
} from "./protocol";
import type { InputFrame } from "../game/types";
import type { Profile, Contract, Gadget } from "../game/heist";
export type ConnectionStatus =
  "offline" | "connecting" | "connected" | "reconnecting";
export class MultiplayerClient {
  private socket: Socket<ServerEvents, ClientEvents>;
  private session: JoinResult | null = null;
  private seq = 0;
  private connecting: Promise<void> | null = null;
  private cancelConnect: (() => void) | null = null;
  room: RoomState | null = null;
  profile: Profile | null = null;
  get playerId() {
    return this.session?.playerId ?? "";
  }
  get connected() {
    return this.socket.connected && !!this.session;
  }
  constructor(
    private onRoom: (room: RoomState | null) => void,
    private onStatus: (status: ConnectionStatus) => void,
    private onError: (message: string) => void,
    private onProfile: (profile: Profile) => void = () => {},
  ) {
    let profileKey = "";
    try {
      profileKey = localStorage.getItem("heist-profile-key") ?? "";
    } catch {
      /* Storage may be disabled. */
    }
    this.socket = io({
      autoConnect: false,
      timeout: 4000,
      auth: { profileKey },
    });
    this.socket.on("profile:state", ({ token, profile }) => {
      this.socket.auth = { profileKey: token };
      try {
        localStorage.setItem("heist-profile-key", token);
      } catch {
        /* Guest profile lasts for this page. */
      }
      this.profile = profile;
      this.onProfile(profile);
    });
    this.socket.on("room:state", (room) => {
      if (room.code === this.session?.room.code) {
        this.room = room;
        const me = room.players.find((p) => p.id === this.playerId);
        if (me) {
          this.profile = me.profile;
          this.onProfile(me.profile);
        }
        this.onRoom(room);
      }
    });
    this.socket.on("disconnect", () =>
      this.onStatus(this.session ? "reconnecting" : "offline"),
    );
    this.socket.on("connect_error", () =>
      this.onStatus(this.session ? "reconnecting" : "offline"),
    );
    this.socket.on("connect", () => {
      this.onStatus("connected");
      if (this.session) {
        const { code } = this.session.room,
          token = this.session.token;
        void this.socket
          .timeout(5000)
          .emitWithAck("room:resume", { code, token })
          .then((reply) => {
            if (!reply.ok || !reply.data) throw new Error(reply.error);
            this.accept(reply.data);
          })
          .catch((e) => {
            this.clear();
            this.onError(
              e instanceof Error ? e.message : "Could not resume the room.",
            );
          });
      }
    });
  }
  private connect(): Promise<void> {
    if (this.socket.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.onStatus("connecting");
    this.connecting = new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off("connect", done);
        this.connecting = null;
        this.cancelConnect = null;
      };
      const done = () => {
        cleanup();
        resolve();
      };
      const timer = setTimeout(() => {
        cleanup();
        this.socket.disconnect();
        this.onStatus("offline");
        reject(
          new Error(
            "The multiplayer server is unavailable. Start the server and try again.",
          ),
        );
      }, 5000);
      this.cancelConnect = () => {
        cleanup();
        reject(new Error("Connection closed."));
      };
      this.socket.once("connect", done);
      this.socket.connect();
    });
    return this.connecting;
  }
  private accept(data: JoinResult) {
    this.session = data;
    this.seq = 0;
    this.room = data.room;
    this.onRoom(data.room);
  }
  private async request(promise: Promise<Reply>) {
    let reply: Reply;
    try {
      reply = await promise;
    } catch {
      throw new Error(
        "The server did not reply. Check your connection and try again.",
      );
    }
    if (!reply.ok) throw new Error(reply.error ?? "Request failed.");
    if (reply.data) this.accept(reply.data);
  }
  async create(name: string, solo = false) {
    await this.connect();
    await this.request(
      this.socket.timeout(5000).emitWithAck("room:create", { name, solo }),
    );
  }
  loadProfile() {
    return this.connect();
  }
  configure(mission: Contract["mission"], difficulty: Contract["difficulty"]) {
    return this.request(
      this.socket
        .timeout(5000)
        .emitWithAck("room:configure", { mission, difficulty }),
    );
  }
  mask(mask: Profile["mask"]) {
    return this.request(
      this.socket.timeout(5000).emitWithAck("profile:mask", mask),
    );
  }
  interact(held: boolean) {
    if (this.connected) this.socket.emit("player:interact", held);
  }
  gadget(gadget: Gadget) {
    return this.request(
      this.socket.timeout(5000).emitWithAck("player:gadget", gadget),
    );
  }
  async join(name: string, code: string) {
    await this.connect();
    await this.request(
      this.socket.timeout(5000).emitWithAck("room:join", { name, code }),
    );
  }
  ready(ready: boolean) {
    return this.request(
      this.socket.timeout(5000).emitWithAck("room:ready", ready),
    );
  }
  start() {
    return this.request(this.socket.timeout(5000).emitWithAck("room:start"));
  }
  lobby() {
    return this.request(this.socket.timeout(5000).emitWithAck("room:lobby"));
  }
  send(input: InputFrame) {
    if (this.connected && this.room?.phase === "playing")
      this.socket.volatile.emit("player:input", { seq: this.seq++, input });
  }
  async leave() {
    try {
      if (this.socket.connected)
        await this.request(this.socket.timeout(3000).emitWithAck("room:leave"));
    } finally {
      this.clear();
      this.socket.disconnect();
      this.onStatus("offline");
    }
  }
  private clear() {
    this.session = null;
    this.room = null;
    this.onRoom(null);
  }
  dispose() {
    this.cancelConnect?.();
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}
