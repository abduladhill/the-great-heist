# Museum Edition v1.0 verification

Report updated 23 November 2026. Verified on Windows with Node 24.18.0 and Google Chrome through Playwright.

| Check | Result |
| --- | --- |
| TypeScript and production build | Passed |
| Movement tests | 17 passed |
| Room lifecycle and validation tests | 15 passed |
| Heist, navigation and guard tests | 13 passed |
| Profile persistence test | 1 passed |
| Real Socket.IO integration tests | 2 passed |
| Total unit/integration tests | **48 passed** |
| Browser suite | **7 passed**, 3.3 minutes |
| Dependency audit | 0 reported vulnerabilities at verification |

## Browser coverage

- Solo vault contract: hack both archives, open the upper-floor vault, steal the crown and extract with real keyboard controls.
- Solo data contract: download all three archives across two floors and extract.
- Two independent browsers: complete the artifact contract, extract together, earn XP, rematch, use unlocked smoke, and reload to verify saved progression.
- Four independent browsers: join, ready, move, crouch, jump, climb stairs, observe synchronized movement, disconnect/reconnect, transfer host and return to the lobby.
- Invalid room codes show an actionable error.
- Solo exploration: keyboard movement, stance, pause, stair ascent/descent and reset.
- Camera fallback and safe focus-loss behavior.

The solo vault/data browser scenarios seed level-3 veteran profiles through the real server ProfileStore reward API to exercise unlocked gadgets. They do not teleport players or disable guards: objectives and traversal use actual game controls. The two-player artifact scenario starts with fresh profiles. Contract scenarios serve the production build from a real game server.

## Fixes verified

Held interaction is replicated in input packets so a temporary stale-input timeout does not permanently cancel a held key. Connection lifecycle cleanup prevents an obsolete timeout from marking a newer connection offline and disabling rematch readiness.

## Evidence

The local release archive includes test-results screenshots: menu, ground-floor, upper-gallery, compact-desktop, multiplayer-lobby, multiplayer-crew, multiplayer-upper-gallery, vault-objective, vault-victory, data-objective, data-victory, heist-objective-complete and heist-victory. Generated screenshots are excluded from source control.

## Limits

These tests run on one computer; they do not establish internet latency, cross-device compatibility or production load capacity. Rooms live in one server process. Saved anonymous profiles require persistent disk storage and have no account recovery. Docker configuration is provided but was not built because Docker is unavailable in this environment. A public hosted game has not been deployed.
