import {
  daysBetweenDates,
  distanceBetweenPointsMiles,
  rankOpportunities,
} from "../lib/opportunityMetrics.js";

const sourceFiles = {
  dominion: "2024-2028-2million-and-above-project-descriptions.pdf",
  georgia: "2025 IRP Volume 3 PUBLIC DISCLOSURE.pdf",
};

const coordinateReferences = {
  augusta: {
    name: "Augusta, Georgia",
    lat: 33.470974,
    lon: -81.9748429,
    source: "OpenStreetMap Nominatim city administrative-area reference point",
    osmUrl: "https://www.openstreetmap.org/relation/11078175",
  },
  jasperCounty: {
    name: "Jasper County, South Carolina",
    lat: 32.40486,
    lon: -81.0414726,
    source: "OpenStreetMap Nominatim county administrative-area reference point",
    osmUrl: "https://www.openstreetmap.org/relation/1857004",
  },
  okatieVillage: {
    name: "Okatie Village, South Carolina",
    lat: 32.2956335,
    lon: -80.9448103,
    source: "OpenStreetMap Nominatim mapped-place reference point",
    osmUrl: "https://www.openstreetmap.org/way/1152878522",
  },
  bluffton: {
    name: "Bluffton, South Carolina",
    lat: 32.2371465,
    lon: -80.8603868,
    source: "OpenStreetMap Nominatim town administrative-area reference point",
    osmUrl: "https://www.openstreetmap.org/relation/194046",
  },
  savannah: {
    name: "Savannah, Georgia",
    lat: 32.0790074,
    lon: -81.0921335,
    source: "OpenStreetMap Nominatim city administrative-area reference point",
    osmUrl: "https://www.openstreetmap.org/relation/119867",
  },
};

function midpoint(firstPoint, secondPoint) {
  return {
    lat: (firstPoint.lat + secondPoint.lat) / 2,
    lon: (firstPoint.lon + secondPoint.lon) / 2,
  };
}

export const mapReferenceAreas = {
  augusta: {
    ...coordinateReferences.augusta,
    label: "Augusta region reference",
  },
  jasperOkatie: {
    ...midpoint(coordinateReferences.jasperCounty, coordinateReferences.okatieVillage),
    name: "Jasper County / Okatie reference area",
    source: "Midpoint of the listed Jasper County and Okatie public place references",
    osmUrl: null,
  },
  blufftonOkatie: {
    ...midpoint(coordinateReferences.bluffton, coordinateReferences.okatieVillage),
    name: "Bluffton / Okatie reference area",
    source: "Midpoint of the listed Bluffton and Okatie public place references",
    osmUrl: null,
  },
  savannah: {
    ...coordinateReferences.savannah,
    label: "Savannah region reference",
  },
};

const projectRecords = {
  hooksThurmond: {
    utility: "Dominion Energy South Carolina",
    title: "Hooks - Thurmond 115 kV tie rebuild",
    area: "Hooks / Thurmond area, South Carolina",
    plannedDate: null,
    sourceFile: sourceFiles.dominion,
    sourceStatus: "Project and date need source verification",
    referenceAreaId: "augusta",
  },
  jasperOkatie: {
    utility: "Dominion Energy South Carolina",
    title: "Jasper - Okatie 230 kV #2 construction",
    aliases: ["Jasper - Okatie 230 kV #2: Construct"],
    area: "Jasper / Okatie area, South Carolina",
    plannedDate: null,
    sourceFile: sourceFiles.dominion,
    sourceStatus: "Project and date need source verification",
    referenceAreaId: "jasperOkatie",
  },
  stevensHooks: {
    utility: "Dominion Energy South Carolina",
    title: "Stevens Creek - Hooks 115 kV rebuild",
    area: "Stevens Creek / Hooks area, South Carolina",
    plannedDate: "2024-12-31",
    sourceFile: sourceFiles.dominion,
    sourceProjectId: "6809E",
    sourceStatus: "Matched in provided listing; planned date verified",
    referenceAreaId: "augusta",
  },
  okatieBluffton: {
    utility: "Dominion Energy South Carolina",
    title: "Okatie-Bluffton 115 kV rebuild",
    aliases: ["Okatie-Bluffton 115 kV: Rebuild"],
    area: "Okatie / Bluffton area, South Carolina",
    plannedDate: "2025-06-01",
    sourceFile: sourceFiles.dominion,
    sourceProjectId: "6808S",
    sourceStatus: "Matched in provided listing; planned date verified",
    referenceAreaId: "blufftonOkatie",
  },
  evansThurmond: {
    utility: "Georgia Power",
    title: "Evans Primary - Thurmond Dam #5 115 kV rebuild",
    area: "Thurmond area, Georgia / South Carolina",
    plannedDate: null,
    sourceFile: sourceFiles.georgia,
    sourceStatus: "Project and date need source verification",
    referenceAreaId: "augusta",
  },
  mcintoshPurrysburg: {
    utility: "Georgia Power",
    title: "McIntosh - Purrysburg 230 kV reactors",
    area: "Savannah region",
    plannedDate: "2026-06-01",
    sourceFile: sourceFiles.georgia,
    sourceStatus: "Matched in local listing; planned date verified",
    referenceAreaId: "savannah",
  },
  goshenMcintosh: {
    utility: "Georgia Power",
    title: "Goshen - McIntosh 115 kV line rebuild",
    area: "Savannah region",
    plannedDate: "2027-06-01",
    sourceFile: sourceFiles.georgia,
    sourceStatus: "Matched in local listing; planned date verified",
    referenceAreaId: "savannah",
  },
};

const candidatePairs = [
  {
    id: "OVL_1",
    location: "Augusta / Thurmond area",
    descId: "hooksThurmond",
    gpcId: "evansThurmond",
  },
  {
    id: "OVL_2",
    location: "Jasper / McIntosh area",
    descId: "jasperOkatie",
    gpcId: "mcintoshPurrysburg",
  },
  {
    id: "OVL_3",
    location: "Goshen / McIntosh area",
    descId: "jasperOkatie",
    gpcId: "goshenMcintosh",
  },
  {
    id: "OVL_4",
    location: "Stevens Creek / Thurmond area",
    descId: "stevensHooks",
    gpcId: "evansThurmond",
  },
  {
    id: "OVL_5",
    location: "Okatie / McIntosh area",
    descId: "okatieBluffton",
    gpcId: "mcintoshPurrysburg",
  },
  {
    id: "OVL_6",
    location: "Bluffton / Goshen area",
    descId: "okatieBluffton",
    gpcId: "goshenMcintosh",
  },
];

const candidates = candidatePairs.map((pair) => {
  const descProject = projectRecords[pair.descId];
  const gpcProject = projectRecords[pair.gpcId];
  const descReference = mapReferenceAreas[descProject.referenceAreaId];
  const gpcReference = mapReferenceAreas[gpcProject.referenceAreaId];
  const daysApart = daysBetweenDates(
    descProject.plannedDate,
    gpcProject.plannedDate,
  );
  const referenceDistanceMiles =
    descProject.referenceAreaId === gpcProject.referenceAreaId
      ? null
      : distanceBetweenPointsMiles(descReference, gpcReference);

  return {
    ...pair,
    descProject,
    gpcProject,
    descReference,
    gpcReference,
    daysApart,
    referenceDistanceMiles,
  };
});

export const opportunities = rankOpportunities(candidates);
export const coordinateReferencePoints = coordinateReferences;