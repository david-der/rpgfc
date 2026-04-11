// Minimal club name generator. Each club is pinned to a nationality (mirroring
// the player name pools) and composed from a small pool of word stems. Story
// 01 treats clubs as shell entities — real club identity arrives in Story 03.

import type { Random } from "./rng.js";

const PREFIXES = [
  "Real",
  "Club",
  "Sporting",
  "Athletic",
  "Unión",
  "Racing",
  "Internacional",
  "Atlético",
  "FC",
  "AC",
  "Club Deportivo",
];

const CITIES_BY_NATIONALITY: Record<string, string[]> = {
  ES: ["Madrid", "Barcelona", "Sevilla", "Valencia", "Zaragoza", "Oviedo", "Gijón", "Cádiz"],
  NL: ["Utrecht", "Groningen", "Eindhoven", "Leiden", "Arnhem", "Tilburg", "Alkmaar"],
  BR: ["Porto Alegre", "Fortaleza", "Recife", "Belo Horizonte", "Curitiba", "Salvador"],
};

export function generateClub(rng: Random): {
  name: string;
  nationality: string;
  foundedYear: number;
} {
  const nationality = rng.pick(Object.keys(CITIES_BY_NATIONALITY));
  const city = rng.pick(CITIES_BY_NATIONALITY[nationality] ?? []);
  const prefix = rng.pick(PREFIXES);
  const name = `${prefix} ${city}`;
  const foundedYear = rng.int(1890, 1995);
  return { name, nationality, foundedYear };
}
