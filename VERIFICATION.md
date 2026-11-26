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

## Version 2 verification — 25 November 2026

Production build passed. All 52 unit/integration tests passed, including enlarged boundary collision, navigation into both exhibition wings, solo research objectives and cooperative hacking.

Eight browser scenarios passed across the final suite and targeted reruns: vault, data, research annex, two-player artifact heist and rematch, four-player session/reconnect, invalid room, movement/stairs and camera fallback. The first complete run had two mission-route failures; restoring sprint travel with slower approaches fixed these in targeted reruns. The new research contract was completed using real controls and extraction. These are local checks, not public deployment verification.

Version 2 adds a 44 × 48 m footprint, two exhibition wings, research archives, optional artifacts, cooperative terminal hacking and distinct guard models/vision colours. The public deployment remains version 1 until this version is published.

## Version 3 verification — 26 November 2026

Production build and 53 unit/integration tests passed. New coverage verifies navigation from the lobby to outer galleries and treasures; boundary tests use the 72 × 72 m map. Two browser movement/camera scenarios and the Research Wing mission with real controls and extraction passed. Reviewed a rendered ground-floor screenshot and adjusted shadow coverage and central sculpture afterward; the subsequent build and mission test passed.

The full eight-scenario browser suite was not rerun for this version. Vite reports a 504 kB uncompressed Three.js chunk (about 128 kB gzip). No internet deployment or low-end-device performance benchmark was performed. This release uses procedural geometry/materials, not scanned photorealistic assets.

## Version 4 verification — 26 November 2026

Build and 54 unit/integration tests passed. Added tests cover whistle investigation, cooldown and captured-player rejection. A browser scenario passed for the default top-down view, keyboard movement, whistle feedback and switching back to third-person, without page errors. Reviewed the top-down screenshot and extended cutaway clipping to exhibits; rebuilt and reran the browser check. The complete multiplayer/mission browser suite has not been rerun for version 4. Public hosting remains version 3.

### Version 4 control/HUD refinement

Build and all 54 unit/integration tests passed. Browser check verified compact/expanded objectives via H, whistle feedback, keyboard movement, mouse-drag rotation changing subsequent movement direction, and camera switching without page errors. Reviewed the compact HUD and detailed minimap screenshot. Full mission regression suite was not rerun for this refinement.
