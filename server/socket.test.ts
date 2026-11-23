import { afterEach, beforeEach, expect, it } from "vitest";
import { io, Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { createHeistServer } from "./server";
import { NEUTRAL } from "../src/network/protocol";
import type {
  ServerEvents,
  ClientEvents,
  RoomState,
} from "../src/network/protocol";
let server: ReturnType<typeof createHeistServer>, url: string;
let clients: Socket<ServerEvents, ClientEvents>[] = [];
beforeEach(async () => {
  server = createHeistServer({ graceMs: 1000 });
  await new Promise<void>((done) => server.http.listen(0, "127.0.0.1", done));
  url = `http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;
});
afterEach(async () => {
  clients.forEach((c) => c.disconnect());
  clients = [];
  await server.close();
});
async function client() {
  const c: Socket<ServerEvents, ClientEvents> = io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  clients.push(c);
  await new Promise<void>((done) => c.once("connect", () => done()));
  return c;
}
it("four actual Socket.IO connections share snapshots while a separate room stays isolated", async () => {
  const sockets = await Promise.all(Array.from({ length: 5 }, () => client()));
  const joined = await sockets[0]
    .timeout(2000)
    .emitWithAck("room:create", { name: "Host" });
  const code = joined.data!.room.code;
  for (let i = 1; i < 4; i++)
    expect(
      (
        await sockets[i]
          .timeout(2000)
          .emitWithAck("room:join", { name: `Guest${i}`, code })
      ).ok,
    ).toBe(true);
  expect(
    (
      await sockets[4]
        .timeout(2000)
        .emitWithAck("room:join", { name: "Fifth", code })
    ).error,
  ).toContain("full");
  await sockets[4]
    .timeout(2000)
    .emitWithAck("room:create", { name: "Isolated" });
  let remote: RoomState | undefined, isolated: RoomState | undefined;
  sockets[1].on("room:state", (r) => (remote = r));
  sockets[4].on("room:state", (r) => (isolated = r));
  for (let i = 0; i < 4; i++)
    await sockets[i].timeout(2000).emitWithAck("room:ready", true);
  expect((await sockets[1].timeout(2000).emitWithAck("room:start")).ok).toBe(
    false,
  );
  expect((await sockets[0].timeout(2000).emitWithAck("room:start")).ok).toBe(
    true,
  );
  sockets[0].emit("player:input", {
    seq: 0,
    input: { ...NEUTRAL, forward: 1 },
  });
  await expect.poll(() => remote?.players[0].state.z).toBeLessThan(11.9);
  await expect.poll(() => isolated?.players.length).toBe(1);
  await new Promise((done) => setTimeout(done, 350));
  const stopped = remote!.players[0].state.z;
  await new Promise((done) => setTimeout(done, 150));
  expect(remote!.players[0].state.z).toBeCloseTo(stopped);
  expect(remote!.players.length).toBe(4);
  expect(isolated!.code).not.toBe(code);
});
it("reconnect restores identity, transfers host and explicit leave removes the seat", async () => {
  const a = await client(),
    b = await client();
  const created = (
    await a.timeout(2000).emitWithAck("room:create", { name: "One" })
  ).data!;
  const joined = (
    await b
      .timeout(2000)
      .emitWithAck("room:join", { name: "Two", code: created.room.code })
  ).data!;
  a.disconnect();
  await expect
    .poll(() => server.store.rooms.get(created.room.code)?.hostId)
    .toBe(joined.playerId);
  const replacement = await client();
  const result = await replacement.timeout(2000).emitWithAck("room:resume", {
    code: created.room.code,
    token: created.token,
  });
  expect(result.data?.playerId).toBe(created.playerId);
  expect(result.data?.room.players.length).toBe(2);
  await b.timeout(2000).emitWithAck("room:leave");
  expect(server.store.rooms.get(created.room.code)?.hostId).toBe(
    created.playerId,
  );
  await replacement.timeout(2000).emitWithAck("room:leave");
  expect(server.store.rooms.size).toBe(0);
});
