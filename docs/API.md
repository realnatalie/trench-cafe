# HTTP and WebSocket API

All endpoints are served by the `Cafe` Durable Object. `token` is the session token returned by `/api/login`; it can be sent in the JSON body or as `?token=`.

## Room

| Method | Path | |
|---|---|---|
| GET | `/ws` | WebSocket upgrade |
| GET | `/api/health` | `{ ok, live, online, agents }` |
| GET | `/api/agents` | coins launched here |
| GET/POST | `/api/photo[/id]` | face photos for custom characters |

### WebSocket

Client → server: `hello` (character, nick, look), `p` (position), `say`, `emote`.

Server → client: `welcome`, `online`, `ps` (players), `leave`, `say`, `emote`, `launch`, `confirmed`, `tx`, `px`, `ohlc`, `sol`, `boost`, `plate`, `chips`, `league`, `backed`, `champion`, `arcade`, `shout`.

## Wallet

| Method | Path | |
|---|---|---|
| GET | `/api/nonce` | a one-time nonce |
| POST | `/api/login` | `{ wallet, nonce, sig }` → `{ token, profile }` |
| GET | `/api/me` | the signed-in profile |
| POST | `/api/profile` | save nick, character, look |

## Launches and promotion

| Method | Path | |
|---|---|---|
| POST | `/api/launch` | create a coin after the fee transfer |
| GET | `/api/launch-status?sig=` | state of a paid launch |
| POST | `/api/boost` | big-screen boost paid in SOL |
| POST | `/api/plate` | desk name plate paid in SOL |
| POST | `/api/vip` | VIP pass |
| POST | `/api/trade` | build a buy/sell transaction for Phantom |

## Shop and chips casino

| Method | Path | |
|---|---|---|
| GET | `/api/items` | owned cosmetics |
| POST | `/api/quote`, `/api/buy` | buy a cosmetic (SOL, token or chips) |
| GET | `/api/casino/info` | balance, limits, packs |
| POST | `/api/casino/quote`, `/api/casino/buy` | chip packs |
| POST | `/api/casino/slots`, `/api/casino/flip` | slots, high-low |
| POST | `/api/casino/crash/start`, `/crash/state`, `/crash/cashout` | crash |

## Chip bank

| Method | Path | Body | |
|---|---|---|---|
| GET | `/api/bank/info` | | balance, streak, tasks, prices, recent history |
| POST | `/api/bank/daily` | | claim today's streak reward |
| POST | `/api/bank/task` | `{ id: 'rk' \| 'lg' \| 'crate' }` | claim a finished daily task |
| POST | `/api/bank/boost` | `{ mint }` | boost paid in chips |
| POST | `/api/bank/plate` | `{ mint, text }` | desk plate paid in chips |
| POST | `/api/bank/shout` | `{ text }` | megaphone |
| POST | `/api/bank/espresso` | | 2× XP for an hour |

## Arcade, hunt, league, invites

| Method | Path | |
|---|---|---|
| GET | `/api/arcade/info`, `/api/arcade/top?game=&span=` | config, boards |
| POST | `/api/arcade/run`, `/api/arcade/go`, `/api/arcade/submit` | a ranked run |
| GET | `/api/hunt/state` | today's crates, found cards, candles |
| POST | `/api/hunt/crate`, `/api/hunt/egg`, `/api/hunt/candles` | rewards |
| GET | `/api/league` | standings, champions, rules |
| POST | `/api/league/back` | `{ mint, chips }` |
| POST | `/api/ref/me`, `/api/ref/join`, `/api/ref/collect` | invite pass |
| GET | `/api/ref/top` | this week's recruiters |
| GET | `/api/buyback` | buyback status: wallet, SOL spent, tokens bought and burned, latest buys |
