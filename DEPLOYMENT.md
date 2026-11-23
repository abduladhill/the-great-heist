# Publishing the Museum Edition

The game requires one persistent Node.js service, not static-only hosting or short-lived serverless functions. Both HTTP and Socket.IO use the same port. A single server instance owns the active rooms.

## Native Node service

- Node: 24 recommended
- Build: `npm ci && npm run build`
- Start: `npm start`
- Health endpoint: `/health`
- Set `PORT` to the host's assigned port; the service listens on `0.0.0.0`.
- Set `PROFILE_FILE` to a location on a persistent disk, for example `/data/profiles.json`.
- Enable HTTPS and WebSocket forwarding at the host. No separate frontend deployment is necessary.
- Keep one instance unless room state and profile storage are moved to shared infrastructure.

## Container option

A Dockerfile is included. Docker was not installed in the development environment, so the container image itself has not been built or verified here. The native build and server have been tested.

```sh
docker build -t great-heist .
docker run --name great-heist -p 3001:3001 -v heist-data:/app/data great-heist
```

## Saved progression

The server stores XP, levels, cash, unlocked equipment eligibility and selected masks in the profile file. Back up that file. Each browser holds its anonymous bearer credential in local storage. Clearing browser storage loses access to that profile; there is no account-recovery system. Do not publish the `data` directory, profile file, `.env`, or browser credentials. Runtime data is excluded from both source control and the release archive.

Rooms are temporary and are lost on a server restart. Restarting the server does not erase saved progression when the profile file lives on persistent storage. The file store is designed for one process and a small private-game deployment, not horizontal scaling or a commercial account economy.

## Current publication status

The game runs locally/LAN. Source: https://github.com/abduladhill/the-great-heist. A live public game deployment has not been created. Hosting requires a long-running Node service and persistent storage for saved progression. No hosting charges have been incurred.

