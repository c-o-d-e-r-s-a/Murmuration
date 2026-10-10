import assert from "node:assert/strict";
import { cleanNick } from "./nick";

assert.equal(cleanNick("  Ada  ", "abcd1234"), "Ada");
assert.equal(cleanNick("", "abcd1234"), "Guest-abcd");
assert.equal(cleanNick("F u c k", "abcd1234"), "Guest-abcd");
assert.equal(cleanNick("x".repeat(40), "abcd1234").length, 16);
console.log("nick.test ok");
