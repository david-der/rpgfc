// Generate per-player sketch art via Gemini 2.5 Flash Image.
//
// Usage:
//   GEMINI_API_KEY=... pnpm gen-art [--db saves/playtest.db]
//                                   [--only=1,2,3]
//                                   [--force]
//                                   [--dry-run]
//                                   [--limit=N]
//                                   [--concurrency=N]
//
// Output: packages/web/public/player-art/{playerId}.png
//
// The PlayerCard + PlayerAvatar components already pick these up via
// the /player-art/{id}.png convention; no code change needed once a
// file lands.
//
// Cost note: ~$0.039 per image at the Gemini paid tier as of 2025-04.
// 200 players ≈ $8. Free-tier rate limits exist; the script throttles
// itself and retries 429s.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ARCHETYPE_BY_ID } from "@rpgfc/shared";
import Database from "better-sqlite3";

// ── style anchor ─────────────────────────────────────────────────────────
//
// Load-bearing. The problem: the default phrasing ("sports editorial
// illustration") was letting the model drift into polished digital
// comic-book looks — uniform line weights, symmetrically rendered
// faces, smooth gradient shading. We want the opposite: raw, rough,
// imperfect, visibly hand-done.
//
// Two levers:
//   1. POSITIVE language ("live sketch done in the stands", "visible
//      pencil strokes", "uneven line weight", "negative space used")
//   2. NEGATIVE examples — explicitly forbid the stuff the model
//      keeps producing (clean digital, comic, anime, airbrush, glossy
//      vector). Naming specific anti-references is much more effective
//      than positive adjectives alone.

const STYLE_ANCHOR = `A raw, gritty charcoal portrait drawing of a
fully-clothed footballer in match kit. High-contrast chiaroscuro
lighting. Rough-edged, observational draftsmanship with visible
charcoal dust and paper grain. Square 1:1 frame.

KIT — NON-NEGOTIABLE:
- The player is wearing an OPAQUE, solid, fully-rendered football
  shirt and shorts. Fabric is cloth — it has folds, wrinkles, and
  drape. It hides the torso.
- ABSOLUTELY NO transparent, see-through, translucent, wet, or
  clinging-to-skin fabric. No visible abs, pecs, nipples, or navel
  through the shirt. No anatomical muscle definition rendered beneath
  the kit.
- This is NOT an anatomical écorché study, NOT a bodybuilding
  reference, NOT an underwear shoot, NOT a shirtless figure drawing.
- The shirt is made of OPAQUE fabric. Render the shirt's surface
  (folds, shadows, wrinkles) — not what is under it.

IMPORTANT — ARTISTIC TECHNIQUE:
- Shape the figure with VOLUME AND LIGHT, not with closed outlines.
  Forms emerge from shadow, not from line.
- Heavy cross-hatching and smudged charcoal gradients build the mass.
  Hatch density varies aggressively across the figure.
- Uneven line pressure. Some strokes confident and heavy, others faint
  and tentative. Visible pencil or charcoal strokes throughout.
- Lines do not always meet. Contours break. Some areas are fully
  rendered, others barely suggested.
- Occasional scratched-out correction marks, fingerprint smudges,
  eraser ghosts, or pencil guide-lines still visible beneath ink.
- Negative space is part of the composition — large zones deliberately
  left unrendered.

FACE & PROPORTIONS:
- Realistic adult athletic proportions. No "big-head" caricature. No
  stylised childlike proportions.
- Rugged masculine bone structure. Weathered facial features.
  Shadowed, deep-set eye sockets. Heavy brow ridge. Adult nose and jaw.
- Eyes sit in the LOWER half of the skull, NOT large and high on the
  face. Eye size is realistic, not expressive-cartoon-large.
- The face is shaped by SHADOWS rather than by outlines. Asymmetric.
  Pores, stubble, a slightly crooked nose. Not a model portrait.

EXPLICITLY NOT THIS:
- No cel-shading, no clean vector lines, no expressive caricature.
- No oversized eyes. No smooth digital gradients.
- Not Disney/Pixar/DreamWorks/Illumination proportions.
- Not anime, manga, or Saturday-morning-cartoon style.
- Not comic-book line art with uniform stroke weights.
- Not a FIFA-cover illustration or marketing sports art.
- Not a polished magazine cover portrait.

REFERENCES (emulate these):
- Ralph Steadman's gestural ink work.
- Paul Hogarth's sports-page sketches.
- Mid-century editorial newspaper charcoal studies.
- Old Master portrait drawings (Sargent, Menzel) — clothed figures.
- Quick observational sketches done in 20 minutes or less.

Palette: strictly monochrome. Charcoal, conté, graphite, or ink wash on
toothed paper. No colour anywhere — not even muted accent colour.

ABSOLUTELY NO text, letters, numbers, logos, jersey numbers, sponsor
boards, scoreboards, or scoreboard banners anywhere in the image.
Anonymous, generic kit. Composition must be varied — not a yearbook
headshot.`;

// ── Axis 1: FRAMING ──────────────────────────────────────────────────────
// How far away the camera is. Most visible source of variety.

const FRAMINGS: Weighted<string>[] = [
  { weight: 1, value: "tight head-and-shoulders portrait, face dominates, chest-up" },
  { weight: 2, value: "waist-up medium shot, arms and torso visible, body language carries the frame" },
  { weight: 3, value: "full-body shot at medium distance, feet planted in frame, stadium visible behind" },
  { weight: 3, value: "wide action shot, subject fills about half the frame, room around them for environment" },
  { weight: 1, value: "extreme wide environmental shot, figure small in frame, pitch/stadium dominates" },
];

// ── Axis 2: COMPOSITION ──────────────────────────────────────────────────
// How many figures, how they relate.

const COMPOSITIONS: Weighted<string>[] = [
  { weight: 5, value: "single focal figure alone in frame" },
  { weight: 3, value: "two players contesting the ball shoulder-to-shoulder, the focal player foregrounded, the opponent anonymous and partly cropped" },
  { weight: 2, value: "focal player with an anonymous teammate just behind or beside, shared moment" },
  { weight: 1, value: "focal player with the goalkeeper or defender reacting in the background" },
  { weight: 2, value: "figure against a sea of anonymous crowd silhouettes filling the frame behind" },
];

// ── Axis 3: MOMENT ───────────────────────────────────────────────────────
// What's actually happening. Archetype biases this slightly below.

const MOMENTS: Moment[] = [
  { key: "stoic-before-kickoff", tag: "any", prompt: "stoic portrait, looking off-camera, hands by sides, before kickoff" },
  { key: "scanning-pitch", tag: "any", prompt: "scanning the pitch with hands on hips, jaw set, catching breath" },
  { key: "mid-sprint", tag: "outfield", prompt: "mid-sprint in open play, one leg extended, ball at feet, hair pushed back by the run" },
  { key: "striking-ball", tag: "attacker", prompt: "striking the ball with the instep mid-swing, long follow-through" },
  { key: "heading", tag: "attacker-def", prompt: "rising to head the ball, airborne, eyes on the ball, chest forward" },
  { key: "sliding-tackle", tag: "defender", prompt: "sliding tackle, one leg extended, grass spraying, ball just at the boot" },
  { key: "diving-save", tag: "gk", prompt: "goalkeeper diving horizontally, fingertips on the ball, body fully extended" },
  { key: "catching-cross", tag: "gk", prompt: "goalkeeper catching a cross at the peak of a jump, arms fully extended above the head" },
  { key: "celebrating-knees", tag: "any", prompt: "celebrating a goal, knees on the turf, arms raised, head back" },
  { key: "celebrating-run", tag: "any", prompt: "sprinting towards the corner flag in celebration, arms spread wide" },
  { key: "collapse-exhaustion", tag: "any", prompt: "collapsing in exhaustion after the final whistle, on the ground on elbows and knees" },
  { key: "arguing-ref", tag: "any", prompt: "arguing with an unseen referee, finger pointed, face twisted in disbelief" },
  { key: "walking-tunnel", tag: "any", prompt: "walking out of the tunnel, focused expression, hand trailing along the wall" },
  { key: "locker-room", tag: "any", prompt: "in the locker room post-match, shirt partly off, head bowed over a bench" },
  { key: "sideline-water", tag: "any", prompt: "at the sideline, drinking from a water bottle, tracksuit on" },
  { key: "sideline-warmup", tag: "any", prompt: "warming up on the touchline, pulling on a training top, half-turned to face the pitch" },
  { key: "pointing-teammate", tag: "any", prompt: "pointing decisively at a teammate just out of frame, organising a set piece" },
  { key: "chest-bump", tag: "any", prompt: "bumping chests with a teammate after a goal, both airborne" },
  { key: "alone-after-whistle", tag: "any", prompt: "standing alone on the pitch after the final whistle, shoulders slightly slumped, fans blurred behind" },
  { key: "free-kick-prep", tag: "any", prompt: "standing over the ball at a free kick, hands on hips, measuring the distance" },
];

// ── Axis 4: ANGLE ────────────────────────────────────────────────────────

const ANGLES: Weighted<string>[] = [
  { weight: 3, value: "eye-level perspective" },
  { weight: 2, value: "low heroic angle shot from pitch level looking up" },
  { weight: 2, value: "three-quarter over-shoulder perspective, figure partly turned away" },
  { weight: 1, value: "strict profile perspective, figure side-on" },
  { weight: 1, value: "slightly elevated perspective, looking down at the player" },
];

// ── Axis 5: SCENE ────────────────────────────────────────────────────────
// Where are we. Default anchor already says "stadium"; this layer
// makes every tenth player feel like a different chapter.

const SCENES: Weighted<string>[] = [
  { weight: 3, value: "stadium packed with anonymous crowd silhouettes" },
  { weight: 2, value: "stadium crowd at dusk, floodlights bleeding across the sky" },
  { weight: 2, value: "rain-soaked pitch at night under floodlights, raindrops streaking the frame" },
  { weight: 1, value: "empty training pitch at dawn, mist on the grass" },
  { weight: 1, value: "players' tunnel with tiled walls, harsh lighting" },
  { weight: 1, value: "locker room with hanging kit and benches" },
  { weight: 1, value: "snow dusting the touchline, breath visible" },
  { weight: 1, value: "golden-hour sunset behind the stands, long shadows on the pitch" },
];

// ── Axis 6: MEDIUM ───────────────────────────────────────────────────────
// The drawing-tool feel. Keeps the roster consistent (all drawings) but
// the individual pieces feel hand-crafted rather than filter-stamped.

const MEDIA: Weighted<string>[] = [
  {
    weight: 5,
    value:
      "rough charcoal and conté crayon on heavy-toothed gray paper, heavy smudged shading, paper grain visible through the strokes, fingerprint marks and scuffs",
  },
  {
    weight: 5,
    value:
      "technical graphite rendering with visible pencil lead texture, eraser smudges, uneven pressure, incomplete linework, rough gestural quality",
  },
  {
    weight: 3,
    value:
      "scratchy pen-and-ink drawing, uneven line weight, irregular cross-hatching, some lines bold and confident others faint, aggressive negative space",
  },
  {
    weight: 2,
    value:
      "mixed media — graphite under-drawing with scratchy ink outlines on top, pencil guide-lines still visible beneath the ink",
  },
  {
    weight: 2,
    value:
      "Old Master ink wash study with gritty textures, washes bleeding into the paper, dry-brush edges, visible paper tooth",
  },
];

// ── Axis 7: MOOD ─────────────────────────────────────────────────────────
// Emotional register the illustrator should lean into.

const MOODS: Weighted<string>[] = [
  { weight: 3, value: "determined and focused" },
  { weight: 2, value: "calm, quietly confident" },
  { weight: 2, value: "exhausted and ragged, spent from the effort" },
  { weight: 2, value: "joyful, eyes bright with the moment" },
  { weight: 1, value: "furious, jaw clenched, vein at the temple" },
  { weight: 2, value: "contemplative, the weight of the season on him" },
  { weight: 1, value: "playful, half-smirk, eyes sparkling" },
];

// ── Weighted picker ──────────────────────────────────────────────────────

interface Weighted<T> { weight: number; value: T; }

interface Moment {
  key: string;
  /** "any" | "outfield" | "attacker" | "attacker-def" | "defender" | "gk"
   *  — simple tag gate. Archetype matching runs below. */
  tag: string;
  prompt: string;
}

function pickWeighted<T>(rand: () => number, items: Weighted<T>[]): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = rand() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.value;
  }
  return items[items.length - 1]!.value;
}

// ── descriptor builders ──────────────────────────────────────────────────

interface PlayerRow {
  id: number;
  name: string;
  age: number;
  nationality: string;
  preferred_foot: string;
  archetype_id: string;
  experience_years: number;
}

/** Deterministic small RNG seeded by player id — used to vary
 *  hair / beard / build without changing across re-runs. */
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

/** Match a player's archetype to the moment tags they should draw from. */
function tagsForRole(role: string): string[] {
  if (role === "Goalkeeper") return ["any", "gk"];
  if (role === "Center-Back" || role === "Fullback") {
    return ["any", "outfield", "defender", "attacker-def"];
  }
  if (role === "Defensive Midfielder") {
    return ["any", "outfield", "defender"];
  }
  if (
    role === "Striker" ||
    role === "Winger" ||
    role === "Attacking Midfielder"
  ) {
    return ["any", "outfield", "attacker", "attacker-def"];
  }
  return ["any", "outfield"];
}

const HAIR_STYLES = [
  "short cropped hair",
  "shaggy mid-length hair",
  "buzz cut",
  "shoulder-length hair tied back",
  "tight curls",
  "longer curly hair",
  "thinning, swept back",
  "shaved head",
  "slicked-back undercut",
] as const;

const FACIAL_HAIR = [
  "clean shaven",
  "stubble",
  "short beard",
  "full beard",
  "moustache",
  "patchy stubble",
  "neatly trimmed goatee",
] as const;

function buildDescriptor(p: PlayerRow): string {
  const r = rng(p.id);
  const archetype = ARCHETYPE_BY_ID[p.archetype_id];
  const archetypeName = archetype?.displayName ?? "footballer";

  // Build qualifier — anchors physiognomy and bearing without going
  // anywhere near rating/skill language.
  const ageBand =
    p.age <= 19
      ? "lean and sinewy, jaw still angular, deep-set eyes under a pronounced brow"
      : p.age <= 25
        ? "in his early twenties, athletic and rugged, shadowed eye sockets, masculine bone structure"
        : p.age <= 30
          ? "in his prime, body honed by years of football, heavy brow ridge, weathered facial features"
          : p.age <= 34
            ? "weathered by years of competition, a few scars on the face, deep lines across the forehead, sunken eyes"
            : "veteran, deeply lined face, gray streaks at the temples, hollow cheeks, eyes that have seen everything";

  // Position-shape hint (wide tall vs lean wiry vs solid stocky).
  const role = archetype?.primaryRole ?? "Central Midfielder";
  const build =
    role === "Goalkeeper"
      ? "tall and long-limbed"
      : role === "Center-Back"
        ? "broad-shouldered and physically imposing"
        : role === "Striker"
          ? "athletic, lean and powerful"
          : role === "Winger" || role === "Attacking Midfielder"
            ? "wiry and quick-footed"
            : role === "Defensive Midfielder" || role === "Central Midfielder"
              ? "compact and athletic"
              : "athletic build";

  const hair = pick(r, HAIR_STYLES);
  const facialHair = pick(r, FACIAL_HAIR);
  const foot = p.preferred_foot === "Left" ? "left-footed" : "right-footed";

  // Capitalise the age-band so it reads as a proper sentence opener.
  const opener = ageBand.charAt(0).toUpperCase() + ageBand.slice(1);
  return [
    `${opener}.`,
    `Position: ${archetypeName}.`,
    `Build: ${build}.`,
    `${hair}, ${facialHair}.`,
    `${foot}.`,
  ].join(" ");
}

interface PromptMix {
  framing: string;
  composition: string;
  moment: Moment;
  angle: string;
  scene: string;
  medium: string;
  mood: string;
}

/** Moments that only make sense as a solo figure in the frame —
 *  a sideline water-break with "two players tussling for the ball" is
 *  an incoherent prompt. Narrow the composition when one of these
 *  gets picked. */
const SOLO_FORCE_MOMENTS = new Set([
  "stoic-before-kickoff",
  "sideline-water",
  "sideline-warmup",
  "walking-tunnel",
  "locker-room",
  "arguing-ref",
  "free-kick-prep",
  "alone-after-whistle",
]);

/** Moments where the scene context is already specified by the moment
 *  itself (locker room, tunnel). Override the scene to stay coherent. */
const SCENE_OVERRIDES: Record<string, string> = {
  "walking-tunnel": "players' tunnel with tiled walls, harsh lighting",
  "locker-room": "locker room with hanging kit and benches",
  "sideline-water": "stadium touchline, the pitch visible behind",
  "sideline-warmup": "stadium touchline, the pitch visible behind",
};

function pickMix(p: PlayerRow): PromptMix {
  // Distinct streams so changes to one axis don't shift the others.
  const axis = (tag: string) => rng((p.id * 0x9e37) ^ hashStr(tag));
  const archetype = ARCHETYPE_BY_ID[p.archetype_id];
  const role = archetype?.primaryRole ?? "Central Midfielder";
  const tags = new Set(tagsForRole(role));
  const eligibleMoments = MOMENTS.filter((m) => tags.has(m.tag));
  const moment = pick(axis("moment"), eligibleMoments);

  let composition = pickWeighted(axis("composition"), COMPOSITIONS);
  if (SOLO_FORCE_MOMENTS.has(moment.key)) {
    composition = "single focal figure alone in frame";
  }

  const defaultScene = pickWeighted(axis("scene"), SCENES);
  const scene = SCENE_OVERRIDES[moment.key] ?? defaultScene;

  return {
    framing: pickWeighted(axis("framing"), FRAMINGS),
    composition,
    moment,
    angle: pickWeighted(axis("angle"), ANGLES),
    scene,
    medium: pickWeighted(axis("medium"), MEDIA),
    mood: pickWeighted(axis("mood"), MOODS),
  };
}

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildPrompt(p: PlayerRow): string {
  const mix = pickMix(p);

  const joyful = /joyful|playful/.test(mix.mood);
  const moodGuard = joyful
    ? " Keep the expression raw, unpolished, and gestural — do NOT clean up the face into a cartoon smile; keep the rugged anatomy intact."
    : "";

  const sprinting = /sprint|mid-sprint|striking|heading|sliding|diving|chest-bump|celebrating-run/.test(
    mix.moment.key + " " + mix.moment.prompt,
  );
  const motionGuard = sprinting
    ? " Convey motion through smudged charcoal edges and ghosted contour lines, NOT through cartoon speed-lines."
    : "";

  return [
    STYLE_ANCHOR,
    "",
    `MEDIUM: ${mix.medium}.`,
    `FRAMING: ${mix.framing}.`,
    `COMPOSITION: ${mix.composition}.`,
    `ANGLE: ${mix.angle}.`,
    `SCENE: ${mix.scene}.`,
    `MOMENT: ${mix.moment.prompt}.${motionGuard}`,
    `MOOD: ${mix.mood}.${moodGuard}`,
    "",
    `SUBJECT: ${buildDescriptor(p)}`,
    "",
    `Remember: absolutely no visible text, letters, numbers, or logos anywhere in the image.`,
  ].join("\n");
}

// ── Gemini call ──────────────────────────────────────────────────────────

const MODEL = process.env["GEMINI_IMAGE_MODEL"] ?? "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { code?: number; message?: string; status?: string };
}

async function generateOne(prompt: string, apiKey: string): Promise<Buffer> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status === 503) {
      // Surface the server's actual reason — distinguishes per-minute
      // throttle ("Quota exceeded for quota metric 'Generate Content
      // requests' …") from per-day exhaustion ("ResourceExhausted …
      // image generation requests per day"). Different remedies.
      if (attempt > 4) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 360)}`);
      }
      const wait = 2000 * attempt;
      console.error(`  ${res.status} — backing off ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
    }
    const json = (await res.json()) as GeminiResponse;
    if (json.error) throw new Error(json.error.message ?? "Gemini error");
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData ?? part.inline_data;
      if (inline?.data) return Buffer.from(inline.data, "base64");
    }
    throw new Error("No image in response");
  }
}

// ── orchestration ────────────────────────────────────────────────────────

interface Args {
  dbPath: string;
  only: Set<number> | null;
  force: boolean;
  dryRun: boolean;
  limit: number | null;
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    dbPath: "saves/playtest.db",
    only: null,
    force: false,
    dryRun: false,
    limit: null,
    concurrency: 3,
  };
  // Accept both `--flag=value` and `--flag value` (space-separated).
  // Earlier version only handled the `=` form, which silently ignored
  // `--limit 5` and ran the full roster.
  const valueOf = (i: number, name: string): string | null => {
    const a = argv[i]!;
    if (a.startsWith(`${name}=`)) return a.slice(name.length + 1);
    if (a === name) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) return next;
    }
    return null;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--force") out.force = true;
    else if (arg === "--dry-run") out.dryRun = true;
    const db = valueOf(i, "--db");
    if (db !== null) {
      out.dbPath = db;
      if (arg === "--db") i += 1;
      continue;
    }
    const only = valueOf(i, "--only");
    if (only !== null) {
      out.only = new Set(
        only.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)),
      );
      if (arg === "--only") i += 1;
      continue;
    }
    const limit = valueOf(i, "--limit");
    if (limit !== null) {
      out.limit = Number(limit);
      if (arg === "--limit") i += 1;
      continue;
    }
    const conc = valueOf(i, "--concurrency");
    if (conc !== null) {
      out.concurrency = Number(conc);
      if (arg === "--concurrency") i += 1;
      continue;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../../../..");
  const dbPath = resolve(repoRoot, args.dbPath);
  const outDir = resolve(repoRoot, "packages/web/public/player-art");
  mkdirSync(outDir, { recursive: true });

  if (!existsSync(dbPath)) {
    console.error(`No save DB at ${dbPath}. Pass --db <path>.`);
    process.exit(1);
  }
  // Load .env.local at the project root so GEMINI_API_KEY can live
  // there alongside DATABASE_URL etc. Done before the key check so the
  // file actually beats the environment.
  const envPath = resolve(repoRoot, ".env.local");
  if (existsSync(envPath) && !process.env["GEMINI_API_KEY"]) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^GEMINI_API_KEY=(.+)$/);
      if (m) process.env["GEMINI_API_KEY"] = m[1]!.trim();
    }
  }
  const key = process.env["GEMINI_API_KEY"] ?? "";
  if (!key && !args.dryRun) {
    console.error("Set GEMINI_API_KEY in your environment or .env.local at the repo root.");
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });
  const players = db
    .prepare<[], PlayerRow>(
      `SELECT id, name, age, nationality, preferred_foot, archetype_id, experience_years
       FROM players
       WHERE club_id IS NOT NULL
       ORDER BY id`,
    )
    .all();
  db.close();

  let queue = players.filter((p) => !args.only || args.only.has(p.id));
  if (!args.force) {
    queue = queue.filter((p) => !existsSync(resolve(outDir, `${p.id}.png`)));
  }
  if (args.limit !== null) queue = queue.slice(0, args.limit);

  console.log(
    `🎨 ${queue.length} players to generate (out of ${players.length} contracted).`,
  );
  console.log(`   db:        ${dbPath}`);
  console.log(`   out:       ${outDir}`);
  console.log(`   model:     ${MODEL}`);
  console.log(`   parallel:  ${args.concurrency}`);
  if (args.dryRun) console.log(`   DRY RUN — printing 3 sample prompts:\n`);

  if (args.dryRun) {
    // Compact axis breakdown for the first 10 players, then 3 full
    // prompts. Makes it easy to eyeball the matrix without reading
    // hundreds of lines.
    console.log("── Axis breakdown (first 10) ──");
    for (const p of queue.slice(0, 10)) {
      const mix = pickMix(p);
      const archetype = ARCHETYPE_BY_ID[p.archetype_id];
      console.log(
        `#${String(p.id).padStart(3, " ")} ${p.name.padEnd(22)} · ${(archetype?.primaryRole ?? "?").padEnd(22)} ` +
          `· ${mix.medium.split(",")[0]} · ${mix.framing.split(",")[0]} · ${mix.moment.key}`,
      );
    }
    console.log();
    for (const p of queue.slice(0, 3)) {
      console.log(`── Player #${p.id}: ${p.name} — full prompt ──`);
      console.log(buildPrompt(p));
      console.log();
    }
    return;
  }

  // Concurrency-bounded fan-out with simple semaphore.
  let inFlight = 0;
  let okCount = 0;
  let failCount = 0;
  const results: Array<Promise<void>> = [];
  for (const p of queue) {
    while (inFlight >= args.concurrency) {
      await new Promise((r) => setTimeout(r, 60));
    }
    inFlight += 1;
    const task = (async () => {
      try {
        const png = await generateOne(buildPrompt(p), key);
        writeFileSync(resolve(outDir, `${p.id}.png`), png);
        okCount += 1;
        console.log(`✓ #${p.id} ${p.name} (${png.length.toLocaleString()} bytes)`);
      } catch (e) {
        failCount += 1;
        console.error(`✗ #${p.id} ${p.name}: ${(e as Error).message}`);
      } finally {
        inFlight -= 1;
      }
    })();
    results.push(task);
    // Light stagger so we don't burst at start.
    await new Promise((r) => setTimeout(r, 200));
  }
  await Promise.all(results);

  console.log(`\nDone — ${okCount} ok, ${failCount} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
