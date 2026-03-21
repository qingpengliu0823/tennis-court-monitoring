# Court Geocoding Report

Last run: 2026-03-21

- **79** courts matched to OSM tennis court locations
- **0** courts geocoded via Nominatim (address lookup)
- **5** courts need manual attention (see below)

## Courts Requiring Manual Attention

These courts could not be automatically matched to a precise OSM tennis court location.
To fix: look up the court on Google Maps, find the tennis courts, and update the
`lat`/`lng` values in `scripts/seed-courts.ts`, then run `npm run geocode:apply`.

| Court | Slug | Current Lat,Lng | Issue |
|-------|------|-----------------|-------|
| Seven Kings Park Tennis | `seven-kings-park` | 51.5620, 0.0850 | AMBIGUOUS: shares cluster with goodmayes-park |
| Goodmayes Park Tennis | `goodmayes-park` | 51.5580, 0.1010 | AMBIGUOUS: shares cluster with seven-kings-park |
| Chestnuts Park Tennis | `chestnuts-park` | 51.5780, -0.0730 | AMBIGUOUS: shares cluster with markfield-park |
| Markfield Park Tennis | `markfield-park` | 51.5710, -0.0650 | AMBIGUOUS: shares cluster with chestnuts-park |
| Barley Lane Rec Tennis | `barley-lane-rec` | 51.5650, 0.1000 | No OSM match within 1km (nearest: 1006m) |

## How This Works

The `geocode-courts` script queries OpenStreetMap's Overpass API for all tennis courts
(`leisure=pitch` + `sport=tennis`) in the London area, clusters nearby features,
and matches each court in `seed-courts.ts` to the nearest OSM cluster.

```bash
npm run geocode          # dry-run: show comparison table
npm run geocode:apply    # update seed file + database
npm run geocode:refresh  # clear OSM cache and re-fetch
```

The OSM data is cached locally at `scripts/.osm-tennis-cache.json`.
Use `npm run geocode:refresh` to re-fetch after OSM edits or when adding new courts.
