const MILES_PER_EARTH_RADIUS = 3958.7613;
const MAX_TIMING_WINDOW_DAYS = 1825;
const SCREENING_RADIUS_MILES = 25;

function parseIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return timestamp;
}

export function daysBetweenDates(firstDate, secondDate) {
  const firstTimestamp = parseIsoDate(firstDate);
  const secondTimestamp = parseIsoDate(secondDate);

  if (firstTimestamp === null || secondTimestamp === null) {
    return null;
  }

  return Math.abs(secondTimestamp - firstTimestamp) / 86_400_000;
}

function validatePoint(point) {
  return (
    point &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  );
}

export function distanceBetweenPointsMiles(firstPoint, secondPoint) {
  if (!validatePoint(firstPoint) || !validatePoint(secondPoint)) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = toRadians(secondPoint.lat - firstPoint.lat);
  const longitudeDifference = toRadians(secondPoint.lon - firstPoint.lon);
  const firstLatitude = toRadians(firstPoint.lat);
  const secondLatitude = toRadians(secondPoint.lat);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 2 * MILES_PER_EARTH_RADIUS * Math.asin(Math.sqrt(haversine));
}

export function calculateOpportunityScore(daysApart, referenceDistanceMiles) {
  if (
    !Number.isFinite(daysApart) ||
    daysApart < 0 ||
    !Number.isFinite(referenceDistanceMiles) ||
    referenceDistanceMiles < 0
  ) {
    return null;
  }

  const timingFit = Math.max(0, 1 - daysApart / MAX_TIMING_WINDOW_DAYS);
  const geographicFit = Math.max(
    0,
    1 - referenceDistanceMiles / SCREENING_RADIUS_MILES,
  );

  return Math.round((timingFit * 60 + geographicFit * 40) * 10) / 10;
}

export function rankOpportunities(opportunities) {
  return [...opportunities]
    .map((opportunity) => ({
      ...opportunity,
      score: calculateOpportunityScore(
        opportunity.daysApart,
        opportunity.referenceDistanceMiles,
      ),
    }))
    .sort((first, second) => {
      if (first.score === null && second.score === null) {
        return first.location.localeCompare(second.location);
      }
      if (first.score === null) return 1;
      if (second.score === null) return -1;
      return (
        second.score - first.score ||
        first.daysApart - second.daysApart ||
        first.location.localeCompare(second.location)
      );
    })
    .map((opportunity, index) => ({
      ...opportunity,
      rank: opportunity.score === null ? null : index + 1,
    }));
}