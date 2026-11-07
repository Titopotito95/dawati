import { sql as m001 } from "./001_init";
import { sql as m002 } from "./002_seed_theme";
import { sql as m003 } from "./003_media_blobs";
import { sql as m004 } from "./004_seed_lotus_theme";

/** Ordered, append-only list. Never edit an applied migration; add a new one. */
export const MIGRATIONS: { id: string; sql: string }[] = [
  { id: "001_init", sql: m001 },
  { id: "002_seed_theme", sql: m002 },
  { id: "003_media_blobs", sql: m003 },
  { id: "004_seed_lotus_theme", sql: m004 },
];
