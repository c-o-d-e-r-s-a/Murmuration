// Canned verdicts (judge-script skill): 3 per demo scene, generic (they cannot know the chosen options).
// Index n is also the Storage clip `fallback/{sceneId}/{n}.mp3`, so text and audio stay in step.
export type Canned = {comment: string; script: string};

export const CANNED: Record<string, Canned[]> = {
  "rush-hour": [
    {
      comment: "Stuck in traffic, but the mood is moving.",
      script: "Our judge is stuck in traffic, so here is the verdict from the shoulder. This highway has not moved in ninety seconds and it still feels like it is going somewhere. The light does honest work here. Honestly, it is the most progress anyone has made on this road all year. Moody, solid, and nobody honked.",
    },
    {
      comment: "Rush hour, but make it a gallery.",
      script: "The judge missed the exit, so the verdict comes from the passenger seat. Bumper to bumper has never looked this composed. Every lane agrees on a direction, which is rare, even on canvas. The brake lights carry the whole mood and they know it. Slow commute, fast verdict, and it earns the fast lane.",
    },
    {
      comment: "A commute worth being late for.",
      script: "Our judge is on hold with the toll booth, so the house will take it from here. This is a road that says you will get there eventually, and you will enjoy the view. The glow on the horizon is doing most of the heavy lifting. Somebody in the back row will want a print. Merge carefully, because this one is good.",
    },
  ],
  "diner": [
    {
      comment: "Warm light, dark lot, burnt coffee. It works.",
      script: "The judge clocked out, so the night shift is covering. This diner glows like the only open door for fifty miles, and warm light against a dark lot always lands. The coffee is probably burnt, but the composition is not. Pull up a stool, because this one earned a refill and a decent tip.",
    },
    {
      comment: "Midnight pie energy, well plated.",
      script: "The judge is stuck in the back booth, so the verdict is coming from the counter. That glow through the window says breakfast at midnight is a perfectly fine life choice. The whole scene hums like a fridge in an empty kitchen, and somehow that is a compliment. Order the pie. The picture already did.",
    },
    {
      comment: "Cozy and a little lonely. Good combo.",
      script: "Our judge went out for a refill and never came back, so I will say it. This place feels like three in the morning and nowhere better to be. The neon does the talking and the shadows keep the secrets. Is the waitress hiding something? Probably just the good pie. Eleven out of ten stools, in my opinion.",
    },
  ],
  "vigilante": [
    {
      comment: "Brooding silhouette, clear read from the back row.",
      script: "Our judge has gone dark, which honestly suits this piece. A lone caped figure over a skyline is a classic for a reason, and the silhouette reads clearly from the back row. Is it brooding or just waiting for a rideshare? Hard to say. Either way, the city looks like it needs saving, and it looks good.",
    },
    {
      comment: "The rooftop has a strong point of view.",
      script: "The judge is on a rooftop somewhere, refusing to comment, so I will do it. A shadow against a skyline does a lot with very little. The city lights say trouble, and the stance says not tonight. Dramatic? Yes. Necessary? Also yes. This piece understands that standing very still can be louder than any speech.",
    },
    {
      comment: "Big night-city energy, cleanly staged.",
      script: "Our judge is brooding in a stairwell, so the verdict comes from street level. This city looks like it has not slept in years, and the figure above it looks like it has been awake even longer. The contrast is sharp, the mood is heavy, and the skyline gets a proper entrance. Dark, dramatic, and delivered right on time.",
    },
  ],
  "default": [
    {
      comment: "The judge is offline, but the room is not.",
      script: "Our judge stepped out, so the verdict is coming from the house. Three people, three dials, ninety seconds, and the piece still holds together, which is more than most group projects manage. The colors and the motion agree with each other. Nobody asked for a masterpiece, and this one quietly showed up anyway.",
    },
  ],
};
