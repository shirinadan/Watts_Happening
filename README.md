# Watts Happening

A browser-only React dashboard for reviewing candidate coordination pairings between Dominion Energy South Carolina and Georgia Power planning projects. Project records are local static data; there is no application server, database, or backend API.

## Run Locally

Requirements: Node.js supported by the installed Vite version and npm.

```sh
npm install
npm run dev
```

The Vite development server prints its local URL. If port 5173 is already occupied, Vite selects another available port.

## Validation

```sh
npm test
npm run lint
npm run build
```

Tests use Node's built-in test runner and cover date gaps, great-circle distances, score boundaries, ordering, and incomplete source data.

## Data Provenance

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
