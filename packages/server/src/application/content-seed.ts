// Content seed — idempotent. Populates the archetypes, badges, and
// thesaurus tables from the constants library in @rpgfc/shared.
//
// Runs on every server boot after migrations. Safe to call twice because it
// checks-then-inserts inside a transaction. Content is versioned with the
// code; this step exists so the DB's referential integrity (archetype FK,
// badge FK) can see the same records that the generator + rendering layer
// already read from memory.

import {
  ARCHETYPE_LIBRARY,
  BADGE_LIBRARY,
  NATURAL_GIFT_KEYS,
  MENTAL_TRAIT_KEYS,
  THESAURUS,
} from "@rpgfc/shared";

import type { DbClient } from "../db/client.js";

export interface ContentSeedResult {
  archetypesInserted: number;
  badgesInserted: number;
  thesaurusRowsInserted: number;
}

export async function seedContentIfMissing(client: DbClient): Promise<ContentSeedResult> {
  const now = new Date().toISOString();
  let archetypesInserted = 0;
  let badgesInserted = 0;
  let thesaurusRowsInserted = 0;

  if (client.dialect === "sqlite") {
    const sqlite = client.sqlite;

    const countArchetypes = sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM archetypes`)
      .get();
    if ((countArchetypes?.n ?? 0) === 0) {
      const insert = sqlite.prepare(
        `INSERT INTO archetypes (id, display_name, primary_role, position_label,
           gift_dist_json, trait_dist_json, starting_badge_keys_json,
           inborn_badge_chances_json, preferred_foot_weights_json, age_range_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      sqlite.exec("BEGIN");
      try {
        for (const a of ARCHETYPE_LIBRARY) {
          insert.run(
            a.id,
            a.displayName,
            a.primaryRole,
            a.positionLabel,
            JSON.stringify(a.giftDist),
            JSON.stringify(a.traitDist),
            JSON.stringify(a.startingBadgeKeys),
            JSON.stringify(a.inbornBadgeChances),
            JSON.stringify(a.preferredFootWeights),
            JSON.stringify(a.ageRange),
          );
          archetypesInserted++;
        }
        sqlite.exec("COMMIT");
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    }

    const countBadges = sqlite.prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM badges`).get();
    if ((countBadges?.n ?? 0) === 0) {
      const insert = sqlite.prepare(
        `INSERT INTO badges (key, category, display_name, tiers_json,
           award_trigger, conditions_json, effects_json, prose_hooks_json,
           decay_rules_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      sqlite.exec("BEGIN");
      try {
        for (const b of BADGE_LIBRARY) {
          insert.run(
            b.key,
            b.category,
            b.displayName,
            b.tiers ? JSON.stringify(b.tiers) : null,
            b.awardTrigger,
            JSON.stringify(b.conditions),
            JSON.stringify(b.effects),
            JSON.stringify(b.proseHooks),
            JSON.stringify(b.decayRules),
            now,
          );
          badgesInserted++;
        }
        sqlite.exec("COMMIT");
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    }

    const countThesaurus = sqlite
      .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM thesaurus`)
      .get();
    if ((countThesaurus?.n ?? 0) === 0) {
      const insert = sqlite.prepare(
        `INSERT INTO thesaurus (attribute, precision, tier_index, word) VALUES (?, ?, ?, ?)`,
      );
      sqlite.exec("BEGIN");
      try {
        for (const attr of [...NATURAL_GIFT_KEYS, ...MENTAL_TRAIT_KEYS]) {
          const entry = THESAURUS[attr];
          entry.fine.forEach((word, i) => {
            insert.run(attr, "fine", i, word);
            thesaurusRowsInserted++;
          });
          entry.coarse.forEach((word, i) => {
            insert.run(attr, "coarse", i, word);
            thesaurusRowsInserted++;
          });
        }
        sqlite.exec("COMMIT");
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    }

    return { archetypesInserted, badgesInserted, thesaurusRowsInserted };
  }

  // Postgres path
  const pg = await client.pool.connect();
  try {
    await pg.query("BEGIN");

    const { rows: archRows } = await pg.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM archetypes`,
    );
    if (Number(archRows[0]?.n ?? 0) === 0) {
      for (const a of ARCHETYPE_LIBRARY) {
        await pg.query(
          `INSERT INTO archetypes (id, display_name, primary_role, position_label,
             gift_dist_json, trait_dist_json, starting_badge_keys_json,
             inborn_badge_chances_json, preferred_foot_weights_json, age_range_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            a.id,
            a.displayName,
            a.primaryRole,
            a.positionLabel,
            JSON.stringify(a.giftDist),
            JSON.stringify(a.traitDist),
            JSON.stringify(a.startingBadgeKeys),
            JSON.stringify(a.inbornBadgeChances),
            JSON.stringify(a.preferredFootWeights),
            JSON.stringify(a.ageRange),
          ],
        );
        archetypesInserted++;
      }
    }

    const { rows: badgeRows } = await pg.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM badges`,
    );
    if (Number(badgeRows[0]?.n ?? 0) === 0) {
      for (const b of BADGE_LIBRARY) {
        await pg.query(
          `INSERT INTO badges (key, category, display_name, tiers_json,
             award_trigger, conditions_json, effects_json, prose_hooks_json,
             decay_rules_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            b.key,
            b.category,
            b.displayName,
            b.tiers ? JSON.stringify(b.tiers) : null,
            b.awardTrigger,
            JSON.stringify(b.conditions),
            JSON.stringify(b.effects),
            JSON.stringify(b.proseHooks),
            JSON.stringify(b.decayRules),
            now,
          ],
        );
        badgesInserted++;
      }
    }

    const { rows: thesRows } = await pg.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM thesaurus`,
    );
    if (Number(thesRows[0]?.n ?? 0) === 0) {
      for (const attr of [...NATURAL_GIFT_KEYS, ...MENTAL_TRAIT_KEYS]) {
        const entry = THESAURUS[attr];
        for (let i = 0; i < entry.fine.length; i++) {
          await pg.query(
            `INSERT INTO thesaurus (attribute, precision, tier_index, word) VALUES ($1, $2, $3, $4)`,
            [attr, "fine", i, entry.fine[i]],
          );
          thesaurusRowsInserted++;
        }
        for (let i = 0; i < entry.coarse.length; i++) {
          await pg.query(
            `INSERT INTO thesaurus (attribute, precision, tier_index, word) VALUES ($1, $2, $3, $4)`,
            [attr, "coarse", i, entry.coarse[i]],
          );
          thesaurusRowsInserted++;
        }
      }
    }

    await pg.query("COMMIT");
    return { archetypesInserted, badgesInserted, thesaurusRowsInserted };
  } catch (err) {
    await pg.query("ROLLBACK");
    throw err;
  } finally {
    pg.release();
  }
}
