"use strict";

// eslint-plugin-rpgfc — custom rules backing the Walking Skeleton doctrine
// gates (Story 00 §3.6 / AC-03/04/05). Registered in the workspace root
// `.eslintrc.cjs` via `plugins: ["rpgfc"]`.

const noNumbersInPlayerFacing = require("./rules/no-numbers-in-player-facing.cjs");
const noHiddenInRoutes = require("./rules/no-hidden-in-routes.cjs");

module.exports = {
  meta: {
    name: "eslint-plugin-rpgfc",
    version: "0.0.0",
  },
  rules: {
    "no-numbers-in-player-facing": noNumbersInPlayerFacing,
    "no-hidden-in-routes": noHiddenInRoutes,
  },
};
