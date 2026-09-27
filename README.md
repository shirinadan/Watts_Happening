# Watts Happening

A React project-comparison demo with a small Python calculation module. Add any number of projects to the selection; the default page compares every unique project pair using the **minimum distance between every pair of their substations** and displays only pairs within 40 km. The earlier regional dashboard remains available under **Regional overview**.

## Open the demo without a server

Open `frontend/dist/demo.html` in a browser. The generated HTML includes the app, project records, and Python-calculated results, so the comparison page needs no server, MongoDB connection, or internet access.

To regenerate it from the repository root:

```sh
python backend/project_compare.py
npm --prefix frontend ci
npm --prefix frontend run build
```

Python uses only the standard library (`csv`, `math`, `json`); pandas is not required. Python 3.10+ and the Node version required by the existing Vite package are sufficient. The generated `frontend/src/data/projectComparisons.json` is checked in, so ordinary frontend builds do not require Python unless the CSVs have changed.

## Comparison behavior

- Enter a project name and press **Enter** or click **Add project**. Keep adding projects to the selection; a full unique name or a selected name/ID suggestion works.
- Comparisons update automatically as projects are added or removed: 3 projects have 3 unique pairings, 4 projects have 6. Only pairings within 40 km appear in the results; farther or unknown distances do not create result rows. Duplicate selections are rejected.
- There is no fixed selection limit. Long result lists show 50 nearby comparisons at a time; **Show more** reveals the next 50. The counter shows the number of matching nearby pairs.
- Python checks all cross-project substation pairs using Haversine distance in **kilometers**, not project centers or municipality references. A shared station can correctly produce **0 km**.
- At **40 km or less**, show the nearest two substations, distance, each project's utility/owner and planned in-service years, and the absolute year gap. Above 40 km, hide the result row while keeping the selected projects in the list. The threshold uses the unrounded distance.
- Missing years or owners remain **Not available**. For multiple source years, display the possible year-gap range instead of choosing one year. Incomplete coordinates remain unknown and are excluded from nearby results.

The main input is `data/main_data_cleaned_with_cost.csv`: 635 project groups and 1,289 project–station links. Its shared columns agree with `data/main_data_cleaned.csv`. The 26 rows with no project ID are retained in the source CSV and excluded from the project picker. Original CSV files are not modified.

Utility/owner comes from the **Owner** column in `data/OurGridFuture_PlannedTransmissionProjects_Jun2026.csv`. Matching uses only complete normalized project names with an unambiguous catalog ID. It matches 501 projects; 479 have a nonempty owner. All distinct segment-owner strings are preserved; commas inside company names are not split. Unknown owners are not inferred from nearby stations or project-name prefixes.

Project costs and lengths are passed to the frontend unchanged (cost in USD, source length in miles), including qualified costs and labeled multi-segment lengths. They are not used to calculate distance or assigned per station.

## Python input and output

`backend/project_compare.py` owns loading, owner matching, distance calculations, year gaps, and JSON export. Compare a selection without any web server:

```sh
python backend/project_compare.py --projects 332 349 344
```

It returns JSON with the selected project documents and a `comparisons` array, one entry per unique project pair, containing `status`, `distance_km`, `nearest_stations`, `year_gap`, and `year_gap_range`. The reusable function `compare_request(projects, {"project_ids": [332, 349, 344]})` accepts the selected IDs. The earlier two-project CLI (`--project-a 332 --project-b 349`) and request format remain supported.

For this server-free demo, Python checks all 201,295 project pairs once, and exports only the 2,444 nearby results plus the full project list. The frontend looks up those precomputed results; it does **not** run a second distance/year calculation in JavaScript or call Python on every click. Absence from the nearby cache means far only when the export is complete and both projects have complete coordinates.

The project JSON already groups substations under their project. A later MongoDB version can load documents in this shape and reuse `compare_request`; database ingestion and a live HTTP endpoint are intentionally not part of this demo.

Example checks: **332 / 349** gives **19.864762 km**, a **1-year** gap, Xcel Energy / Grid United; **344 / 348** shares Robinson Summit and gives **0 km**; **1 / 311** is too far.

## Run Locally

Requirements: Node.js supported by the installed Vite version and npm.

```sh
cd frontend
npm install
npm run dev
```

The Vite development server prints its local URL. If port 5173 is already occupied, Vite selects another available port.

## Validation

```sh
python -m unittest discover -s backend -v
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Python tests cover multi-project selections, nearest-station selection, exact 40 km boundaries, shared stations, missing/multiple years, invalid project selections, owner mapping, and cache completeness. Existing Node tests still cover the original regional dashboard metrics.

## Original regional dashboard: data provenance

The local planning documents are in `Project Listings/`:

- `Dominion Energy/2024-2028-2million-and-above-project-descriptions.pdf`
- `Georgia Power/2025 IRP Volume 3 PUBLIC DISCLOSURE.pdf`

The Dominion entries matched during review are project `6809E` (Stevens Creek - Hooks 115 kV rebuild, planned date 2024-12-31) and project `6808S` (Okatie-Bluffton 115 kV rebuild, planned date 2025-06-01). The local Georgia Power listing matched the McIntosh - Purrysburg project date of 2026-06-01 and Goshen - McIntosh project date of 2027-06-01. That source is marked CEII in the reviewed document; confirm distribution permissions before publishing project details.

The Hooks - Thurmond, Jasper - Okatie, and Evans Primary - Thurmond Dam entries remain marked for source verification. Their dates are intentionally blank in the app, so they cannot affect a score. Candidate pairings preserve the original prototype's six pair combinations; they do not establish that the projects are approved, concurrent, or operationally coordinated.

## Map And Scoring Assumptions

The map uses Leaflet with OpenStreetMap tiles. It plots public municipality or administrative-area reference points from OpenStreetMap Nominatim, not utility infrastructure coordinates. Jasper / Okatie and Bluffton / Okatie area points are midpoints of the corresponding public place references. OpenStreetMap attribution is shown on the map; coordinate records and source links are maintained in `src/data/opportunities.js`.

The app calculates Haversine distances between distinct regional reference points. Those values are area-reference separations, not project, line, substation, or facility distances. Pairings using the same reference area have no distance calculation.

The score is deterministic:

```text
timing fit = max(0, 1 - absolute planned-date gap in days / 1825)
area fit   = max(0, 1 - reference-point distance in miles / 25)
score      = round((0.60 * timing fit + 0.40 * area fit) * 100, 1 decimal)
```

A pairing is ranked only when both planned dates are source-verified and two distinct regional references exist. This is a screening heuristic, not an engineering assessment or construction recommendation. Planned in-service dates do not confirm actual completion.

## Known Limitations

- Two Dominion project/date matches and two Georgia Power date matches are present; the remaining draft entries need review against their source documents.
- Broad public place references cannot validate transmission-asset proximity or line geometry.
- OpenStreetMap tiles require an internet connection and are subject to OpenStreetMap's tile usage policy and data licence.
- Verify the Georgia Power source's CEII handling and sharing requirements before deploying or distributing the app.
