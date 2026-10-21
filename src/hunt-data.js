/* ================= HUNTS: one file for the server and the browser =================
   Daily crates: a few chip crates hidden around town, new spots every day (UTC), the same for everyone.
   The server picks the spots with the same seed, so a crate can only be opened where it really stands. */
const CRATE_SPOTS = [[-6, 24], [8, 28], [-20, 42], [18, 40], [-30, 30], [30, 42], [0, 46], [-20, 58], [22, 56], [38, 48], [-38, 52], [6, 66], [-14, 66], [34, 64], [-40, 47], [44, 36], [-8, 68], [26, 30]];
const HUNT = { daily: 4, crate: 25, egg: 20, candles: 250, maxEggs: 64 };   // chips per crate, per story found, for the full candle hunt
function huntDay(ts = Date.now()) { return new Date(ts).toISOString().slice(0, 10); }
function huntSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dailyCrates(day) {
  let s = huntSeed('crates:' + day);
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pool = CRATE_SPOTS.map((_, i) => i), out = [];
  while (out.length < HUNT.daily && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out.sort((a, b) => a - b);
}
export { CRATE_SPOTS, HUNT, huntDay, dailyCrates };
