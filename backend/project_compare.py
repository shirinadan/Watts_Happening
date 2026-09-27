"""CSV -> project documents -> Python comparisons -> browser demo JSON.

Run from any directory: python backend/project_compare.py
No database, web server, third-party packages, or location API is required.
"""

import argparse
import csv
import hashlib
import itertools
import json
import math
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data/main_data_cleaned_with_cost.csv"
CATALOG_FILE = ROOT / "data/OurGridFuture_PlannedTransmissionProjects_Jun2026.csv"
OUTPUT_FILE = ROOT / "frontend/src/data/projectComparisons.json"
THRESHOLD_KM = 40.0
EARTH_RADIUS_KM = 6371.0088


def normalize_name(value):
    value = unicodedata.normalize("NFKC", value).casefold().strip()
    value = re.sub(r"[\u2010-\u2015\u2212]", "-", value)
    return re.sub(r"\s*-\s*", "-", re.sub(r"\s+", " ", value))


def read_rows(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def owner_lookup(catalog_path):
    """Match complete names only; preserve all owners of a multi-part project."""
    names = {}
    for row in read_rows(catalog_path):
        name = normalize_name(row["Project name"])
        entry = names.setdefault(name, {"ids": set(), "owners": {}})
        entry["ids"].add(row["Project ID"].strip())
        owner = " ".join(row["Owner"].split())
        if owner:
            entry["owners"].setdefault(owner.casefold(), owner)
    return {
        name: " / ".join(entry["owners"].values()) or None
        for name, entry in names.items()
        if len(entry["ids"]) == 1
    }


def parse_years(value):
    if not value.strip():
        return []
    tokens = [token.strip() for token in value.split("|")]
    if any(not re.fullmatch(r"\d{4}", token) or not 1900 <= int(token) <= 2200 for token in tokens):
        raise ValueError(f"Invalid in-service year: {value!r}")
    return sorted({int(token) for token in tokens})


def coordinate(value, lower, upper):
    try:
        number = float(value)
    except (ValueError, TypeError):
        return None
    return number if math.isfinite(number) and lower <= number <= upper else None


def load_projects(data_path=DATA_FILE, catalog_path=CATALOG_FILE):
    owners = owner_lookup(catalog_path)
    projects = {}
    source_values = {}
    seen_stations = set()
    for row in read_rows(data_path):
        # The original data includes 26 stations with no assigned project.
        if not row["project_id"].strip():
            continue
        project_id = int(row["project_id"])
        station_id = int(row["substation_id"])
        if project_id < 1 or station_id < 1:
            raise ValueError("Project and station IDs must be positive integers.")
        values = tuple(row[key] for key in ("project_name", "cost", "length_mi", "estimated_in_service_year", "change_type"))
        if project_id in source_values and source_values[project_id] != values:
            raise ValueError(f"Conflicting project attributes for ID {project_id}")
        source_values[project_id] = values
        if (project_id, station_id) in seen_stations:
            raise ValueError(f"Duplicate station ID {station_id} in project {project_id}")
        seen_stations.add((project_id, station_id))
        project = projects.setdefault(project_id, {
            "project_id": project_id,
            "project_name": row["project_name"],
            "utility": owners.get(normalize_name(row["project_name"])),
            "in_service_years": parse_years(row["estimated_in_service_year"]),
            "cost": row["cost"] or None,
            "length_mi": row["length_mi"] or None,
            "change_type": row["change_type"] or None,
            "stations": [],
            "coordinates_complete": True,
        })
        station = {
            "substation_id": station_id,
            "substation_name": row["substation_name"],
            "state_code": row["state_code"],
            "state_name": row["state_name"],
            "latitude": coordinate(row["latitude"], -90, 90),
            "longitude": coordinate(row["longitude"], -180, 180),
        }
        project["stations"].append(station)
        if station["latitude"] is None or station["longitude"] is None:
            project["coordinates_complete"] = False
    return sorted(projects.values(), key=lambda project: project["project_id"])


def haversine_km(first, second):
    lat_a, lat_b = math.radians(first["latitude"]), math.radians(second["latitude"])
    delta_lat = lat_b - lat_a
    delta_lon = math.radians(second["longitude"] - first["longitude"])
    haversine = math.sin(delta_lat / 2) ** 2 + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    haversine = min(1.0, max(0.0, haversine))
    return 2 * EARTH_RADIUS_KM * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))


def compare_projects(first, second):
    """Compare EVERY cross-project station pair; keep the minimum, not a center."""
    if first["project_id"] == second["project_id"]:
        raise ValueError("Choose two different projects.")
    result = {
        "project_a_id": first["project_id"],
        "project_b_id": second["project_id"],
        "status": "unknown",
        "distance_km": None,
        "nearest_stations": None,
        "year_gap": None,
        "year_gap_range": None,
    }
    years_a, years_b = first["in_service_years"], second["in_service_years"]
    if years_a and years_b:
        gaps = [abs(a - b) for a in years_a for b in years_b]
        if len(years_a) == len(years_b) == 1:
            result["year_gap"] = gaps[0]
        else:
            result["year_gap_range"] = [min(gaps), max(gaps)]
    if not first["coordinates_complete"] or not second["coordinates_complete"] or not first["stations"] or not second["stations"]:
        return result
    distance, station_a, station_b = min(
        (haversine_km(a, b), index_a, index_b)
        for index_a, a in enumerate(first["stations"])
        for index_b, b in enumerate(second["stations"])
    )
    result.update({
        # Compare unrounded distance to the inclusive threshold.
        "status": "near" if distance <= THRESHOLD_KM else "far",
        "distance_km": round(distance, 6),
        "nearest_stations": [first["stations"][station_a], second["stations"][station_b]],
    })
    return result


def compare_selection(projects, project_ids):
    """Compare each unique pair in a selected list, preserving selection order."""
    by_id = {project["project_id"]: project for project in projects}
    if not isinstance(project_ids, list) or len(project_ids) < 2:
        raise ValueError("Select at least two projects.")
    if any(type(value) is not int or value not in by_id for value in project_ids):
        raise ValueError("Every project ID must identify an existing project.")
    if len(set(project_ids)) != len(project_ids):
        raise ValueError("Each selected project must be different.")
    selected = [by_id[value] for value in project_ids]
    return {
        "projects": selected,
        "comparisons": [compare_projects(first, second) for first, second in itertools.combinations(selected, 2)],
        "threshold_km": THRESHOLD_KM,
    }


def compare_request(projects, payload):
    """Accept a project_ids list; retain the earlier two-ID request as well."""
    if not isinstance(payload, dict):
        raise ValueError("The comparison request must be an object.")
    if "project_ids" in payload:
        return compare_selection(projects, payload["project_ids"])
    by_id = {project["project_id"]: project for project in projects}
    ids = [payload.get("project_a_id"), payload.get("project_b_id")]
    if any(type(value) is not int or value not in by_id for value in ids):
        raise ValueError("Both project IDs must identify existing projects.")
    first, second = (by_id[value] for value in ids)
    return {**compare_projects(first, second), "projects": [first, second], "threshold_km": THRESHOLD_KM}


def build_demo(projects):
    nearby = {}
    pair_count = 0
    for first, second in itertools.combinations(sorted(projects, key=lambda project: project["project_id"]), 2):
        pair_count += 1
        result = compare_projects(first, second)
        if result["status"] == "near":
            nearby[f"{first['project_id']}:{second['project_id']}"] = result
    # Absent pairs mean far ONLY for complete coordinates. The browser uses
    # coordinates_complete to distinguish missing data from a far result.
    return {
        "threshold_km": THRESHOLD_KM,
        "projects": projects,
        "nearby_comparisons": nearby,
        "comparisons_complete": True,
        "compared_pair_count": pair_count,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA_FILE)
    parser.add_argument("--catalog", type=Path, default=CATALOG_FILE)
    parser.add_argument("--output", type=Path, default=OUTPUT_FILE)
    parser.add_argument("--project-a", type=int)
    parser.add_argument("--project-b", type=int)
    parser.add_argument("--projects", type=int, nargs="+", help="Compare every pair of the selected project IDs")
    args = parser.parse_args()
    projects = load_projects(args.data, args.catalog)
    if args.projects is not None:
        if args.project_a is not None or args.project_b is not None:
            parser.error("Use --projects or --project-a/--project-b, not both")
        try:
            result = compare_request(projects, {"project_ids": args.projects})
        except ValueError as error:
            parser.error(str(error))
        print(json.dumps(result, ensure_ascii=True, indent=2, allow_nan=False))
        return
    if args.project_a is not None or args.project_b is not None:
        if args.project_a is None or args.project_b is None:
            parser.error("--project-a and --project-b are required together")
        try:
            result = compare_request(projects, {"project_a_id": args.project_a, "project_b_id": args.project_b})
        except ValueError as error:
            parser.error(str(error))
        print(json.dumps(result, ensure_ascii=True, indent=2, allow_nan=False))
        return
    result = build_demo(projects)
    result["source_sha256"] = {
        args.data.name: hashlib.sha256(args.data.read_bytes()).hexdigest(),
        args.catalog.name: hashlib.sha256(args.catalog.read_bytes()).hexdigest(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    print(f"{len(projects)} projects; {result['compared_pair_count']} pairs checked; {len(result['nearby_comparisons'])} within 40 km.")
    print(f"Saved {args.output}")


if __name__ == "__main__":
    main()
