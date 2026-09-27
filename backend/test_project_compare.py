import math
import unittest
from copy import deepcopy

from project_compare import EARTH_RADIUS_KM, build_demo, compare_projects, compare_request, haversine_km, load_projects


def project(project_id, locations, years=(2030,)):
    return {
        "project_id": project_id,
        "in_service_years": list(years),
        "coordinates_complete": True,
        "stations": [{"substation_id": i + 1, "latitude": lat, "longitude": lon} for i, (lat, lon) in enumerate(locations)],
    }


class ComparisonTests(unittest.TestCase):
    def test_uses_every_station_not_first_or_center(self):
        result = compare_projects(project(1, [(0, 0), (40, -80)]), project(2, [(50, -100), (40.01, -80)]))
        self.assertEqual(result["status"], "near")
        self.assertEqual([station["substation_id"] for station in result["nearest_stations"]], [2, 2])
        self.assertAlmostEqual(result["distance_km"], 1.111951, places=5)

    def test_shared_station_is_zero_not_missing(self):
        result = compare_projects(project(1, [(1, 2)]), project(2, [(1, 2)]))
        self.assertEqual((result["distance_km"], result["status"], result["year_gap"]), (0, "near", 0))

    def test_40_km_threshold_before_rounding(self):
        first = project(1, [(0, 0)])
        for distance, expected in [(39.9999999, "near"), (40, "near"), (40.0000001, "far")]:
            with self.subTest(distance=distance):
                longitude = math.degrees(distance / EARTH_RADIUS_KM)
                result = compare_projects(first, project(2, [(0, longitude)]))
                self.assertEqual(result["status"], expected)

    def test_years_missing_and_multiple_are_not_guessed(self):
        first = project(1, [(0, 0)], (2028, 2030))
        result = compare_projects(first, project(2, [(0, 0)], (2029,)))
        self.assertIsNone(result["year_gap"])
        self.assertEqual(result["year_gap_range"], [1, 1])
        result = compare_projects(first, project(2, [(0, 0)], ()))
        self.assertIsNone(result["year_gap"])
        self.assertIsNone(result["year_gap_range"])

    def test_incomplete_coordinates_cannot_be_declared_far(self):
        first = project(1, [(0, 0)])
        first["coordinates_complete"] = False
        result = compare_projects(first, project(2, [(50, 50)]))
        self.assertEqual(result["status"], "unknown")
        self.assertIsNone(result["distance_km"])

    def test_request_ids_and_reversed_station_order(self):
        first, second = project(1, [(0, 0)]), project(2, [(1, 1)])
        projects = [first, second]
        for payload in [{}, {"project_a_id": True, "project_b_id": 2}, {"project_a_id": 1, "project_b_id": 999}, {"project_a_id": 1, "project_b_id": 1}]:
            with self.assertRaises(ValueError):
                compare_request(projects, payload)
        forward = compare_request(projects, {"project_a_id": 1, "project_b_id": 2})
        reverse = compare_request(projects, {"project_a_id": 2, "project_b_id": 1})
        self.assertEqual(forward["distance_km"], reverse["distance_km"])
        self.assertEqual(forward["nearest_stations"], list(reversed(reverse["nearest_stations"])))

    def test_sparse_export_checks_every_pair(self):
        projects = [project(1, [(0, 0)]), project(2, [(0, 0.1)]), project(3, [(30, 30)])]
        before = deepcopy(projects)
        demo = build_demo(list(reversed(projects)))
        self.assertEqual(demo["compared_pair_count"], 3)
        self.assertEqual(set(demo["nearby_comparisons"]), {"1:2"})
        self.assertEqual(projects, before)

    def test_multiple_selected_projects_compare_each_pair_once(self):
        projects = [project(i, [(0, i / 10)]) for i in range(1, 5)]
        result = compare_request(projects, {"project_ids": [4, 2, 1, 3]})
        pairs = [(row["project_a_id"], row["project_b_id"]) for row in result["comparisons"]]
        self.assertEqual(pairs, [(4, 2), (4, 1), (4, 3), (2, 1), (2, 3), (1, 3)])
        self.assertEqual(len({frozenset(pair) for pair in pairs}), 6)
        self.assertEqual([p["project_id"] for p in result["projects"]], [4, 2, 1, 3])
        smaller = compare_request(projects, {"project_ids": [4, 1, 3]})
        self.assertEqual(len(smaller["comparisons"]), 3)
        self.assertTrue(all(2 not in (row["project_a_id"], row["project_b_id"]) for row in smaller["comparisons"]))

    def test_multiple_selection_validates_all_ids(self):
        projects = [project(1, [(0, 0)]), project(2, [(1, 1)])]
        for ids in [None, "1,2", [], [1], [1, 1], [1, 999], [True, 2], ["1", 2]]:
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                compare_request(projects, {"project_ids": ids})
        with self.assertRaises(ValueError):
            compare_request(projects, None)

    def test_antipodal_distance_is_finite(self):
        self.assertAlmostEqual(haversine_km({"latitude": 0, "longitude": 0}, {"latitude": 0, "longitude": 180}), math.pi * EARTH_RADIUS_KM)

    def test_real_input_ids_and_owner_mapping(self):
        projects = load_projects()
        self.assertEqual(len(projects), 635)
        self.assertEqual(sum(len(p["stations"]) for p in projects), 1289)
        self.assertTrue(all(p["coordinates_complete"] for p in projects))
        self.assertEqual(sum(p["utility"] is not None for p in projects), 479)
        self.assertEqual(projects[3]["project_name"], "Rebuild Hornertown - Hathaway 230 kV")
        self.assertEqual(projects[3]["in_service_years"], [2026])


if __name__ == "__main__":
    unittest.main()
