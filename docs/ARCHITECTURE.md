# Architecture

## The page

The client is a single HTML file. `scripts/build.mjs` concatenates the modules in `client/src` (order in `scripts/sources.mjs`), strips the `export` line from the two files shared with the server, bundles everything with three.js through esbuild, inlines three variable fonts as base64 `woff2`, and wraps it in the markup and styles from `client/shell.html`.

The modules share one scope on purpose: the game is one long-lived world with a lot of cross-talk (the HUD reads the player, the world screens read the league, the bartender reads the daily tasks). Each file owns one area and exposes plain functions; test hooks live on `window.__cc`.

### Frame loop (`07-ui.js → frame()`)

1. input → player movement and camera (`06-game.js`)
2. NPCs, players outside, doors, network tick
3. avatar rigs (far avatars animate every third frame), particles, world animation
4. tags and bubbles projected to screen space
5. desk monitors (three per frame, round robin), big screen
6. proximity prompt (`E · …`), minimap, HUD, social tick (bartender, music, weekly board)
7. adaptive quality (`autoQuality`) and the post-processing composer

### Rendering

* `THREE.WebGLRenderer` with ACES tone mapping, a `RoomEnvironment` PMREM for reflections, bloom, SMAA and a final grade pass.
* World screens (desk monitors, the big screen, boards, posters) are `CanvasTexture`s redrawn on timers, not every frame.
* Static scenery is merged with `mergeGeometries` to keep draw calls low.
* Quality steps down automatically on slow devices (pixel ratio, shadows, bloom).

### Audio

`16-social.js` synthesises a lo-fi loop live with WebAudio: electric piano with tremolo, triangle bass, kick/snare/hat from noise, a sparse lead through a feedback delay, vinyl crackle and a convolution reverb. Four chord progressions rotate every eight bars, with breaks every sixteen. Room ambience (murmur, keyboards, glasses inside; wind and crickets outside) is mixed by where the player stands and ducked while a panel is open. There are no audio files.

### Share images

Share cards (Solana card, arcade grade, coin, invite pass, the link preview `public/og.png`) are drawn on a 1200×675 canvas in the browser and handed to X through the clipboard or the native share sheet.

## The server

`src/index.js` exports the Worker (static page, everything else forwarded to the room) and the `Cafe` Durable Object.

* **State** lives in Durable Object storage: agents (coins), sessions, profiles, chip balances, boards, invite records. Hot data is cached on the instance.
* **WebSocket room**: players send `hello`, `p` (position), `say`, `emote`; the room broadcasts presence, chat, launches, trades, prices, boosts, plates, league updates, arcade highlights and megaphone shouts.
* **Launches**: the player pays the launch fee; the server verifies the transfer on chain, creates the coin through PumpPortal with a fresh mint keypair, seats it at a desk and starts streaming its trades. A pending launch survives restarts and is finished or recovered on the next wake.
* **Payments**: `checkPayment(sig, sol, from?)` reads the transaction from Solana (with RPC fallbacks), checks the receiver and the amount, and refuses reused signatures.
* **Scheduled job** (every 10 minutes): finish pending launches, recover orphans, claim creator fees, sweep the hot wallet above the reserve (the buyback share to the buyback wallet, the rest to the treasury), then one buyback step.

## Buyback

```
creator fees + site payments ─▶ hot wallet ─(sweep)─▶ BUYBACK_SHARE ─▶ buyback wallet ─▶ market buy ─▶ burn
                                                    └─▶ the rest ─▶ treasury
```

* Off until `BUYBACK_MINT` and the `BUYBACK_SECRET_KEY` secret are set. With `BUYBACK_FROM=all` the site's payments are addressed to the hot wallet so they can be split; payments addressed to the old receiver are still accepted.
* Each step buys between 55% and 100% of `min(balance, BUYBACK_MAX_SOL)` through PumpPortal (bonding curve or AMM, chosen automatically), and skips about a third of the runs at random while the wallet is small, so there is no fixed schedule to trade against.
* With `BUYBACK_MODE=burn` everything the wallet holds of the token is burned right after the buy (SPL Burn, works for Token and Token-2022).
* `GET /api/buyback` and the `buyback` socket event feed the weekly board and the town.

### Feature modules

Each installs methods onto `Cafe.prototype`:

| Module | What it owns |
|---|---|
| `extras.js` | cosmetics shop, VIP, pro feed, desk plates, chip packs, chips casino (slots, crash, high-low) |
| `arcade.js` + `arcade-games.js` | ranked runs: issue, time, score, boards |
| `hunt.js` + `hunt-data.js` | daily crates (position-checked), story cards, candles |
| `league.js` | the weekly Trench League: backing, peaks, settlement, champions, royalties |
| `ref.js` | invite codes, joins, weekly recruiter table |
| `bank.js` | daily streak, daily tasks, chip prices for boosts and plates, megaphone, espresso |
| `buyback.js` | buyback robot: sweep split, randomised market buys of the main token, burn, public stats |

## The chip economy

```
            ┌────────────── earn ──────────────┐
 packs ──▶  │ streak · tasks · crates · cards  │
            │ candles · royalties · invites    │
            │ league wins · casino wins        │
            └──────────────┬───────────────────┘
                           ▼
                        CHIPS
                           │
            ┌───────────── spend ──────────────┐
            │ casino · ranked runs · league    │
            │ boosts · desk plates · cosmetics │
            │ megaphone · double-XP espresso   │
            └──────────────────────────────────┘
```

Chips are a closed loop: no withdrawal, no transfers between players, no conversion to SOL or tokens.

## Anti-abuse

* Rate limits per IP and per wallet on every write endpoint.
* Crates can only be opened next to the crate (server checks the last reported position).
* Ranked runs are generated and scored on the server; answers never reach the browser before submission.
* Invite joins count once per browser, never for the inviter's own network, only for new players, with daily and weekly caps.
* Megaphone text is filtered (no links) and globally rate limited.
