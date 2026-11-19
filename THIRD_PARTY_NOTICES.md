# Third-party notices

This file records attribution and copyleft notices for dependencies declared in `package-lock.json` that need notice beyond the default allowlist. Together with [docs/license-review-needed.json](docs/license-review-needed.json), it is the **checked-in license inventory snapshot** for the lockfile. [docs/license-audit.md](docs/license-audit.md) documents how to run the local license auditor; it is not itself the package inventory. [docs/dependency-audit-baseline.json](docs/dependency-audit-baseline.json) tracks **npm security advisory** baselines only, not SPDX license inventory.

## GNU Lesser General Public License, version 3 or later (LGPL-3.0-or-later) — libvips via sharp

The application depends on [sharp](https://www.npmjs.com/package/sharp) **0.35.5** for server-side image processing. Sharp loads **prebuilt libvips binaries** published as optional platform packages. Those binaries are **LGPL-3.0-or-later**; libvips is used **unmodified**, via **dynamic linking** at runtime (sharp’s native addon loads the platform `libvips` shared library supplied by the matching `@img/sharp-libvips-*` package).

### Covered prebuilt packages (lockfile versions)

| Package | Version |
| --- | --- |
| `@img/sharp-libvips-darwin-arm64` | 1.3.4 |
| `@img/sharp-libvips-darwin-x64` | 1.3.4 |
| `@img/sharp-libvips-linux-arm` | 1.3.4 |
| `@img/sharp-libvips-linux-arm64` | 1.3.4 |
| `@img/sharp-libvips-linux-ppc64` | 1.3.4 |
| `@img/sharp-libvips-linux-riscv64` | 1.3.4 |
| `@img/sharp-libvips-linux-s390x` | 1.3.4 |
| `@img/sharp-libvips-linux-x64` | 1.3.4 |
| `@img/sharp-libvips-linuxmusl-arm64` | 1.3.4 |
| `@img/sharp-libvips-linuxmusl-x64` | 1.3.4 |
| `@img/sharp-wasm32` | 0.35.5 |
| `@img/sharp-win32-arm64` | 0.35.5 |
| `@img/sharp-win32-ia32` | 0.35.5 |
| `@img/sharp-win32-x64` | 0.35.5 |

Only the package matching the deployment platform is installed; the table lists all optional prebuilt variants present in the lockfile.

`@img/sharp-wasm32` is **Apache-2.0 AND LGPL-3.0-or-later AND MIT** per its package manifest; each `@img/sharp-win32-*` package is **Apache-2.0 AND LGPL-3.0-or-later**.

### License text

This application may incorporate or link to libvips components licensed under the **GNU Lesser General Public License, version 3 or later** (LGPL-3.0-or-later). The full license is at <https://www.gnu.org/licenses/lgpl-3.0.html>.

Under LGPL-3.0-or-later you may obtain the **corresponding source** for libvips from:

- **libvips upstream:** <https://github.com/libvips/libvips>
- **Prebuilt binaries for sharp:** <https://github.com/lovell/sharp-libvips> (sources and build scripts for the `@img/sharp-libvips-*` packages)

## BSD 2-Clause License (BSD-2-Clause) — Leaflet

| Package | Version |
| --- | --- |
| `leaflet` | 1.9.4 |

The catalogue map uses [Leaflet](https://leafletjs.com/) **1.9.4** (client-only, consent-gated) to render approximate neighbourhood pins and third-party map tiles.

**Copyright notice (verbatim from the package):**

Copyright (c) 2010-2023, Volodymyr Agafonkin  
Copyright (c) 2010-2011, CloudMade  
All rights reserved.

**License text (verbatim from `node_modules/leaflet/LICENSE`):**

```
BSD 2-Clause License

Copyright (c) 2010-2023, Volodymyr Agafonkin
Copyright (c) 2010-2011, CloudMade
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

Map tile attribution in the UI follows Leaflet’s default attribution control (prefix not disabled) and includes **© [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors** when OSM tiles are shown. When the dormant PMTiles fallback is active, attribution also includes **ODbL** and a **Protomaps** credit.

## BSD 3-Clause License — pmtiles

| Package | Version |
| --- | --- |
| `pmtiles` | 4.5.0 |

Lazy-loaded when the map fallback activates; decodes range requests against the self-hosted `data/tiles/bucharest-ilfov.pmtiles` archive (served at `/tiles/bucharest-ilfov.pmtiles`).

## BSD 3-Clause License — protomaps-leaflet

| Package | Version |
| --- | --- |
| `protomaps-leaflet` | 5.1.0 |

Lazy-loaded vector renderer for the PMTiles fallback basemap (consent-gated). Depends on `@protomaps/basemaps` styles (transitive).

## MIT License — Leaflet.markercluster

| Package | Version |
| --- | --- |
| `leaflet.markercluster` | 1.5.3 |

The listings map (`/map`, consent-gated) uses [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) **1.5.3** to group nearby approximate listing pins.

**License text (verbatim from `node_modules/leaflet.markercluster/LICENSE`):**

```
MIT License

Copyright (c) 2012 Dave Leaver
```

See the package `LICENSE` file for the full MIT license text.

## Creative Commons Attribution 4.0 International (CC-BY-4.0) — caniuse-lite

| Package | Version |
| --- | --- |
| `caniuse-lite` | 1.0.30001826 |

`caniuse-lite` (a transitive browser-capability database used by the frontend toolchain) is licensed under **[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)**.

**Attribution:** Browser compatibility data from [Can I use](https://caniuse.com/) by Alexis Deveria, licensed under CC-BY-4.0.