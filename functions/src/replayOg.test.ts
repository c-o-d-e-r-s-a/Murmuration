// Self-check for the replay OG page: npx tsx functions/src/replayOg.test.ts
import assert from "node:assert/strict";
import {isBot, ogHtml} from "./replayOg";

assert.ok(isBot("Twitterbot/1.0"));
assert.ok(isBot("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"));
assert.ok(isBot("facebookexternalhit/1.1 Facebot Twitterbot/1.0"));
assert.ok(isBot("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"));
assert.ok(isBot("WhatsApp/2.23.20.0"));
assert.ok(!isBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"));

const full = ogHtml({title: `Rush "hour" — <b>&</b>`, description: "d", url: "https://x/replay/ABCD/r1", image: "https://img?a=1&token=t"});
assert.match(full, /<meta property="og:title" content="Rush &#34;hour&#34; — &#60;b&#62;&#38;&#60;\/b&#62;">/);
assert.match(full, /<meta property="og:image" content="https:\/\/img\?a=1&#38;token=t">/);
assert.match(full, /<meta name="twitter:card" content="summary_large_image">/);
assert.match(full, /<meta property="og:url" content="https:\/\/x\/replay\/ABCD\/r1">/);
const bare = ogHtml({title: "T", description: "d", url: "u"});
assert.doesNotMatch(bare, /og:image/);
assert.match(bare, /twitter:card" content="summary"/);
console.log("replayOg self-check ok");
