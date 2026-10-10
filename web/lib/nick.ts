import { NICK_MAX } from "../../shared/contracts";

// ponytail: tiny substring blocklist; upgrade to a real list if it matters. Host can also rename (DATA_SCHEMA §3).
const BLOCKED = ["fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "slut", "whore", "nigg", "fag", "rape", "nazi", "hitler"];

/** Trim, cap length, and fall back to Guest-xxxx when blank or blocked. */
export function cleanNick(raw: string, uid: string): string {
  const nick = raw.trim().replace(/\s+/g, " ").slice(0, NICK_MAX);
  const squashed = nick.toLowerCase().replace(/[^a-z]/g, "");
  return nick && !BLOCKED.some((w) => squashed.includes(w)) ? nick : `Guest-${uid.slice(0, 4)}`;
}
