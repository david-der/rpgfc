"use strict";

// rpgfc/no-numbers-in-player-facing
//
// Forbid numeric literals or digit-bearing text inside JSX elements tagged
// `data-testid="player-facing"`. Player-facing text must go through the
// rendering boundary, which returns badges, prose, and qualitative tiers —
// never numbers. See TDD v2 §6 and Style Guide §2.6.
//
// Allowlist: any data-testid that ends with `-allowlist-number` is exempt.
// That is where the rule is relaxed for jersey numbers, ages, scorelines,
// and years — each allowlisted site is a documented decision.

const NUMBER_RE = /\b\d+(\.\d+)?\b/;

const NUMERIC_ATTRIBUTE_NAMES = new Set([
  "pace",
  "finishing",
  "composure",
  "aerial",
  "tackling",
  "passing",
  "vision",
  "stamina",
  "strength",
  "reflexes",
  "ovr",
  "pot",
  "rating",
  "potential",
  "overall",
]);

function hasDataTestidValue(node, predicate) {
  return node.attributes.some((attr) => {
    if (attr.type !== "JSXAttribute") return false;
    if (!attr.name || attr.name.type !== "JSXIdentifier") return false;
    if (attr.name.name !== "data-testid") return false;
    if (!attr.value || attr.value.type !== "Literal") return false;
    return predicate(attr.value.value);
  });
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid numeric literals or digit-bearing text inside elements marked data-testid='player-facing'. Player-facing text must go through the rendering boundary.",
    },
    messages: {
      leaked:
        "Numeric content is not allowed inside player-facing elements. Use a badge, a certainty tier, or prose instead. See TDD v2 §6.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        const isPlayerFacing = hasDataTestidValue(opening, (v) => v === "player-facing");
        if (!isPlayerFacing) return;
        const isAllowlisted = hasDataTestidValue(
          opening,
          (v) => typeof v === "string" && v.endsWith("-allowlist-number"),
        );
        if (isAllowlisted) return;

        for (const child of node.children) {
          if (child.type === "JSXText" && NUMBER_RE.test(child.value)) {
            context.report({ node: child, messageId: "leaked" });
            continue;
          }
          if (child.type === "JSXExpressionContainer") {
            const expr = child.expression;
            if (!expr) continue;
            if (expr.type === "Literal" && typeof expr.value === "number") {
              context.report({ node: child, messageId: "leaked" });
              continue;
            }
            if (
              expr.type === "TemplateLiteral" &&
              expr.quasis &&
              expr.quasis.some((q) => NUMBER_RE.test(q.value && q.value.raw))
            ) {
              context.report({ node: child, messageId: "leaked" });
              continue;
            }
            if (
              expr.type === "MemberExpression" &&
              expr.property &&
              expr.property.type === "Identifier" &&
              NUMERIC_ATTRIBUTE_NAMES.has(expr.property.name)
            ) {
              context.report({ node: child, messageId: "leaked" });
            }
          }
        }
      },
    };
  },
};
