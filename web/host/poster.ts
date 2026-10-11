import type { Choices, Results, Role, Round, Scene } from "../../shared/contracts";

export type PosterInput = {
  scene: Scene;
  round: Round;
  results: Results;
  choices: Choices;
  nickOf: (uid: string) => string;
};

const W = 1080;
const H = 1350;
const fmt = (x: number | null | undefined) => (x == null ? "–" : x.toFixed(1));

/** Snapshot is a cross-origin Storage URL: needs CORS, else the canvas taints. Any failure → null → plain background. */
function loadImage(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => {
      console.warn("poster: snapshot failed to load (bucket CORS? see cors.json)", url);
      res(null);
    };
    img.src = url;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  let line = "";
  for (const word of text.split(" ")) {
    const t = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(t).width > maxW) {
      ctx.fillText(line, x, y);
      y += lineH;
      line = word;
    } else line = t;
  }
  ctx.fillText(line, x, y);
  return y + lineH;
}

/** Draws the poster and returns a PNG blob; falls back to no snapshot if the image taints the canvas. */
export async function makePoster(i: PosterInput): Promise<Blob> {
  const img = await loadImage(i.results.snapshotUrl);
  try {
    return await draw(i, img);
  } catch {
    return draw(i, null);
  }
}

function draw(i: PosterInput, img: HTMLImageElement | null): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#14142b");
  g.addColorStop(1, "#2b1b3d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Artwork: 16:9 snapshot, or a quiet placeholder frame.
  const ay = 360;
  const ah = Math.round(((W - 120) * 9) / 16);
  if (img) ctx.drawImage(img, 60, ay, W - 120, ah);
  else {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(60, ay, W - 120, ah);
  }

  // Flock flourish (art direction): faint seeded dots, no Math.random.
  let s = i.round.seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  for (let n = 0; n < 50; n++) {
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, 2 + rnd() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 72px sans-serif";
  ctx.fillText(i.scene.title, 60, 120);
  ctx.font = "italic 36px sans-serif";
  wrap(ctx, `“${i.round.promptText ?? ""}”`, 60, 190, W - 120, 46);

  let y = ay + ah + 70;
  const scores: [string, number | null | undefined][] = [
    ["Author", i.results.author?.score], ["AI", i.results.ai?.score], ["Audience", i.results.audience?.score], ["Combined", i.results.combined],
  ];
  scores.forEach(([name, v], k) => {
    const x = 60 + k * 250;
    ctx.font = "26px sans-serif";
    ctx.fillText(name, x, y);
    ctx.font = "bold 56px sans-serif";
    ctx.fillText(fmt(v), x, y + 62);
  });

  y += 140;
  ctx.font = "28px sans-serif";
  for (const role of ["palette", "form", "motion"] as Role[]) {
    const ch = i.choices[role];
    if (!ch) continue;
    const label = i.scene.options[role].find((o) => o.id === ch.optionId)?.label ?? ch.optionId;
    ctx.fillText(`${i.nickOf(ch.uid)} · ${role} · ${label}`, 60, y);
    y += 42;
  }

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
}

/** Cross-origin `download` is ignored by browsers, so fetch to a blob (needs bucket CORS); otherwise open the image in a tab. */
export async function downloadUrl(url: string, name: string) {
  try {
    downloadBlob(await (await fetch(url)).blob(), name);
  } catch {
    window.open(url, "_blank");
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
