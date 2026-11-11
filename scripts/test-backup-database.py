import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "backup", Path(__file__).with_name("backup-database.py")
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackupTests(unittest.TestCase):
    def test_success_and_failure_preserve_previous_backups(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            credentials = root / "credentials"
            credentials.touch(mode=0o600)
            directory = root / "backups"
            directory.mkdir()
            old = directory / "kimjipsa-20200101T000000000000Z.dump"
            old.write_bytes(b"previous")
            unrelated = directory / "kimjipsa-other.dump"
            unrelated.touch()
            environment = {
                "PGSERVICEFILE": str(credentials),
                "PGPASSFILE": str(credentials),
                "PGSERVICE": "test",
            }

            def dump(command, **kwargs):
                if command[0].endswith("pg_dump"):
                    self.assertIn("--exclude-table-data=public.chat_messages", command)
                    self.assertIn("--exclude-table-data=public.receipt_imports", command)
                    self.assertEqual(kwargs["env"]["PGSSLMODE"], "require")
                    filename = next(
                        argument[7:] for argument in command
                        if argument.startswith("--file=")
                    )
                    Path(filename).write_bytes(b"archive")

            with patch.dict(os.environ, environment), patch.object(
                module.subprocess, "run",
                side_effect=subprocess.CalledProcessError(1, "pg_dump"),
            ):
                with self.assertRaises(subprocess.CalledProcessError):
                    module.backup(directory, 4, "/pg/bin")
            self.assertTrue(old.exists())
            self.assertEqual(list(directory.glob("*.partial")), [])
            with patch.dict(os.environ, environment), patch.object(
                module.subprocess, "run", side_effect=dump,
            ):
                module.backup(directory, 4, "/pg/bin")
            self.assertFalse(old.exists())
            self.assertTrue(unrelated.exists())
            archive = next(path for path in directory.glob("*.dump") if path != unrelated)
            self.assertEqual(archive.stat().st_mode & 0o777, 0o600)

    def test_rejects_unapproved_retention_and_repository_destination(self):
        with self.assertRaises(ValueError):
            module.backup(Path(__file__).resolve().parents[1], 4, "/pg/bin")
        with self.assertRaises(ValueError):
            module.backup("/private/tmp/backups", 0, "/pg/bin")


if __name__ == "__main__":
    unittest.main()
