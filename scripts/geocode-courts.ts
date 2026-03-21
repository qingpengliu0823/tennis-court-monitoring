import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface CourtCoord {
  slug: string;
  name: string;
  location: string;
  oldLat: number;
  oldLng: number;
  newLat?: number;
  newLng?: number;
  delta?: number; // meters
  status: "MATCH" | "NOMINATIM" | "NO_MATCH";
  note?: string;
}

interface Cluster {
  lat: number;
  lng: number;
  count: number;
}

// ---------------------------------------------------------------------------
// Haversine distance (meters)
// ---------------------------------------------------------------------------

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Fetch all tennis courts from OSM Overpass API
// ---------------------------------------------------------------------------

async function fetchOsmTennisCourts(): Promise<
  { lat: number; lng: number; id: number; name?: string }[]
> {
  // Cache to avoid re-fetching from Overpass on every run
  const cachePath = resolve(__dirname, ".osm-tennis-cache.json");
  try {
    const cached = JSON.parse(readFileSync(cachePath, "utf-8"));
    console.log(`  Using cached OSM data (${cached.length} features). Delete ${cachePath} to refresh.`);
    return cached;
  } catch {
    // No cache, fetch from API
  }

  const query = `
[out:json][timeout:60];
(
  way["leisure"="pitch"]["sport"="tennis"](51.28,-0.51,51.69,0.33);
  node["leisure"="pitch"]["sport"="tennis"](51.28,-0.51,51.69,0.33);
  relation["leisure"="pitch"]["sport"="tennis"](51.28,-0.51,51.69,0.33);
);
out center;`;

  const url = "https://overpass-api.de/api/interpreter";

  let resp: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      resp = await fetch(url, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (resp.ok) break;
      console.log(`  Overpass API returned ${resp.status}, retrying in ${(attempt + 1) * 10}s...`);
      resp = null;
    } catch {
      console.log(`  Overpass API request failed, retrying in ${(attempt + 1) * 10}s...`);
    }
    await new Promise((r) => setTimeout(r, (attempt + 1) * 10000));
  }

  if (!resp || !resp.ok) {
    throw new Error("Overpass API failed after 3 attempts");
  }

  const data = (await resp.json()) as { elements: OsmElement[] };
  console.log(`  Fetched ${data.elements.length} OSM tennis features`);

  const features = data.elements
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) return null;
      return { lat, lng, id: el.id, name: el.tags?.name };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Cache results
  writeFileSync(cachePath, JSON.stringify(features), "utf-8");
  console.log(`  Cached to ${cachePath}`);

  return features;
}

// ---------------------------------------------------------------------------
// Cluster nearby OSM features (within thresholdM meters)
// ---------------------------------------------------------------------------

function clusterFeatures(
  features: { lat: number; lng: number }[],
  thresholdM: number = 80,
): Cluster[] {
  const used = new Set<number>();
  const clusters: Cluster[] = [];

  for (let i = 0; i < features.length; i++) {
    if (used.has(i)) continue;
    used.add(i);

    let sumLat = features[i].lat;
    let sumLng = features[i].lng;
    let count = 1;

    for (let j = i + 1; j < features.length; j++) {
      if (used.has(j)) continue;
      const d = haversineM(features[i].lat, features[i].lng, features[j].lat, features[j].lng);
      if (d <= thresholdM) {
        used.add(j);
        sumLat += features[j].lat;
        sumLng += features[j].lng;
        count++;
      }
    }

    clusters.push({ lat: sumLat / count, lng: sumLng / count, count });
  }

  return clusters;
}

// ---------------------------------------------------------------------------
// Nominatim geocode fallback
// ---------------------------------------------------------------------------

async function nominatimGeocode(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "tennis-court-monitoring/1.0 (geocode script)" },
  });
  if (!resp.ok) return null;

  const results = (await resp.json()) as { lat: string; lon: string }[];
  if (results.length === 0) return null;

  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

// ---------------------------------------------------------------------------
// Extract courts from seed-courts.ts by parsing the file text
// ---------------------------------------------------------------------------

function extractSeedCourts(): {
  slug: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
}[] {
  const seedPath = resolve(__dirname, "seed-courts.ts");
  const text = readFileSync(seedPath, "utf-8");

  const courts: { slug: string; name: string; location: string; lat: number; lng: number }[] = [];

  // Match each court object by finding slug, name, location, lat, lng
  const slugRe = /slug:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;

  while ((m = slugRe.exec(text)) !== null) {
    const slug = m[1];
    const blockStart = text.lastIndexOf("{", m.index);
    // Find the closing of this court's metadata block (search forward for the next slug or end)
    const nextSlug = text.indexOf('slug:', m.index + m[0].length);
    const blockEnd = nextSlug === -1 ? text.length : nextSlug;
    const block = text.slice(blockStart, blockEnd);

    const nameMatch = block.match(/name:\s*"([^"]+)"/);
    const locationMatch = block.match(/location:\s*"([^"]+)"/);
    const latMatch = block.match(/lat:\s*(-?\d+\.?\d*)/);
    const lngMatch = block.match(/lng:\s*(-?\d+\.?\d*)/);

    if (latMatch && lngMatch) {
      courts.push({
        slug,
        name: nameMatch?.[1] ?? slug,
        location: locationMatch?.[1] ?? "",
        lat: parseFloat(latMatch[1]),
        lng: parseFloat(lngMatch[1]),
      });
    }
  }

  return courts;
}

// ---------------------------------------------------------------------------
// Update seed-courts.ts with new coordinates
// ---------------------------------------------------------------------------

function updateSeedFile(updates: Map<string, { lat: number; lng: number }>) {
  const seedPath = resolve(__dirname, "seed-courts.ts");
  let text = readFileSync(seedPath, "utf-8");

  for (const [slug, coord] of updates) {
    // Find slug: "<slug>" and then the next lat: <n>, lng: <n> occurrence
    const slugPattern = `slug: "${slug}"`;
    const slugIdx = text.indexOf(slugPattern);
    if (slugIdx === -1) {
      console.log(`  WARNING: Could not find slug "${slug}" in seed file`);
      continue;
    }

    // Search forward from slug for lat/lng pattern
    const after = text.slice(slugIdx);
    const latLngRe = /lat:\s*-?\d+\.?\d*,\s*lng:\s*-?\d+\.?\d*/;
    const match = latLngRe.exec(after);
    if (!match) {
      console.log(`  WARNING: Could not find lat/lng after slug "${slug}"`);
      continue;
    }

    const absIdx = slugIdx + match.index;
    const newLatLng = `lat: ${coord.lat.toFixed(6)}, lng: ${coord.lng.toFixed(6)}`;
    text = text.slice(0, absIdx) + newLatLng + text.slice(absIdx + match[0].length);
  }

  writeFileSync(seedPath, text, "utf-8");
  console.log(`  Updated ${updates.size} coordinates in seed-courts.ts`);
}

// ---------------------------------------------------------------------------
// Update database
// ---------------------------------------------------------------------------

async function updateDatabase(updates: Map<string, { lat: number; lng: number }>) {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const courts = await prisma.court.findMany();
  let updated = 0;

  for (const court of courts) {
    const coord = updates.get(court.slug);
    if (!coord) continue;

    const existing = (court.metadata as Record<string, unknown>) || {};
    await prisma.court.update({
      where: { id: court.id },
      data: { metadata: { ...existing, lat: coord.lat, lng: coord.lng } },
    });
    updated++;
  }

  console.log(`  Updated ${updated} courts in database`);
  await prisma.$disconnect();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function writeReport(results: CourtCoord[]) {
  const now = new Date().toISOString().slice(0, 10);
  const needsAttention = results.filter(
    (r) => r.status === "NO_MATCH" || r.note?.startsWith("AMBIGUOUS"),
  );
  const matched = results.filter(
    (r) => r.status === "MATCH" && !r.note?.startsWith("AMBIGUOUS"),
  );
  const nominatim = results.filter((r) => r.status === "NOMINATIM");

  const lines: string[] = [
    "# Court Geocoding Report",
    "",
    `Last run: ${now}`,
    "",
    `- **${matched.length}** courts matched to OSM tennis court locations`,
    `- **${nominatim.length}** courts geocoded via Nominatim (address lookup)`,
    `- **${needsAttention.length}** courts need manual attention (see below)`,
    "",
  ];

  if (needsAttention.length > 0) {
    lines.push("## Courts Requiring Manual Attention", "");
    lines.push(
      "These courts could not be automatically matched to a precise OSM tennis court location.",
      "To fix: look up the court on Google Maps, find the tennis courts, and update the",
      "`lat`/`lng` values in `scripts/seed-courts.ts`, then run `npm run geocode:apply`.",
      "",
      "| Court | Slug | Current Lat,Lng | Issue |",
      "|-------|------|-----------------|-------|",
    );
    for (const r of needsAttention) {
      const issue = r.status === "NO_MATCH"
        ? `No OSM match within 1km (${r.note})`
        : r.note ?? "Ambiguous";
      lines.push(
        `| ${r.name} | \`${r.slug}\` | ${r.oldLat.toFixed(4)}, ${r.oldLng.toFixed(4)} | ${issue} |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## How This Works",
    "",
    "The `geocode-courts` script queries OpenStreetMap's Overpass API for all tennis courts",
    "(`leisure=pitch` + `sport=tennis`) in the London area, clusters nearby features,",
    "and matches each court in `seed-courts.ts` to the nearest OSM cluster.",
    "",
    "```bash",
    "npm run geocode          # dry-run: show comparison table",
    "npm run geocode:apply    # update seed file + database",
    "npm run geocode:refresh  # clear OSM cache and re-fetch",
    "```",
    "",
    "The OSM data is cached locally at `scripts/.osm-tennis-cache.json`.",
    "Use `npm run geocode:refresh` to re-fetch after OSM edits or when adding new courts.",
    "",
  );

  const reportPath = resolve(__dirname, "../docs/geocode-report.md");
  writeFileSync(reportPath, lines.join("\n"), "utf-8");
  console.log(`  Report written to docs/geocode-report.md`);
}

async function main() {
  const args = process.argv.slice(2);
  const applyDb = args.includes("--apply-db") || args.includes("--apply");
  const applySeed = args.includes("--apply-seed") || args.includes("--apply");
  const refresh = args.includes("--refresh");

  // Delete cache if --refresh
  if (refresh) {
    const cachePath = resolve(__dirname, ".osm-tennis-cache.json");
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(cachePath);
      console.log("  Cleared OSM cache.");
    } catch {
      // No cache file to delete
    }
  }

  console.log("Step 1: Fetching OSM tennis courts...");
  const osmFeatures = await fetchOsmTennisCourts();

  console.log("Step 2: Clustering nearby features...");
  const clusters = clusterFeatures(osmFeatures);
  console.log(`  ${osmFeatures.length} features → ${clusters.length} clusters`);

  console.log("Step 3: Loading seed courts...");
  const seedCourts = extractSeedCourts();
  console.log(`  Found ${seedCourts.length} courts in seed file`);

  console.log("Step 4: Matching courts to OSM clusters...");
  const results: CourtCoord[] = [];
  const clusterUsage = new Map<number, string[]>(); // cluster index → matched slugs

  for (const court of seedCourts) {
    let bestDist = Infinity;
    let bestIdx = -1;

    for (let i = 0; i < clusters.length; i++) {
      const d = haversineM(court.lat, court.lng, clusters[i].lat, clusters[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    if (bestDist <= 1000 && bestIdx >= 0) {
      // Track cluster usage for ambiguity detection
      const users = clusterUsage.get(bestIdx) || [];
      users.push(court.slug);
      clusterUsage.set(bestIdx, users);

      results.push({
        slug: court.slug,
        name: court.name,
        location: court.location,
        oldLat: court.lat,
        oldLng: court.lng,
        newLat: clusters[bestIdx].lat,
        newLng: clusters[bestIdx].lng,
        delta: Math.round(bestDist),
        status: "MATCH",
      });
    } else {
      results.push({
        slug: court.slug,
        name: court.name,
        location: court.location,
        oldLat: court.lat,
        oldLng: court.lng,
        delta: bestDist === Infinity ? undefined : Math.round(bestDist),
        status: "NO_MATCH",
        note: bestDist === Infinity ? "no OSM features found" : `nearest: ${Math.round(bestDist)}m`,
      });
    }
  }

  // Flag ambiguous matches (multiple courts matched to same cluster)
  for (const [clusterIdx, slugs] of clusterUsage) {
    if (slugs.length > 1) {
      for (const result of results) {
        if (slugs.includes(result.slug)) {
          result.note = `AMBIGUOUS: shares cluster with ${slugs.filter((s) => s !== result.slug).join(", ")}`;
        }
      }
    }
  }

  // Nominatim fallback for unmatched courts
  const unmatched = results.filter((r) => r.status === "NO_MATCH");
  if (unmatched.length > 0) {
    console.log(`\nStep 4b: Nominatim fallback for ${unmatched.length} unmatched courts...`);
    for (const r of unmatched) {
      // Try location string, then name + "London tennis"
      const queries = [r.location, `${r.name}, London`];
      for (const q of queries) {
        if (!q) continue;
        console.log(`  Geocoding: ${q}`);
        const coord = await nominatimGeocode(q);
        if (coord) {
          r.newLat = coord.lat;
          r.newLng = coord.lng;
          r.delta = Math.round(haversineM(r.oldLat, r.oldLng, coord.lat, coord.lng));
          r.status = "NOMINATIM";
          r.note = `geocoded from: "${q}"`;
          break;
        }
        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Print report
  // ---------------------------------------------------------------------------

  console.log("\n" + "=".repeat(120));
  console.log("RESULTS");
  console.log("=".repeat(120));

  const nameW = 42;
  const coordW = 24;
  console.log(
    [
      "Court Name".padEnd(nameW),
      "Old Lat,Lng".padEnd(coordW),
      "New Lat,Lng".padEnd(coordW),
      "Delta(m)".padStart(9),
      "Status",
    ].join(" | "),
  );
  console.log(
    ["-".repeat(nameW), "-".repeat(coordW), "-".repeat(coordW), "-".repeat(9), "-".repeat(20)].join(
      "-|-",
    ),
  );

  for (const r of results) {
    const oldCoord = `${r.oldLat.toFixed(4)}, ${r.oldLng.toFixed(4)}`;
    const newCoord = r.newLat != null ? `${r.newLat.toFixed(4)}, ${r.newLng!.toFixed(4)}` : "—";
    const delta = r.delta != null ? String(r.delta).padStart(9) : "—".padStart(9);
    const status = r.note ? `${r.status} (${r.note})` : r.status;
    console.log(
      [r.name.slice(0, nameW).padEnd(nameW), oldCoord.padEnd(coordW), newCoord.padEnd(coordW), delta, status].join(
        " | ",
      ),
    );
  }

  const matched = results.filter((r) => r.status === "MATCH").length;
  const nominatim = results.filter((r) => r.status === "NOMINATIM").length;
  const noMatch = results.filter((r) => r.status === "NO_MATCH").length;
  const ambiguous = results.filter((r) => r.note?.startsWith("AMBIGUOUS")).length;

  console.log(`\nSummary: ${matched} OSM matched, ${nominatim} Nominatim, ${noMatch} unmatched, ${ambiguous} ambiguous`);

  if (ambiguous > 0) {
    console.log("\nAmbiguous matches (multiple courts matched to same OSM cluster):");
    for (const r of results.filter((r) => r.note?.startsWith("AMBIGUOUS"))) {
      console.log(`  - ${r.name}: ${r.note}`);
    }
  }

  if (noMatch > 0) {
    console.log("\nUnmatched courts:");
    for (const r of results.filter((r) => r.status === "NO_MATCH")) {
      console.log(`  - ${r.name}: ${r.note}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Write report
  // ---------------------------------------------------------------------------

  writeReport(results);

  // ---------------------------------------------------------------------------
  // Apply updates
  // ---------------------------------------------------------------------------

  const updates = new Map<string, { lat: number; lng: number }>();
  for (const r of results) {
    if (r.newLat != null && r.newLng != null && !r.note?.startsWith("AMBIGUOUS")) {
      updates.set(r.slug, { lat: r.newLat, lng: r.newLng });
    }
  }

  if (!applyDb && !applySeed) {
    console.log(`\nDry run complete. ${updates.size} courts would be updated.`);
    console.log("Run with --apply to update both seed file and database.");
    console.log("Run with --apply-seed to update seed file only.");
    console.log("Run with --apply-db to update database only.");
    return;
  }

  if (applySeed) {
    console.log("\nUpdating seed-courts.ts...");
    updateSeedFile(updates);
  }

  if (applyDb) {
    console.log("\nUpdating database...");
    await updateDatabase(updates);
  }

  console.log("\nDone!");
}

main().catch(console.error);
