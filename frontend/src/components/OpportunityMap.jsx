import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BASE_LAYER =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function referenceKey(reference) {
  return `${reference.lat}:${reference.lon}`;
}

export default function OpportunityMap({
  opportunity,
  referenceAreas,
  opportunities,
  highlightedOpportunityIds,
  selectedOpportunityId,
  onSelectOpportunity,
}) {
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);

  useEffect(() => {
    if (!mapElement.current) return undefined;

    const map = L.map(mapElement.current, {
      zoomControl: false,
      scrollWheelZoom: false,
    }).setView([32.55, -81.25], 7);
    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer(BASE_LAYER, {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(map);

    mapInstance.current = map;
    layerGroup.current = L.layerGroup().addTo(map);
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapInstance.current = null;
      layerGroup.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    const layers = layerGroup.current;
    if (!map || !layers) return;

    layers.clearLayers();

    const selectedKeys = new Set([
      referenceKey(opportunity.descReference),
      referenceKey(opportunity.gpcReference),
    ]);

    Object.values(referenceAreas).forEach((reference) => {
      const selected = selectedKeys.has(referenceKey(reference));
      L.circleMarker([reference.lat, reference.lon], {
        radius: selected ? 8 : 6,
        color: selected ? "#fff7ed" : "#234d56",
        weight: selected ? 2 : 1,
        fillColor: selected ? "#e5683e" : "#95b7a8",
        fillOpacity: 0.95,
      })
        .bindTooltip(reference.label, { direction: "top", offset: [0, -6] })
        .bindPopup(
          `<strong>${reference.label}</strong><br>${reference.name}<br><small>Regional reference only; not a project-site coordinate.</small>`,
        )
        .addTo(layers);
    });

    const opportunityGroups = new Map();
    opportunities.forEach((candidate) => {
      const position = {
        lat: (candidate.descReference.lat + candidate.gpcReference.lat) / 2,
        lon: (candidate.descReference.lon + candidate.gpcReference.lon) / 2,
      };
      const key = `${position.lat.toFixed(5)}:${position.lon.toFixed(5)}`;
      const group = opportunityGroups.get(key) ?? [];
      group.push({ candidate, position });
      opportunityGroups.set(key, group);
    });

    opportunityGroups.forEach((group) => {
      group.forEach(({ candidate, position }, index) => {
        const selected = candidate.id === selectedOpportunityId;
        const related = highlightedOpportunityIds.includes(candidate.id);
        const horizontalOffset = (index - (group.length - 1) / 2) * 38;
        const markerNumber =
          candidate.rank ??
          opportunities.findIndex((item) => item.id === candidate.id) + 1;
        const icon = L.divIcon({
          className: "pairing-map-icon",
          html: `<span class="pairing-map-dot${selected ? " pairing-map-dot-selected" : ""}${related ? " pairing-map-dot-related" : " pairing-map-dot-muted"}">${markerNumber}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15 - horizontalOffset, 15],
        });
        const marker = L.marker([position.lat, position.lon], {
          icon,
          keyboard: true,
          title: `${candidate.descProject.title} and ${candidate.gpcProject.title}`,
          zIndexOffset: selected ? 1000 : related ? 500 : 0,
        });

        marker
          .bindPopup(
            `<strong>${candidate.location}</strong><br>${candidate.descProject.title}<br>${candidate.gpcProject.title}<br><small>Regional pairing marker; not a project-site coordinate.</small>`,
          )
          .on("click", () => onSelectOpportunity(candidate.id))
          .addTo(layers);
      });
    });

    const referenceDistance = opportunity.referenceDistanceMiles;
    if (referenceDistance !== null) {
      L.polyline(
        [
          [opportunity.descReference.lat, opportunity.descReference.lon],
          [opportunity.gpcReference.lat, opportunity.gpcReference.lon],
        ],
        { color: "#e5683e", weight: 3, opacity: 0.9, dashArray: "7 7" },
      ).addTo(layers);

      map.fitBounds(
        [
          [opportunity.descReference.lat, opportunity.descReference.lon],
          [opportunity.gpcReference.lat, opportunity.gpcReference.lon],
        ],
        { padding: [70, 70], maxZoom: 8 },
      );
    } else {
      map.setView(
        [opportunity.descReference.lat, opportunity.descReference.lon],
        7,
      );
    }
  }, [
    opportunity,
    referenceAreas,
    opportunities,
    highlightedOpportunityIds,
    selectedOpportunityId,
    onSelectOpportunity,
  ]);

  return (
    <div
      className="opportunity-map"
      ref={mapElement}
      role="region"
      aria-label="Interactive regional map with municipality reference points and opportunity pairings"
    />
  );
}