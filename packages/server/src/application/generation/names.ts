// Compact hand-curated name pool for Story 01's generated world. Three
// regions only; expanded in later stories. The regional bias is deliberately
// thin — RPG FC's PRD forbids cultural stereotyping in generated content,
// so the pool is cosmetic only. No personality or trait values read from
// nationality.

import type { Random } from "./rng.js";

export interface NamePool {
  nationality: string;
  firstNames: string[];
  lastNames: string[];
  hometowns: string[];
}

export const NAME_POOLS: readonly NamePool[] = [
  {
    nationality: "ES",
    firstNames: [
      "Juan", "Diego", "Iker", "Pablo", "Álvaro", "Rubén", "Mateo",
      "Sergio", "Iván", "Carlos", "Joaquín", "Marc",
    ],
    lastNames: [
      "Moreno", "Fernández", "Ruiz", "Navarro", "Gómez", "Serrano",
      "Castillo", "Ortega", "Jiménez", "Herrera",
    ],
    hometowns: ["Málaga", "Bilbao", "Valencia", "Sevilla", "Oviedo"],
  },
  {
    nationality: "NL",
    firstNames: [
      "Stijn", "Thijs", "Joris", "Mats", "Rik", "Bram", "Sven",
      "Lars", "Finn", "Daan", "Koen", "Ruud",
    ],
    lastNames: [
      "de Boer", "van Houten", "Visser", "Bakker", "Jansen",
      "de Vries", "van Dijk", "Smit", "Hendriks", "Maas",
    ],
    hometowns: ["Utrecht", "Groningen", "Eindhoven", "Leiden", "Arnhem"],
  },
  {
    nationality: "BR",
    firstNames: [
      "Diogo", "Mateus", "Felipe", "Rafael", "Henrique", "Gustavo",
      "Lucas", "Bruno", "Vinícius", "Caio", "João", "Thiago",
    ],
    lastNames: [
      "Marques", "Oliveira", "Santos", "Costa", "Pereira", "Souza",
      "Almeida", "Lima", "Ribeiro", "Barbosa",
    ],
    hometowns: ["Porto Alegre", "Fortaleza", "Recife", "Belo Horizonte", "Curitiba"],
  },
];

export function pickName(rng: Random): {
  name: string;
  nationality: string;
  hometown: string;
} {
  const pool = rng.pick(NAME_POOLS);
  const first = rng.pick(pool.firstNames);
  const last = rng.pick(pool.lastNames);
  const hometown = rng.pick(pool.hometowns);
  return {
    name: `${first} ${last}`,
    nationality: pool.nationality,
    hometown,
  };
}

// A handful of story templates — the generator picks one and substitutes
// {hometown} and {club} as needed. No stereotypes, no caricature; these
// are pure biography hooks the prose generator can reference later.
export const STORY_TEMPLATES: readonly string[] = [
  "Came through the academy of a smaller club near {hometown}.",
  "Left {hometown} early to chase a trial abroad.",
  "Was spotted on a park pitch in {hometown} and signed at fifteen.",
  "Grew up watching their grandfather play local football in {hometown}.",
  "Started as a midfielder in the {hometown} youth setup before being moved forward.",
  "Chose football over a promising school-level athletics career.",
  "Joined the club as a senior free transfer after a difficult loan spell.",
  "One of three siblings, all of whom play semi-professionally.",
];

export function pickStory(rng: Random, hometown: string): string {
  const template = rng.pick(STORY_TEMPLATES);
  return template.replace(/\{hometown\}/g, hometown);
}
