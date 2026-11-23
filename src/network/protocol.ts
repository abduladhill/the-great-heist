import type { InputFrame, PlayerState } from "../game/types";
import type {
  Contract,
  HeistState,
  Operative,
  Profile,
  Gadget,
} from "../game/heist";
export const COLORS = ["#4aa89d", "#dfaf66", "#b597e1", "#df8596"];
export const MAX_PLAYERS = 4;
export const NEUTRAL: InputFrame = {
  forward: 0,
  right: 0,
  yaw: 0,
  sprint: false,
  crouch: false,
  jump: false,
};
export interface Member {
  id: string;
  name: string;
  color: string;
  ready: boolean;
  connected: boolean;
  state: PlayerState;
  operative: Operative;
  profile: Profile;
}
export interface RoomState {
  code: string;
  hostId: string;
  phase: "lobby" | "playing" | "results";
  contract: Contract;
  heist: HeistState | null;
  tick: number;
  players: Member[];
}
export interface JoinResult {
  room: RoomState;
  playerId: string;
  token: string;
}
export interface Reply {
  ok: boolean;
  error?: string;
  data?: JoinResult;
}
export type Ack = (reply: Reply) => void;
export interface InputPacket {
  seq: number;
  input: InputFrame;
}
export interface ServerEvents {
  "room:state": (room: RoomState) => void;
  "profile:state": (data: { token: string; profile: Profile }) => void;
}
export interface ClientEvents {
  "room:create": (data: { name: string; solo?: boolean }, ack: Ack) => void;
  "room:configure": (
    data: { mission: Contract["mission"]; difficulty: Contract["difficulty"] },
    ack: Ack,
  ) => void;
  "player:interact": (held: boolean) => void;
  "player:gadget": (gadget: Gadget, ack: Ack) => void;
  "profile:mask": (mask: Profile["mask"], ack: Ack) => void;
  "room:join": (data: { name: string; code: string }, ack: Ack) => void;
  "room:resume": (data: { code: string; token: string }, ack: Ack) => void;
  "room:ready": (ready: boolean, ack: Ack) => void;
  "room:start": (ack: Ack) => void;
  "room:lobby": (ack: Ack) => void;
  "room:leave": (ack: Ack) => void;
  "player:input": (packet: InputPacket) => void;
}
