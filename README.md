# The Great Heist: Museum Edition — v4.0

A complete small-scope 3D heist game: one two-floor museum, private 2–4 player co-op, solo missions, guards, cameras, lasers, objectives, extraction, results, saved progression and rematches. Built with React, Vite, Three.js and Socket.IO.

## Play

On Windows, install Node.js 24 and double-click **Start-Game.cmd**, then open http://localhost:3001. Keep the server window open while playing.

Or use a terminal in this folder:

```sh
npm ci
npm run build
npm start
```

Choose **Play with friends**, enter a name and create a private room. Friends open the same game address and enter the six-character code. The host selects a mission and difficulty; everyone readies up; the host starts. Choose **Solo heist** for a one-player run. **Enter the museum** is offline movement practice; the lobby's **Practice** contract supports shared exploration without rewards or guards.

For different computers on the same Wi-Fi/LAN, friends use the host computer's network address instead of localhost, for example `http://192.168.1.10:3001`. If the operating system asks, allow the server on your private network. Two players on the same computer need separate browser profiles or a normal and incognito window, since each browser profile has one saved identity.

This release runs locally/LAN. Public internet hosting has not been created. See DEPLOYMENT.md for the included deployment configuration and remaining publication prerequisites.

## Missions

| Contract              | Objective                                                                         |
| --------------------- | --------------------------------------------------------------------------------- |
| The Golden Collection | Steal the marked artifacts; target scales from 3 in solo to 6 with four players.  |
| The Crown Jewel       | Hack two ground-floor archives, then open the upstairs vault and steal the crown. |
| Ghost in the System   | Download three archives spread across both floors.                                |

After completing the objective, **every crewmate must return to the entrance and hold E inside the green extraction ring**. Escape together to win. A captured teammate must be rescued before the crew can finish. If all remaining players are captured, the mission clock runs out, or lockdown finishes, the team loses. The host can return to the briefing and start a rematch or another contract.

## Controls

| Input                            | Action                                                  |
| -------------------------------- | ------------------------------------------------------- |
| WASD                             | Move relative to the camera                             |
| Mouse                            | Look after clicking the scene                           |
| Shift                            | Hold to sprint; nearby guards can hear it               |
| Ctrl or C                        | Hold to crouch; reduces guard detection range           |
| Space                            | Jump                                                    |
| E                                | Hold near an object to collect, hack, rescue or extract |
| Q                                | Smoke bomb, unlocked at level 2                         |
| R                                | Camera/laser jammer, unlocked at level 3                |
| Esc                              | Pause your controls and release the mouse               |
| Left/right arrows, or mouse drag | Alternate camera controls                               |

Pausing does **not** stop an online or solo-server mission timer, guards, or other players. Offline museum practice pauses fully. Switching windows clears controls; interrupted connections stop movement and reserve the seat for 15 seconds after detection.

## Stealth and security

Guards patrol with navigation around obstacles and between floors, investigate nearby sprint noise, and chase visible players. Gold floor cones show their approximate view; red cones indicate pursuit. Walls and floor slabs block sight. Crouching and breaking line of sight reduce exposure. Full exposure or close contact during a chase leads to capture in the southwest holding area. A teammate can hold E nearby for three seconds to rescue you.

Cameras sweep their view. Red laser barriers switch on and off every three seconds. Wait for the gap or jump over the low beam. Detection and laser trips raise the alarm. A full alarm starts a 90-second lockdown countdown. The HUD shows exposure, alarm, objectives, remaining time, gadgets and nearby interaction progress. The map marks objectives, guards, crew, jail and extraction; upper-floor objectives are purple.

## Difficulty

| Setting | Guards | Base mission time | Detection                                      | Reward multiplier |
| ------- | ------ | ----------------- | ---------------------------------------------- | ----------------- |
| Easy    | 2      | 9 minutes         | Shorter vision range, slower detection/pursuit | 1×                |
| Normal  | 3      | 7 minutes         | Standard                                       | 1.5×              |
| Hard    | 4      | 5 minutes         | Longer vision range, faster detection/pursuit  | 2×                |

## Progression and equipment

Successful extraction awards 250 XP plus a 75 XP bonus if no full alarm occurred, multiplied by difficulty. Failed runs grant 20 XP per secured objective, also scaled by difficulty. Each 250 XP adds a level. Rewards are applied once per completed run by the server.

- Level 2: two smoke charges per mission. Smoke lasts eight seconds and breaks guard/camera sight within its radius.
- Level 3: one jammer charge per mission, disabling cameras and lasers for twelve seconds; gold mask unlocked.
- Level 5: onyx mask unlocked.
- Ivory mask is available immediately. Equip masks in the lobby.

Heist cash records your earnings; this version has no spending/shop system. There are no real-money purchases. XP and equipment eligibility are server-owned, not accepted from client claims.

Progress is saved in `data/profiles.json`; an anonymous credential in browser storage identifies your profile. Keep the profile file when upgrading. Clearing browser storage loses that browser's access to its profile; there is no registration or recovery service. A server restart removes active rooms but preserves progression when the data file is retained.

## Development and tests

```sh
npm run dev
npm test
npm run build
npm run test:browser
```

Development uses the frontend on port 5173 and the backend on 3001. Production serves both on port 3001. Browser tests use installed Google Chrome; change the Playwright channel and install Chromium if needed. See VERIFICATION.md for actual results and fixture details.

## Main files

| File                                               | Responsibility                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| src/game/movement.ts, src/world/layout.ts          | Shared fixed-step movement, collision, floor and stair geometry                                 |
| src/game/heist.ts                                  | Mission, difficulty, objective, security and progression types/data                             |
| server/heist.ts                                    | Authoritative mission loop, interaction, guards, detection, gadgets, capture/rescue and results |
| server/navigation.ts                               | Grid navigation across both floors and line-of-sight tests                                      |
| server/rooms.ts                                    | Room lifecycle, host rules, readiness, simulation and reconnect                                 |
| server/profiles.ts                                 | Anonymous profile credentials, persistence, XP and cosmetics                                    |
| server/server.ts                                   | HTTP/Socket.IO service, input validation/rate limits and room snapshots                         |
| src/network/client.ts                              | Connections, profile loading, acknowledgements and session resume                               |
| src/game/engine.ts                                 | Rendering, camera, solo simulation and smoothed online players                                  |
| src/world/museum.ts, src/world/heistView.ts        | Procedural museum, players, guards, loot, cameras, lasers and smoke                             |
| src/ui/App.tsx, MultiplayerPanel.tsx, HeistHud.tsx | Menu, briefing, gameplay HUD, results and rematches                                             |
| src/game/sound.ts                                  | Procedural sound cues and mute control                                                          |

Online clients send inputs at about 30 Hz. The server runs movement at 120 Hz, mission logic at 20 Hz and snapshots at approximately 20 Hz. It rejects invalid/out-of-order inputs, bounds movement axes, expires stale input and never accepts client positions. Navigation and interactions use authoritative world state. Remote and local online visuals smooth toward server snapshots; predictive movement/lag compensation are not implemented.

## Release limits

This is a complete private-game MVP, not a commercial-scale service. Desktop keyboard/mouse only; no mobile/controller controls. One museum, three fixed contracts, simple procedural art/audio and static kinematic physics. Teammates can pass through one another. Shadows may alias and the camera can pull close near narrow railings. Rooms and profiles are designed for one Node process. Internet latency, cross-browser/device coverage and production load capacity are not established by local tests. No accounts, voice chat, open world, extra maps, matchmaking or cash shop are claimed.

All art is generated locally in code. Optional Google Fonts improve the interface; system fonts work offline. No API keys or paid asset services are required. Earlier Phase 1 and Phase 2 archives remain alongside this release.

## Version 2 development preview

The north research wing expands the ground floor from 28 × 32 m to 28 × 40 m (25% more floor area). Two separated entrances allow alternate approaches; cover blocks break sight lines. The Research Wing contract adds three archives in the annex. Each active teammate holding E within sight and range of the same terminal adds 50% hacking speed. Solo hacking remains possible. This preview is local and has not replaced the live version.

## Version 2 expanded museum

The museum footprint is now 44 × 48 m: 2,112 square metres, 2.36 times the original ground-floor footprint. Antiquities and Modern Art wings have display sculptures, cover and multiple connecting routes. The Research Wing contract spans the west wing, north archives and east wing. Two extra optional artifacts support alternate collection routes. Guards wear blue security uniforms, caps and badges; vision cones use amber for patrol, orange for investigation and red for pursuit. Nearby teammates holding E accelerate archive hacking, while solo play remains supported.

## Version 3: Grand Museum

The footprint is 72 × 72 m (5,184 square metres), 2.45 times version 2. New outer galleries, archive dividers, exhibition cases and additional treasures extend exploration routes. Gold vessels, ceramic vases and jeweled ornaments replace abstract collectible shapes. Stone-textured instanced flooring, glass cases, labels and architectural trim add detail without external asset downloads. This is procedural browser graphics, not photorealism. Version 3 is a local development build; the public game remains version 2.

## Version 4: top-down stealth

Default tactical camera follows the player from above; upper architecture and exhibits are cut away at the current floor. Press V to switch to the original third-person camera. WASD stays aligned to the tactical view. Press F during a heist to whistle: guards within 14 metres on the same floor investigate the sound for eight seconds, unless already chasing. Whistles have a six-second server-enforced cooldown and captured players cannot use them. Running remains audible; crouching reduces detection. Results award up to three display stars for escape, no lockdown, and finishing within half the time limit. Stars do not alter XP or persist separately.

This is an original museum stealth game inspired by the accessible sneaking format, not a recreation of Robbery Bob's characters or levels. Version 4 is local; the public release remains version 3.

### Control and presentation update

Mouse turning now works in both camera modes: click the playfield for pointer lock or drag to turn. WASD movement follows the camera heading; V switches views without resetting heading. The objective panel starts compact, keeping progress, time and alarm visible; H or its button toggles details. The minimap draws actual floor-appropriate partitions and exhibits. Gallery runners, brass borders, columns, skirting and directional signs improve visual navigation.
