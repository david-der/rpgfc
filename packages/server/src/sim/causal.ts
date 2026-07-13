import type {
  FormTier,
  MentalTraits,
  NaturalGifts,
  PlayingStyle,
  TeamInstruction,
} from "@rpgfc/shared";

import { mulberry32, type Random } from "../application/generation/rng.js";
import type {
  SimEvent,
  SimMatchInput,
  SimMatchResult,
  SimPerformance,
  SimPlayer,
  SimPlayerUpdate,
  SimSide,
} from "./interface.js";

export const CAUSAL_ENGINE_VERSION = "causal-v1";
// Applied per shot, so the win-rate edge it produces scales with chance
// volume — recalibrating scoring upward (2026-07-12) meant halving this
// to keep the cohort home edge inside the documented 1–10% band.
const HOME_FINISHING_EDGE = 0;

const DEFAULT_GIFTS: NaturalGifts = {
  pace: 55,
  finishing: 55,
  composure: 55,
  aerial: 55,
  tackling: 55,
  passing: 55,
  vision: 55,
  stamina: 55,
  strength: 55,
  reflexes: 55,
};

const DEFAULT_TRAITS: MentalTraits = {
  ambition: 55,
  leadership: 55,
  temperament: 55,
  workEthic: 55,
  sociability: 55,
  riskTolerance: 55,
  professionalism: 55,
};

interface Accumulator {
  player: SimPlayer;
  clubId: number;
  goals: number;
  assists: number;
  minutes: number;
  started: boolean;
  enteredMinute: number | null;
  leftMinute: number | null;
  shots: number;
  shotsOnTarget: number;
  xgX100: number;
  keyPasses: number;
  passesAttempted: number;
  passesCompleted: number;
  tacklesAttempted: number;
  tacklesWon: number;
  interceptions: number;
  clearances: number;
  aerialsWon: number;
  aerialsContested: number;
  dribblesCompleted: number;
  foulsCommitted: number;
  foulsDrawn: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  injuryMatches: number;
}

interface RuntimeSide {
  side: SimSide;
  active: SimPlayer[];
  bench: SimPlayer[];
  accumulators: Map<number, Accumulator>;
  subsUsed: number;
}

function gifts(player: SimPlayer): NaturalGifts {
  return player.gifts ?? DEFAULT_GIFTS;
}

function traits(player: SimPlayer): MentalTraits {
  return player.traits ?? DEFAULT_TRAITS;
}

function badge(player: SimPlayer, key: string): boolean {
  return player.badgeKeys?.includes(key) ?? false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function average(players: readonly SimPlayer[], score: (player: SimPlayer) => number): number {
  if (players.length === 0) return 0;
  return players.reduce((sum, player) => sum + score(player), 0) / players.length;
}

function weightedPick(
  rng: Random,
  players: readonly SimPlayer[],
  score: (player: SimPlayer) => number,
): SimPlayer {
  const weights = players.map((player) => Math.max(1, score(player)));
  return rng.weighted(players, weights);
}

function initAccumulator(player: SimPlayer, clubId: number, started: boolean): Accumulator {
  return {
    player,
    clubId,
    goals: 0,
    assists: 0,
    minutes: started ? 90 : 0,
    started,
    enteredMinute: started ? null : 60,
    leftMinute: null,
    shots: 0,
    shotsOnTarget: 0,
    xgX100: 0,
    keyPasses: 0,
    passesAttempted: 0,
    passesCompleted: 0,
    tacklesAttempted: 0,
    tacklesWon: 0,
    interceptions: 0,
    clearances: 0,
    aerialsWon: 0,
    aerialsContested: 0,
    dribblesCompleted: 0,
    foulsCommitted: 0,
    foulsDrawn: 0,
    saves: 0,
    yellowCards: 0,
    redCards: 0,
    injuryMatches: 0,
  };
}

function runtime(side: SimSide): RuntimeSide {
  const accumulators = new Map<number, Accumulator>();
  for (const starter of side.starters) {
    accumulators.set(starter.playerId, initAccumulator(starter, side.clubId, true));
  }
  return {
    side,
    active: [...side.starters],
    bench: [...(side.bench ?? [])],
    accumulators,
    subsUsed: 0,
  };
}

function intensity(
  style: PlayingStyle | undefined,
  instructions: readonly TeamInstruction[],
): number {
  let value = style === "High Press" ? 1.25 : 1;
  if (instructions.includes("PressHigh")) value += 0.15;
  if (instructions.includes("HighTempo")) value += 0.15;
  return value;
}

function pressurePenalty(input: SimMatchInput, player: SimPlayer): number {
  if (input.context?.pressure !== "RunIn") return 0;
  const resilience =
    (gifts(player).composure + traits(player).leadership + traits(player).temperament) / 3;
  return Math.max(0, (65 - resilience) / 18);
}

function makeEvent(events: SimEvent[], event: Omit<SimEvent, "sequence">): void {
  events.push({ ...event, sequence: events.length + 1 });
}

/** One fatigue substitution at most per call, decided per possession
 *  inside the 55'–85' window — sub minutes spread across real match
 *  time instead of a single 60' block. */
function maybeRotate(
  runtimeSide: RuntimeSide,
  minute: number,
  rng: Random,
  events: SimEvent[],
): void {
  if (runtimeSide.subsUsed >= 3) return;
  const candidates = [...runtimeSide.active]
    .filter((player) => (player.fatigue ?? 0) >= 70)
    .sort((a, b) => (b.fatigue ?? 0) - (a.fatigue ?? 0));
  if (candidates.length === 0) return;
  // Urgency scales with how many players are running on empty.
  if (!rng.chance(Math.min(0.3, 0.1 + candidates.length * 0.04))) return;

  for (const outgoing of candidates) {
    const benchIndex = runtimeSide.bench.findIndex(
      (candidate) => candidate.positionFamily === outgoing.positionFamily,
    );
    if (benchIndex < 0) continue;
    const incoming = runtimeSide.bench.splice(benchIndex, 1)[0]!;
    const activeIndex = runtimeSide.active.findIndex(
      (player) => player.playerId === outgoing.playerId,
    );
    if (activeIndex < 0) continue;
    runtimeSide.active[activeIndex] = incoming;
    runtimeSide.subsUsed += 1;

    const outgoingAcc = runtimeSide.accumulators.get(outgoing.playerId)!;
    outgoingAcc.minutes = minute;
    outgoingAcc.leftMinute = minute;
    const incomingAcc = initAccumulator(incoming, runtimeSide.side.clubId, false);
    incomingAcc.minutes = 90 - minute;
    incomingAcc.enteredMinute = minute;
    runtimeSide.accumulators.set(incoming.playerId, incomingAcc);
    makeEvent(events, {
      minute,
      kind: "Substitution",
      phase: "stoppage",
      clubId: runtimeSide.side.clubId,
      primaryPlayerId: incoming.playerId,
      secondaryPlayerId: outgoing.playerId,
      outcome: "rotation",
      evidence: ["FATIGUE_ROTATION"],
    });
    return;
  }
}

function pressesHigh(side: SimSide): boolean {
  return side.playingStyle === "High Press" || (side.instructions ?? []).includes("PressHigh");
}

function buildUpModifier(attacking: SimSide, defending: SimSide): number {
  const attackInstructions = attacking.instructions ?? [];
  const defendInstructions = defending.instructions ?? [];
  let modifier = 0;
  modifier -= Math.max(0, 100 - (attacking.familiarity ?? 100)) / 220;
  if (attacking.playingStyle === "Possession") modifier += 0.12;
  if (attackInstructions.includes("PlayOutFromTheBack")) {
    // Comfortable against a passive block, a liability into a press.
    modifier += pressesHigh(defending) ? -0.08 : 0.12;
  }
  if (attacking.playingStyle === "Balanced") modifier += 0.1;
  if (attacking.playingStyle === "Direct") modifier -= 0.1;
  // The break bypasses the press entirely — that is the point of the style.
  if (attacking.playingStyle === "Counter-Attack" && pressesHigh(defending)) modifier += 0.06;
  // Pressing style and the PressHigh instruction describe the same
  // behavior — they deepen, not stack, so two pressing identities can't
  // pin every match at the probability floor.
  if (pressesHigh(defending)) {
    modifier -=
      defending.playingStyle === "High Press" && defendInstructions.includes("PressHigh")
        ? 0.28
        : 0.2;
  }
  // A deep block gives up territory: progressing against it is easier,
  // the payoff comes at the chance/finish stage below.
  if (defendInstructions.includes("StayCompact")) modifier += 0.08;
  if (attacking.playingStyle === "Direct" && pressesHigh(defending)) {
    modifier += 0.28;
  }
  return modifier;
}

function chanceModifier(attacking: SimSide, defending: SimSide, creator: SimPlayer): number {
  const attackInstructions = attacking.instructions ?? [];
  const defendInstructions = defending.instructions ?? [];
  let modifier = 0;
  if (attacking.playingStyle === "Counter-Attack" && defendInstructions.includes("HighLine")) {
    modifier += 0.18;
    if (badge(creator, "lightning_quick")) modifier += 0.18;
  }
  // Surviving a high press leaves the presser stretched — build-ups that
  // do connect convert to chances more often, and counter-attackers are
  // built to exploit exactly that moment.
  if (pressesHigh(defending)) {
    modifier += 0.2;
    if (attacking.playingStyle === "Counter-Attack") modifier += 0.03;
  }
  // Style trade-offs: patient possession recycles instead of penetrating;
  // direct play trades build-up security for chance quality when the long
  // ball lands.
  if (attacking.playingStyle === "Possession") modifier -= 0.14;
  if (attacking.playingStyle === "Direct") modifier += 0.14;
  if (attacking.playingStyle === "Balanced") modifier += 0.03;
  if (attackInstructions.includes("WorkBallIntoBox")) modifier += 0.12;
  if (attackInstructions.includes("HighTempo")) modifier += 0.08;
  if (defendInstructions.includes("StayCompact")) modifier -= 0.1;
  if (badge(creator, "hawk_eyed") || badge(creator, "press_resistant")) modifier += 0.12;
  return modifier;
}

function homePossessionProbability(home: SimSide, away: SimSide): number {
  let probability = 0.5;
  if (home.playingStyle === "Possession") probability += 0.05;
  if (away.playingStyle === "Possession") probability -= 0.05;
  return clamp(probability, 0.35, 0.65);
}

function evidenceForBuild(attacking: SimSide, defending: SimSide, success: boolean): string[] {
  const result = [success ? "BUILD_UP_CONNECTED" : "PRESSURE_FORCED_TURNOVER"];
  if (attacking.playingStyle === "Possession") result.push("POSSESSION_STRUCTURE");
  if (attacking.instructions?.includes("PlayOutFromTheBack")) result.push("PLAY_OUT_FROM_BACK");
  if (defending.playingStyle === "High Press" || defending.instructions?.includes("PressHigh")) {
    result.push("HIGH_PRESS");
  }
  return result;
}

function tierFor(acc: Accumulator, won: boolean, draw: boolean): FormTier {
  if (acc.goals > 0 || acc.assists > 1) return "Excellent";
  if (acc.assists > 0 || (won && acc.tacklesWon + acc.saves >= 3)) return "Good";
  if (draw || acc.shots + acc.tacklesWon + acc.saves > 1) return "Average";
  return won ? "Average" : "Poor";
}

function ratingFor(acc: Accumulator): number {
  return clamp(
    62 + acc.goals * 14 + acc.assists * 8 + acc.saves * 2 + acc.tacklesWon - acc.redCards * 18,
    40,
    100,
  );
}

function toPerformance(acc: Accumulator, won: boolean, draw: boolean): SimPerformance {
  const tier = tierFor(acc, won, draw);
  return {
    playerId: acc.player.playerId,
    clubId: acc.clubId,
    goals: acc.goals,
    assists: acc.assists,
    tier,
    eventDescription: null,
    minutesPlayed: acc.minutes,
    shots: acc.shots,
    shotsOnTarget: acc.shotsOnTarget,
    xgX100: acc.xgX100,
    keyPasses: acc.keyPasses,
    passesAttempted: acc.passesAttempted,
    passesCompleted: Math.min(acc.passesAttempted, acc.passesCompleted),
    tacklesAttempted: acc.tacklesAttempted,
    tacklesWon: Math.min(acc.tacklesAttempted, acc.tacklesWon),
    interceptions: acc.interceptions,
    clearances: acc.clearances,
    aerialsWon: Math.min(acc.aerialsContested, acc.aerialsWon),
    aerialsContested: acc.aerialsContested,
    dribblesCompleted: acc.dribblesCompleted,
    foulsCommitted: acc.foulsCommitted,
    foulsDrawn: acc.foulsDrawn,
    saves: acc.saves,
    yellowCards: acc.yellowCards,
    redCards: acc.redCards,
    ratingX10: ratingFor(acc),
    started: acc.started,
    enteredMinute: acc.enteredMinute,
    leftMinute: acc.leftMinute,
    positionSlot: acc.player.slot ?? null,
  };
}

function playerUpdates(runtimeSide: RuntimeSide): SimPlayerUpdate[] {
  const instructions = runtimeSide.side.instructions ?? [];
  const loadIntensity = intensity(runtimeSide.side.playingStyle, instructions);
  return [...runtimeSide.accumulators.values()].map((acc) => {
    const stamina = gifts(acc.player).stamina;
    const professionalism = traits(acc.player).professionalism;
    const fatigueDelta = Math.max(
      4,
      Math.round(
        (acc.minutes / 90) * 28 * loadIntensity - (stamina - 50) / 8 - (professionalism - 50) / 15,
      ),
    );
    return {
      playerId: acc.player.playerId,
      clubId: acc.clubId,
      fatigueDelta,
      injuryMatches: acc.injuryMatches,
      yellowCards: acc.yellowCards,
      redCard: acc.redCards > 0,
    };
  });
}

export function simulateCausalMatch(input: SimMatchInput): SimMatchResult {
  if (input.home.starters.length !== 11 || input.away.starters.length !== 11) {
    throw new Error("simulateMatch: each side must have exactly 11 starters");
  }
  const rng = mulberry32(input.seed);
  const home = runtime(input.home);
  const away = runtime(input.away);
  const events: SimEvent[] = [];
  let homeGoals = 0;
  let awayGoals = 0;

  for (let possession = 0; possession < 64; possession++) {
    const minute = Math.min(90, Math.floor((possession * 90) / 64) + 1);
    if (minute >= 55 && minute <= 85) {
      maybeRotate(home, minute, rng, events);
      maybeRotate(away, minute, rng, events);
    }

    const homePossessionBias = homePossessionProbability(input.home, input.away);
    const attacking = rng.chance(homePossessionBias) ? home : away;
    const defending = attacking === home ? away : home;
    const creatorPool = attacking.active.filter((player) => player.positionFamily !== "gk");
    const defenderFiltered = defending.active.filter(
      (player) => player.positionFamily !== "forward",
    );
    // After dismissals the filtered pool can in principle run dry.
    const defenderPool = defenderFiltered.length > 0 ? defenderFiltered : defending.active;
    const creator = weightedPick(
      rng,
      creatorPool,
      (player) => gifts(player).passing + gifts(player).vision,
    );
    const defender = weightedPick(
      rng,
      defenderPool,
      (player) => gifts(player).tackling + traits(player).workEthic,
    );
    const creatorAcc = attacking.accumulators.get(creator.playerId)!;
    const defenderAcc = defending.accumulators.get(defender.playerId)!;
    const passes = 3 + Math.floor(rng.next() * 5);
    creatorAcc.passesAttempted += passes;

    const attackBuild =
      (gifts(creator).passing + gifts(creator).composure + traits(creator).riskTolerance) / 3 -
      (creator.fatigue ?? 0) * 0.12 -
      pressurePenalty(input, creator);
    const press =
      (gifts(defender).tackling + traits(defender).workEthic + gifts(defender).stamina) / 3 -
      (defender.fatigue ?? 0) * 0.12;
    // Home support shows up in sustained territory, not in the boot at
    // the moment of finishing — the home edge lives here. 0.06 per
    // possession is the smallest value that stays visible in a 90-match
    // league table instead of drowning in noise (playtest 2026-07-13:
    // 0.03 produced 92 home vs 97 away wins over 270 fixtures).
    const homeBuildEdge = attacking === home ? 0.06 : 0;
    // Being a man (or two) down stretches every defensive action.
    const shortHanded = Math.max(0, 11 - defending.active.length) * 0.06;
    const buildProbability = clamp(
      logistic((attackBuild - press) / 12) +
        buildUpModifier(attacking.side, defending.side) +
        homeBuildEdge +
        shortHanded,
      0.22,
      0.92,
    );
    if (rng.chance(buildProbability)) {
      // Beaten challenges happen on successful build-ups too — without
      // them every recorded tackle is a won tackle and the stats read
      // as a mirror-image 100% for both sides.
      if (rng.chance(0.35)) defenderAcc.tacklesAttempted += 1;
    } else {
      creatorAcc.passesCompleted += Math.max(0, passes - 1);
      if (rng.chance(0.55)) {
        defenderAcc.tacklesAttempted += 1;
        defenderAcc.tacklesWon += 1;
      } else {
        defenderAcc.interceptions += 1;
      }
      makeEvent(events, {
        minute,
        kind: "Turnover",
        phase: "build_up",
        clubId: defending.side.clubId,
        primaryPlayerId: defender.playerId,
        secondaryPlayerId: creator.playerId,
        outcome: "regain",
        evidence: evidenceForBuild(attacking.side, defending.side, false),
      });
      const temperament = traits(defender).temperament;
      const hotHeaded = badge(defender, "hot_headed");
      // Winning the ball by hunting it costs fouls — the pressing
      // identity pays in discipline, not just fatigue.
      const aggressivePress = pressesHigh(defending.side) ? 0.05 : 0;
      const foulProbability = clamp(
        0.14 + aggressivePress + Math.max(0, 55 - temperament) / 180 + (hotHeaded ? 0.12 : 0),
        0.02,
        0.5,
      );
      if (rng.chance(foulProbability)) {
        defenderAcc.foulsCommitted += 1;
        creatorAcc.foulsDrawn += 1;
        makeEvent(events, {
          minute,
          kind: "Foul",
          phase: "stoppage",
          clubId: defending.side.clubId,
          primaryPlayerId: defender.playerId,
          secondaryPlayerId: creator.playerId,
          outcome: "free_kick",
          evidence: [
            defending.side.instructions?.includes("PressHigh")
              ? "AGGRESSIVE_PRESS"
              : "LATE_CHALLENGE",
            hotHeaded ? "HOT_HEADED" : "TEMPERAMENT_TEST",
          ],
        });
        const cardProbability = clamp(
          0.24 + Math.max(0, 50 - temperament) / 160 + (hotHeaded ? 0.2 : 0),
          0.08,
          0.6,
        );
        if (rng.chance(cardProbability)) {
          const red = rng.chance(hotHeaded ? 0.08 : 0.025);
          if (red) {
            defenderAcc.redCards += 1;
            // A dismissal removes the player: the side finishes the
            // match short-handed (see the shortHanded build modifier).
            const dismissedIndex = defending.active.findIndex(
              (player) => player.playerId === defender.playerId,
            );
            if (dismissedIndex >= 0) defending.active.splice(dismissedIndex, 1);
            defenderAcc.minutes = minute;
            defenderAcc.leftMinute = minute;
          } else {
            defenderAcc.yellowCards += 1;
          }
          makeEvent(events, {
            minute,
            kind: "Card",
            phase: "stoppage",
            clubId: defending.side.clubId,
            primaryPlayerId: defender.playerId,
            secondaryPlayerId: null,
            outcome: red ? "red" : "yellow",
            evidence: [hotHeaded ? "HOT_HEADED_ESCALATION" : "REPEATED_PRESSURE_FOUL"],
          });
        }
      }
      continue;
    }
    creatorAcc.passesCompleted += passes;

    const defensiveShape =
      average(defenderPool, (player) => gifts(player).tackling + gifts(player).composure) / 2;
    const creation =
      (gifts(creator).vision + gifts(creator).passing + traits(creator).riskTolerance) / 3;
    const chanceProbability = clamp(
      0.32 +
        logistic((creation - defensiveShape) / 14) * 0.3 +
        chanceModifier(attacking.side, defending.side, creator),
      0.15,
      0.85,
    );
    if (!rng.chance(chanceProbability)) {
      defenderAcc.clearances += 1;
      continue;
    }

    creatorAcc.keyPasses += 1;
    const shooterPool = attacking.active.filter((player) => player.positionFamily !== "gk");
    const shooter = weightedPick(
      rng,
      shooterPool,
      (player) =>
        gifts(player).finishing +
        gifts(player).pace +
        (player.positionFamily === "forward" ? 35 : 0),
    );
    const shooterAcc = attacking.accumulators.get(shooter.playerId)!;
    shooterAcc.shots += 1;
    const tacticEvidence =
      attacking.side.playingStyle === "Counter-Attack" &&
      defending.side.instructions?.includes("HighLine")
        ? ["COUNTER_V_HIGH_LINE"]
        : ["FINAL_THIRD_CREATION"];
    if (pressesHigh(defending.side)) tacticEvidence.push("PRESS_BROKEN");
    if (badge(creator, "hawk_eyed")) tacticEvidence.push("HAWK_EYED_VISION");
    if (badge(shooter, "lightning_quick")) tacticEvidence.push("PACE_IN_SPACE");
    makeEvent(events, {
      minute,
      kind: "Chance",
      phase: attacking.side.playingStyle === "Counter-Attack" ? "transition" : "final_third",
      clubId: attacking.side.clubId,
      primaryPlayerId: creator.playerId,
      secondaryPlayerId: shooter.playerId,
      outcome: "shot_created",
      evidence: tacticEvidence,
    });

    const onTargetProbability = clamp(
      0.36 + (gifts(shooter).finishing + gifts(shooter).composure - 100) / 180,
      0.25,
      0.8,
    );
    const keeper =
      defending.active.find((player) => player.positionFamily === "gk") ?? defending.active[0]!;
    const keeperAcc = defending.accumulators.get(keeper.playerId)!;
    const contextualFinish =
      (badge(shooter, "clutch_finisher") && input.context?.pressure === "RunIn" ? 8 : 0) +
      (badge(shooter, "lightning_quick") && defending.side.instructions?.includes("HighLine")
        ? 6
        : 0);
    const finish = gifts(shooter).finishing + gifts(shooter).composure + contextualFinish;
    const keeping =
      gifts(keeper).reflexes +
      gifts(keeper).composure +
      (badge(keeper, "quick_reflexes") ? 8 : 0) -
      (keeper.fatigue ?? 0) * 0.12;
    const homeAdvantage = attacking === home ? HOME_FINISHING_EDGE : 0;
    // The deep block's payoff for the territory it conceded in build-up:
    // shots against it come from worse spots. A counter that beats a high
    // line arrives as a breakaway — the finish is cleaner.
    const compactBlock = defending.side.instructions?.includes("StayCompact") ? 0.04 : 0;
    const breakaway =
      attacking.side.playingStyle === "Counter-Attack" &&
      defending.side.instructions?.includes("HighLine")
        ? 0.04
        : 0;
    const goalProbability = clamp(
      0.24 + logistic((finish - keeping) / 14) * 0.28 + homeAdvantage + breakaway - compactBlock,
      0.14,
      0.58,
    );
    // xG is the model's own conversion estimate for THIS shot — shooter,
    // keeper, tactical context, venue — so league xG reconciles with
    // league goals by construction.
    shooterAcc.xgX100 += Math.max(1, Math.round(onTargetProbability * goalProbability * 100));

    if (!rng.chance(onTargetProbability)) {
      makeEvent(events, {
        minute,
        kind: "Shot",
        phase: "final_third",
        clubId: attacking.side.clubId,
        primaryPlayerId: shooter.playerId,
        secondaryPlayerId: creator.playerId,
        outcome: "off_target",
        evidence: ["CHANCE_NOT_CONVERTED"],
      });
      continue;
    }
    shooterAcc.shotsOnTarget += 1;
    const currentGoals = attacking === home ? homeGoals : awayGoals;
    if (currentGoals < 5 && rng.chance(goalProbability)) {
      shooterAcc.goals += 1;
      if (creator.playerId !== shooter.playerId) creatorAcc.assists += 1;
      if (attacking === home) homeGoals += 1;
      else awayGoals += 1;
      makeEvent(events, {
        minute,
        kind: "Goal",
        phase: "final_third",
        clubId: attacking.side.clubId,
        primaryPlayerId: shooter.playerId,
        secondaryPlayerId: creator.playerId === shooter.playerId ? null : creator.playerId,
        outcome: "scored",
        evidence: [...tacticEvidence, "COMPOSURE_AT_FINISH"],
      });
    } else {
      keeperAcc.saves += 1;
      makeEvent(events, {
        minute,
        kind: "Save",
        phase: "final_third",
        clubId: defending.side.clubId,
        primaryPlayerId: keeper.playerId,
        secondaryPlayerId: shooter.playerId,
        outcome: "saved",
        evidence: [badge(keeper, "quick_reflexes") ? "QUICK_REFLEXES" : "KEEPER_POSITIONING"],
      });
    }
  }

  for (const runtimeSide of [home, away]) {
    for (const acc of runtimeSide.accumulators.values()) {
      const injuryRisk = 0.002 + Math.max(0, (acc.player.fatigue ?? 0) - 70) / 1800;
      if (acc.minutes > 0 && rng.chance(injuryRisk)) {
        acc.injuryMatches = 1 + Math.floor(rng.next() * 3);
        makeEvent(events, {
          minute: Math.max(1, acc.leftMinute ?? 88),
          kind: "Injury",
          phase: "stoppage",
          clubId: runtimeSide.side.clubId,
          primaryPlayerId: acc.player.playerId,
          secondaryPlayerId: null,
          outcome: "unavailable",
          evidence: [(acc.player.fatigue ?? 0) >= 70 ? "HEAVY_MATCH_LOAD" : "CONTACT_INJURY"],
        });
      }
    }
  }

  const draw = homeGoals === awayGoals;
  const homeWon = homeGoals > awayGoals;
  const awayWon = awayGoals > homeGoals;
  const performances = [
    ...[...home.accumulators.values()]
      .filter((acc) => acc.minutes > 0)
      .map((acc) => toPerformance(acc, homeWon, draw)),
    ...[...away.accumulators.values()]
      .filter((acc) => acc.minutes > 0)
      .map((acc) => toPerformance(acc, awayWon, draw)),
  ];

  return {
    matchId: input.matchId,
    homeGoals,
    awayGoals,
    performances,
    events,
    playerUpdates: [...playerUpdates(home), ...playerUpdates(away)],
  };
}
