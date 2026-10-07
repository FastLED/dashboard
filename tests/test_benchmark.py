import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "benchmark_run", Path(__file__).resolve().parents[1] / "benchmark/run.py"
)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class SizeParsingTests(unittest.TestCase):
    def test_latest_seven_stable_tags(self):
        tags = ["3.9.20"] + [f"3.10.{i}" for i in range(7)] + ["3.10.7-rc1"]
        self.assertEqual(runner.latest_releases(tags), [f"3.10.{i}" for i in range(7)])

    def test_numeric_release_order(self):
        tags = [f"3.10.{i}" for i in range(11)]
        self.assertEqual(
            runner.latest_releases(tags), [f"3.10.{i}" for i in range(4, 11)]
        )

    def test_exact_flash_and_static_ram(self):
        self.assertEqual(
            runner.parse_size(
                "build succeeded in 2.3s (flash: 3922 bytes, ram: 266 bytes)"
            ),
            (3922, 266),
        )

    def test_missing_measurements_are_rejected(self):
        with self.assertRaises(ValueError):
            runner.parse_size("No ELF measurement available")

    def test_rounded_sizes_are_not_accepted(self):
        with self.assertRaises(ValueError):
            runner.parse_size("Flash: 3.8KB RAM: 0.2KB")

    def test_canonical_workload_has_no_serial(self):
        sketch = (runner.ROOT / "benchmark/Blink.ino").read_text()
        self.assertNotIn("Serial", sketch)
        self.assertIn("NEOPIXEL, 3", sketch)


if __name__ == "__main__":
    unittest.main()
