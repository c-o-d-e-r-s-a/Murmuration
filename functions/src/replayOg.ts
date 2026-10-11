import {getDatabase} from "firebase-admin/database";
import * as logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/https";
import type {Round} from "../../shared/contracts";
import {BUNDLED_SCENES} from "../../shared/sceneLoader";

// CONTRACTS §9 OG preview (P2): Hosting rewrites the share link /replay/{code}/{roundId} here (D-30).
// Link-preview crawlers get og/twitter meta from the archive; browsers are 302'd to the static app /replay/?s=&r=.
const PATH_RE = /^\/replay\/([A-HJ-NP-Z2-9]{4})\/(r\d{1,6})\/?$/;
const BOT_RE = /bot|crawler|spider|facebookexternalhit|slack|discord|whatsapp|telegram|linkedin|embedly|skype|pinterest|vkshare/i;

export const isBot = (ua: string) => BOT_RE.test(ua);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function ogHtml(o: {title: string; description: string; url: string; image?: string}) {
  const meta = [
    ["og:type", "website"], ["og:site_name", "Murmuration"], ["og:title", o.title], ["og:description", o.description], ["og:url", o.url],
    ...(o.image ? [["og:image", o.image], ["og:image:width", "1280"], ["og:image:height", "720"]] : []),
    ["twitter:card", o.image ? "summary_large_image" : "summary"], ["twitter:title", o.title], ["twitter:description", o.description],
    ...(o.image ? [["twitter:image", o.image]] : []),
  ].map(([k, v]) => `<meta ${k.startsWith("og:") ? "property" : "name"}="${k}" content="${esc(v)}">`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
${meta}
</head><body><a href="${esc(o.url)}">${esc(o.title)}</a></body></html>`;
}

export const replayOg = onRequest(async (req, res) => {
  const m = PATH_RE.exec(req.path);
  if (!m) return void res.redirect(302, "/replay/");
  const [, code, roundId] = m;
  const app = `/replay/?s=${code}&r=${roundId}`;
  if (!isBot(req.get("user-agent") ?? "")) return void res.redirect(302, app);

  const db = getDatabase();
  const base = `sessions/${code}/rounds/${roundId}`;
  const [round, snapshotUrl] = (await Promise.all([`${base}/round`, `${base}/results/snapshotUrl`].map((p) => db.ref(p).get())))
    .map((s) => s.val()) as [Round | null, string | null];
  if (!round) logger.info("replayOg: no archive", {code, roundId});
  const scene = BUNDLED_SCENES.find((s) => s.id === round?.sceneId);
  const title = [scene?.title ?? "Murmuration", round?.promptText].filter(Boolean).join(" — ");
  const host = req.get("x-forwarded-host") ?? req.get("host");
  res.set("Cache-Control", "public, max-age=300");
  res.status(200).type("html").send(ogHtml({
    title,
    description: "Replay a live, crowd-made artwork from Murmuration.",
    url: `https://${host}/replay/${code}/${roundId}`,
    image: typeof snapshotUrl === "string" ? snapshotUrl : undefined,
  }));
});
