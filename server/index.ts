import { createHeistServer } from "./server";
const server = createHeistServer({
  profileFile: process.env.PROFILE_FILE ?? "data/profiles.json",
});
const port = Number(process.env.PORT ?? 3001);
server.http.listen(port, process.env.HOST ?? "0.0.0.0", () =>
  console.log(`Great Heist Museum Edition v1.0: http://localhost:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
