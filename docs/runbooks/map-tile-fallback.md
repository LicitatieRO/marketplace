# Map tile fallback (PMTiles)

Self-hosted **Bucharest + Ilfov** extract used when `MAP_TILE_PROVIDER=osm` and OpenStreetMap raster tiles fail repeatedly. The extract is **dormant** while OSM works (no `.pmtiles` HTTP traffic).

## Kill switch (`MAP_TILE_PROVIDER`)

| Value | Behaviour |
| --- | --- |
| `osm` (default) | OSM raster tiles; after `MAP_TILE_FAILOVER_ERRORS` (default **5**) tile **load** errors within `MAP_TILE_FAILOVER_WINDOW_MS` (default **15000**), switch to the local extract. |
| `pmtiles` | Use the extract directly (still consent-gated). |
| `off` | No basemap; show “Harta nu este disponibilă momentan” / “Map is currently unavailable”. Lists keep working. |

Set server-side only (e.g. Vercel project env). Restart/redeploy after changes.

## Current extract

| Field | Value |
| --- | --- |
| Source planet archive | `https://build.protomaps.com/20261110.pmtiles` |
| OSM replication time (metadata) | `2026-11-10T04:00:00Z` |
| Bbox (`--bbox`) | `25.52,44.12,26.70,44.78` (Bucharest + Ilfov) |
| Max zoom | `15` |
| On-disk size | ~34 MiB (`data/tiles/bucharest-ilfov.pmtiles`) |
| Hosting | Same-origin **`/tiles/*`** route (`src/app/tiles/[...path]/route.ts`) with **`Accept-Ranges: bytes`**, **206** Range responses, and long-lived **`Cache-Control`** |
| Git storage | **Git LFS** (`data/tiles/*.pmtiles` in `.gitattributes`); after clone run `git lfs pull` |

### Refresh the extract

Requires the [pmtiles CLI](https://docs.protomaps.com/pmtiles/cli) (no API key).

```sh
# Pick a recent daily build from https://maps.protomaps.com/builds/
SOURCE="https://build.protomaps.com/20261110.pmtiles"
BBOX="25.52,44.12,26.70,44.78"
OUT="data/tiles/bucharest-ilfov.pmtiles"

pmtiles extract "$SOURCE" "$OUT" --bbox="$BBOX" --maxzoom=15
pmtiles show "$OUT"
ls -lh "$OUT"
```

Verification:

1. `ls -lh` — expect **&lt; 100 MB** for git/Vercel static hosting.
2. Local: `MAP_TILE_PROVIDER=pmtiles npm run dev`, accept map consent, confirm tiles in Bucharest.
3. `curl -I "http://localhost:3000/tiles/bucharest-ilfov.pmtiles"` — expect **200**, **`Accept-Ranges: bytes`**, and **`Cache-Control`** with **`immutable`**.
4. `curl -I -H "Range: bytes=0-1023" "http://localhost:3000/tiles/bucharest-ilfov.pmtiles"` — expect **206**, **`Content-Range`**, and **`Content-Length: 1024`**.
5. After replacing `data/tiles/bucharest-ilfov.pmtiles` on disk, **restart the app container** (or the Next.js dev process) so the `/tiles` route drops its in-memory archive validity cache and re-reads the file.

### Clone and CI

Install [Git LFS](https://git-lfs.com) once per machine (`git lfs install`). Fresh clones need `git lfs pull` so `data/tiles/bucharest-ilfov.pmtiles` is the real archive, not the pointer stub. GitHub Actions sets `lfs: true` on checkout. **Vercel:** enable **Git LFS** in the project’s Git settings so builds pull the extract; without it the deployed file can be the LFS pointer only.

Commit **one** copy of the file (do not duplicate in Supabase for this POC).

## Attribution

All modes keep OSM credit. PMTiles / Protomaps fallback adds **ODbL** and **Protomaps** in the Leaflet attribution control.

## Future launch task (not in this POC)

Move to a **whole-Romania** Protomaps extract (~**1.4 GB**, z0–15) on **Cloudflare R2** behind a custom domain, with range requests and caching at the edge — too large for git/Vercel static in this branch.