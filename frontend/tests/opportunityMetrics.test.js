import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOpportunityScore,
  daysBetweenDates,
  distanceBetweenPointsMiles,
  rankOpportunities,
} from "../src/lib/opportunityMetrics.js";
import { opportunities } from "../src/data/opportunities.js";

test("calculates absolute calendar-day gaps in UTC", () => {
  assert.equal(daysBetweenDates("2025-06-01", "2026-06-01"), 365);
  assert.equal(daysBetweenDates("2027-06-01", "2025-06-01"), 730);
  assert.equal(daysBetweenDates("2025-02-30", "2025-03-01"), null);
  assert.equal(daysBetweenDates(null, "2025-03-01"), null);
});

test("calculates great-circle distances and rejects invalid coordinates", () => {
  const distance = distanceBetweenPointsMiles(
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
  );

  assert.ok(Math.abs(distance - 69.09) < 0.1);
  assert.equal(
    distanceBetweenPointsMiles({ lat: 91, lon: 0 }, { lat: 0, lon: 0 }),
    null,
  );
});

test("scores the timing and reference-distance boundaries", () => {
  assert.equal(calculateOpportunityScore(0, 0), 100);
  assert.equal(calculateOpportunityScore(1825, 25), 0);
  assert.equal(calculateOpportunityScore(null, 5), null);
  assert.equal(calculateOpportunityScore(10, null), null);
});

test("ranks scored pairings first and leaves incomplete pairings unranked", () => {
  const ranked = rankOpportunities([
    { location: "Later", daysApart: 365, referenceDistanceMiles: 10 },
    { location: "Incomplete", daysApart: null, referenceDistanceMiles: 2 },
    { location: "Earlier", daysApart: 100, referenceDistanceMiles: 10 },
  ]);

  assert.deepEqual(
    ranked.map(({ location, rank }) => [location, rank]),
    [
      ["Earlier", 1],
      ["Later", 2],
      ["Incomplete", null],
    ],
  );
});

test("only source-complete pairings receive a score", () => {
  assert.equal(opportunities.length, 6);
  assert.deepEqual(
    opportunities.filter(({ score }) => score !== null).map(({ id }) => id),
    ["OVL_5", "OVL_6"],
  );
  assert.equal(opportunities.find(({ id }) => id === "OVL_1").rank, null);
});