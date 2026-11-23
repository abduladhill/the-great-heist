import { randomBytes, randomUUID } from "node:crypto";
import { createPlayer, stepPlayer, FIXED_DT } from "../src/game/movement";
import { COLORS, MAX_PLAYERS, NEUTRAL } from "../src/network/protocol";
import type { InputFrame } from "../src/game/types";
import type { Member, RoomState, InputPacket } from "../src/network/protocol";
import {
  DEFAULT_CONTRACT,
  freshOperative,
  DIFFICULTIES,
  MISSIONS,
} from "../src/game/heist";
import type { Contract, HeistState, Gadget } from "../src/game/heist";
import { HeistDirector } from "./heist";
import { ProfileStore } from "./profiles";

export interface ServerMember extends Member {
  token: string;
  socketId: string | null;
  expires: number;
  input: InputFrame;
  seq: number;
  lastInput: number;
  profileKey: string;
  holding: boolean;
}
export interface Room {
  code: string;
  hostId: string;
  phase: "lobby" | "playing" | "results";
  contract: Contract;
  heist: HeistState | null;
  director: HeistDirector | null;
  tick: number;
  players: Map<string, ServerMember>;
}
export function validName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a player name.");
  const name = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 20);
  if (!name) throw new Error("Enter a player name.");
  return name;
}
export function validCode(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[A-Z0-9]{6}$/.test(value.trim().toUpperCase())
  )
    throw new Error("Enter a six-character room code.");
  return value.trim().toUpperCase();
}
export function parseInput(value: unknown): InputPacket | null {
  if (!value || typeof value !== "object") return null;
  const { seq, input } = value as InputPacket;
  if (
    !Number.isSafeInteger(seq) ||
    seq < 0 ||
    seq > 2147483647 ||
    !input ||
    typeof input !== "object"
  )
    return null;
  if (
    ![input.forward, input.right, input.yaw].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    ) ||
    Math.abs(input.yaw) > 1e6
  )
    return null;
  if (
    ![input.sprint, input.crouch, input.jump].every(
      (v) => typeof v === "boolean",
    )
  )
    return null;
  if (input.interact !== undefined && typeof input.interact !== "boolean")
    return null;
  return {
    seq,
    input: {
      forward: Math.max(-1, Math.min(1, input.forward)),
      right: Math.max(-1, Math.min(1, input.right)),
      yaw: input.yaw,
      sprint: input.sprint,
      crouch: input.crouch,
      jump: input.jump,
      interact: input.interact ?? false,
    },
  };
}
export class RoomStore {
  rooms = new Map<string, Room>();
  constructor(
    readonly graceMs = 15000,
    readonly profiles = new ProfileStore(),
  ) {}
  snapshot(room: Room): RoomState {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      tick: room.tick,
      contract: { ...room.contract },
      heist: room.heist ? structuredClone(room.heist) : null,
      players: [...room.players.values()].map(
        ({ id, name, color, ready, socketId, state, operative, profile }) => ({
          id,
          name,
          color,
          ready,
          connected: !!socketId,
          state: { ...state },
          operative: { ...operative },
          profile: { ...profile },
        }),
      ),
    };
  }
  create(name: unknown, socketId: string, profileKey?: string, solo = false) {
    if (this.rooms.size >= 100)
      throw new Error("The server is full. Try again shortly.");
    const safeName = validName(name);
    let code: string;
    do {
      code = randomBytes(3).toString("hex").toUpperCase();
    } while (this.rooms.has(code));
    const room: Room = {
      code,
      hostId: "",
      phase: "lobby",
      tick: 0,
      players: new Map(),
      contract: { ...DEFAULT_CONTRACT, solo },
      heist: null,
      director: null,
    };
    const member = this.add(room, safeName, socketId, profileKey);
    room.hostId = member.id;
    this.rooms.set(code, room);
    return { room, member };
  }
  join(code: unknown, name: unknown, socketId: string, profileKey?: string) {
    const room = this.rooms.get(validCode(code));
    if (!room)
      throw new Error("Room not found. Check the code with your host.");
    if (room.phase !== "lobby")
      throw new Error(
        "This crew is already exploring. Ask the host to return to the lobby.",
      );
    if (room.contract.solo)
      throw new Error(
        "This is a solo run. Create a crew room to play together.",
      );
    if (room.players.size >= MAX_PLAYERS)
      throw new Error("This room is full (4 players).");
    return {
      room,
      member: this.add(room, validName(name), socketId, profileKey),
    };
  }
  private add(room: Room, name: string, socketId: string, profileKey?: string) {
    const auth = this.profiles.authenticate(profileKey);
    if ([...room.players.values()].some((p) => p.profileKey === auth.token))
      throw new Error(
        "This profile is already in the room. Use a separate browser profile for another player.",
      );
    const color = COLORS.find(
      (c) => ![...room.players.values()].some((p) => p.color === c),
    )!;
    const member: ServerMember = {
      id: randomUUID(),
      token: randomBytes(24).toString("hex"),
      name,
      color,
      ready: false,
      connected: true,
      state: createPlayer(),
      socketId,
      expires: 0,
      input: { ...NEUTRAL },
      seq: -1,
      lastInput: 0,
      profileKey: auth.token,
      profile: auth.profile,
      operative: freshOperative(),
      holding: false,
    };
    room.players.set(member.id, member);
    return member;
  }
  resume(code: unknown, token: unknown, socketId: string, now: number) {
    const room = this.rooms.get(validCode(code));
    const member =
      room && [...room.players.values()].find((p) => p.token === token);
    if (!room || !member || member.socketId || now > member.expires)
      throw new Error(
        "Your room session expired. Create or join a room again.",
      );
    member.socketId = socketId;
    member.connected = true;
    member.expires = 0;
    member.seq = -1;
    member.input = { ...NEUTRAL };
    member.holding = false;
    if (
      ![...room.players.values()].some(
        (p) => p.id === room.hostId && p.socketId,
      )
    )
      room.hostId = member.id;
    return { room, member };
  }
  disconnect(room: Room, member: ServerMember, now: number) {
    member.socketId = null;
    member.connected = false;
    member.ready = false;
    member.expires = now + this.graceMs;
    member.input = { ...NEUTRAL };
    member.holding = false;
    this.transferHost(room);
  }
  remove(room: Room, member: ServerMember) {
    room.players.delete(member.id);
    this.transferHost(room);
    if (!room.players.size) this.rooms.delete(room.code);
  }
  private transferHost(room: Room) {
    if (!room.players.get(room.hostId)?.socketId)
      room.hostId =
        [...room.players.values()].find((p) => p.socketId)?.id ??
        room.players.keys().next().value ??
        "";
  }
  start(room: Room, member: ServerMember) {
    if (room.hostId !== member.id)
      throw new Error("Only the host can start exploration.");
    if (room.phase !== "lobby")
      throw new Error("Exploration has already started.");
    const crew = [...room.players.values()].filter((p) => p.socketId);
    if (crew.length < (room.contract.solo ? 1 : 2))
      throw new Error("At least two connected players are needed.");
    if (!crew.every((p) => p.ready))
      throw new Error("Everyone must be ready first.");
    room.phase = "playing";
    [...room.players.values()].forEach((p, i) => {
      p.state = { ...createPlayer(), x: (i - 1.5) * 1.15 };
      p.input = { ...NEUTRAL };
      p.operative = freshOperative();
      p.operative.smoke = p.profile.level >= 2 ? 2 : 0;
      p.operative.jammer = p.profile.level >= 3 ? 1 : 0;
      p.holding = false;
    });
    room.director =
      room.contract.mission === "training"
        ? null
        : new HeistDirector(room, (p, won, xp, cash) =>
            this.profiles.reward(p.profileKey, won, xp, cash),
          );
    room.heist = room.director?.state ?? null;
  }
  lobby(room: Room, member: ServerMember) {
    if (room.hostId !== member.id)
      throw new Error("Only the host can return everyone to the lobby.");
    room.phase = "lobby";
    room.heist = null;
    room.director = null;
    for (const p of room.players.values()) {
      p.ready = false;
      p.input = { ...NEUTRAL };
      p.holding = false;
    }
  }
  configure(room: Room, member: ServerMember, data: unknown) {
    if (room.hostId !== member.id || room.phase !== "lobby")
      throw new Error("Only the host can change the contract in the lobby.");
    const d = data as Partial<Contract> | null;
    if (
      !d ||
      !Object.hasOwn(MISSIONS, d.mission ?? "") ||
      !Object.hasOwn(DIFFICULTIES, d.difficulty ?? "")
    )
      throw new Error("Invalid mission or difficulty.");
    room.contract = {
      ...room.contract,
      mission: d.mission!,
      difficulty: d.difficulty!,
    };
    for (const p of room.players.values()) p.ready = false;
  }
  interact(room: Room, member: ServerMember, held: unknown) {
    if (
      typeof held === "boolean" &&
      room.phase === "playing" &&
      !member.operative.captured &&
      !member.operative.escaped
    )
      member.holding = held;
  }
  gadget(room: Room, member: ServerMember, gadget: Gadget) {
    if (room.phase !== "playing" || !room.director)
      throw new Error("Gadgets are only available during a heist.");
    room.director.gadget(member, gadget);
  }
  input(room: Room, member: ServerMember, value: unknown, now: number) {
    const packet = parseInput(value);
    if (room.phase !== "playing" || !packet || packet.seq <= member.seq) return;
    member.seq = packet.seq;
    member.lastInput = now;
    member.holding = packet.input.interact ?? false;
    member.input = {
      ...packet.input,
      jump: member.input.jump || packet.input.jump,
    };
  }
  tick(now: number) {
    for (const room of this.rooms.values()) {
      for (const p of room.players.values()) {
        if (!p.socketId && now >= p.expires) {
          this.remove(room, p);
          continue;
        }
        if (
          room.phase === "playing" &&
          !p.operative.captured &&
          !p.operative.escaped
        ) {
          // The server clock, never packet count or client-supplied time, controls distance.
          const input =
            p.socketId && now - p.lastInput < 250 ? p.input : NEUTRAL;
          stepPlayer(p.state, input, FIXED_DT);
          p.input.jump = false;
          if (now - p.lastInput >= 250) p.holding = false;
        }
      }
      room.tick++;
      if (room.phase === "playing" && room.tick % 6 === 0)
        room.director?.step(FIXED_DT * 6);
    }
  }
}
