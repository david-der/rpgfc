"use strict";

// rpgfc/no-hidden-in-routes
//
// Any file whose path contains `packages/server/src/routes/` is forbidden
// from importing anything that:
//   1. Matches `(..|@rpgfc/server[/\\]?.*)?application(/|$|\\)` — routes
//      must go through the rendering layer, not reach into application/.
//   2. Matches `/hidden/i` — that catches the @rpgfc/shared/types/hidden
//      side-door and any other file whose name signals a hidden-state import.
//
// See TDD v2 §6.4.

const HIDDEN_RE = /hidden/i;
const APPLICATION_RE = /(^|[/\\])application([/\\]|$)|@rpgfc\/server[/\\]?.*application/i;

function isRouteFile(filename) {
  if (!filename) return false;
  return /packages[/\\]server[/\\]src[/\\]routes[/\\]/.test(filename);
}

function checkSource(context, node, value) {
  if (HIDDEN_RE.test(value)) {
    context.report({
      node,
      messageId: "forbiddenHidden",
      data: { import: value },
    });
    return;
  }
  if (APPLICATION_RE.test(value)) {
    context.report({
      node,
      messageId: "forbiddenApplication",
      data: { import: value },
    });
  }
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid files under packages/server/src/routes/ from importing from ../application/* or any path matching */hidden*. Routes must only call into the rendering layer.",
    },
    messages: {
      forbiddenApplication:
        "Route files may not import from application/. Go through rendering/ so HiddenPlayer cannot reach this layer. (offending import: {{import}})",
      forbiddenHidden:
        "Route files may not import from any module whose path contains 'hidden'. HiddenPlayer is a server-internal type. (offending import: {{import}})",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || (context.getFilename && context.getFilename());
    if (!isRouteFile(filename)) return {};

    return {
      ImportDeclaration(node) {
        if (node.source && typeof node.source.value === "string") {
          checkSource(context, node, node.source.value);
        }
      },
      ImportExpression(node) {
        if (
          node.source &&
          node.source.type === "Literal" &&
          typeof node.source.value === "string"
        ) {
          checkSource(context, node, node.source.value);
        }
      },
    };
  },
};
