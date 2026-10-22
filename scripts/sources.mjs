/** Load order matters: later files use globals declared by earlier ones. Two files are shared with the Worker. */
export const CLIENT_SOURCES = [
  'client/src/00-core.js',          // renderer, scene, post-processing, base strings, helpers
  'client/src/01-i18n.js',          // translations: English, Chinese, Japanese, Korean, Spanish
  'client/src/02-characters.js',    // block characters, the character editor's parts
  'client/src/03-world.js',         // the cafe room, desks, the town and its places
  'client/src/04-world-details.js', // extra props, machines, big screen, cars, trees
  'client/src/05-easter-eggs.js',   // the 36 Solana story cards hidden around town
  'client/src/06-game.js',          // avatars, player movement, camera, proximity, NPCs
  'client/src/07-ui.js',            // landing, character select, panels, launch wizard, world screens
  'client/src/08-minigames.js',     // free arcade mini-games
  'client/src/09-casino.js',        // chips casino (play currency only)
  'src/arcade-games.js',            // ranked arcade rules, shared with the server
  'client/src/10-arcade.js',        // ranked arcade client
  'src/hunt-data.js',               // daily crate spots, shared with the server
  'client/src/11-hunt.js',          // crates, candles, rewards
  'client/src/12-league.js',        // the weekly Trench League
  'client/src/13-net.js',           // multiplayer socket, wallet sign-in, payments
  'client/src/14-shop.js',          // cosmetics shop
  'client/src/15-hud.js',           // level, XP, minimap, hotbar, card album
  'client/src/16-social.js',        // bartender, music, invite pass, share to X, weekly board
  'client/src/17-bank.js'           // chip bank: streak, daily tasks, things to spend chips on
];
