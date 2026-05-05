export type PokemonEntry = { id: number; name: string };

export const POKEMON_LIST: ReadonlyArray<PokemonEntry> = [
  { id: 1,   name: "bulbasaur" },
  { id: 4,   name: "charmander" },
  { id: 7,   name: "squirtle" },
  { id: 25,  name: "pikachu" },
  { id: 35,  name: "clefairy" },
  { id: 39,  name: "jigglypuff" },
  { id: 50,  name: "diglett" },
  { id: 54,  name: "psyduck" },
  { id: 92,  name: "gastly" },
  { id: 104, name: "cubone" },
  { id: 133, name: "eevee" },
  { id: 143, name: "snorlax" },
  { id: 147, name: "dratini" },
  { id: 152, name: "chikorita" },
  { id: 155, name: "cyndaquil" },
  { id: 158, name: "totodile" },
  { id: 196, name: "espeon" },
  { id: 197, name: "umbreon" },
  { id: 252, name: "treecko" },
  { id: 255, name: "torchic" },
  { id: 258, name: "mudkip" },
  { id: 282, name: "gardevoir" },
  { id: 387, name: "turtwig" },
  { id: 448, name: "lucario" }
];

export const SPRITE_URL = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;
