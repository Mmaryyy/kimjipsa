"""BOT-05/10/12/13: disposable profile tests; never accesses the user's Hermes home."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("prepare_profile", Path(__file__).with_name("prepare-profile.py"))
prepare_profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare_profile)


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "config.yaml").write_text(json.dumps({"model": {"default": "fixture-model"}}))
        self.profile = self.root / "profiles/kimjipsa"
        self.profile.mkdir(parents=True)
        (self.profile / ".kimjipsa-managed").touch()
        (self.profile / "memories").mkdir()
        (self.profile / "memories/MEMORY.md").write_text("기존에 기억한 가족 선호")
        (self.profile / "config.yaml").write_text(json.dumps({
            "platforms": {"discord": {"enabled": True, "token": "fixture-only"}},
            "mcp_servers": {"operator-tool": {"url": "https://example.invalid/mcp"}},
            "plugins": {"enabled": ["operator-plugin"]},
        }))

    def tearDown(self):
        self.temp.cleanup()

    def test_shared_memory_and_discord_survive_repeated_preparation(self):
        self.assertTrue(prepare_profile.prepare(self.profile, 8643))
        self.assertFalse(prepare_profile.prepare(self.profile, 8643))
        config = json.loads((self.profile / "config.yaml").read_text())
        self.assertEqual(config["model"]["default"], "fixture-model")
        self.assertTrue(config["memory"]["memory_enabled"])
        self.assertEqual(config["platforms"]["discord"]["token"], "fixture-only")
        self.assertEqual((self.profile / "memories/MEMORY.md").read_text(), "기존에 기억한 가족 선호")
        self.assertIn("operator-plugin", config["plugins"]["enabled"])
        self.assertIn("no_mcp", config["platform_toolsets"]["api_server"])
        self.assertTrue((self.profile / "skills/kimjipsa-supabase/SKILL.md").is_file())

    def test_hermes_memory_switch_and_custom_soul_remain_operator_controlled(self):
        prepare_profile.prepare(self.profile, 8643)
        config = json.loads((self.profile / "config.yaml").read_text())
        config["memory"]["memory_enabled"] = False
        config["memory"]["user_profile_enabled"] = False
        (self.profile / "config.yaml").write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n")
        (self.profile / "SOUL.md").write_text("사용자가 변경한 집사 성격")
        prepare_profile.prepare(self.profile, 8643)
        self.assertFalse(json.loads((self.profile / "config.yaml").read_text())["memory"]["memory_enabled"])
        self.assertEqual((self.profile / "SOUL.md").read_text(), "사용자가 변경한 집사 성격")

    def test_private_profile_has_no_shared_memory_skills_or_plugins(self):
        private = self.profile.with_name("kimjipsa-private")
        prepare_profile.prepare(private, 8645, True)
        config = json.loads((private / "config.yaml").read_text())
        self.assertFalse(config["memory"]["memory_enabled"])
        self.assertFalse(config["memory"]["user_profile_enabled"])
        self.assertEqual(config["plugins"]["enabled"], [])
        self.assertFalse((private / "memories").exists())
        self.assertFalse((private / "skills/kimjipsa-supabase").exists())
        self.assertNotIn("discord", config["platforms"])

    def test_does_not_adopt_an_existing_unmanaged_private_profile(self):
        private = self.profile.with_name("kimjipsa-private")
        private.mkdir()
        with self.assertRaises(ValueError):
            prepare_profile.prepare(private, 8645, True)

    def test_bot05_family_model_survives_default_model_changes(self):
        prepare_profile.prepare(self.profile, 8643)
        config = json.loads((self.profile / "config.yaml").read_text())
        config["model"] = {"default": "family-terra", "provider": "family-provider"}
        config["agent"]["reasoning_effort"] = "high"
        config["custom_providers"] = [{"name": "family-provider"}]
        (self.profile / "config.yaml").write_text(json.dumps(config))
        (self.root / "config.yaml").write_text(json.dumps({
            "model": {"default": "default-sol", "provider": "default-provider"},
            "custom_providers": [{"name": "default-provider"}],
        }))

        prepare_profile.prepare(self.profile, 8643)
        shared = json.loads((self.profile / "config.yaml").read_text())
        self.assertEqual(shared["model"], config["model"])
        self.assertEqual(shared["agent"]["reasoning_effort"], "high")
        self.assertEqual(shared["custom_providers"], config["custom_providers"])

        private = self.profile.with_name("kimjipsa-private")
        prepare_profile.prepare(private, 8645, True)
        isolated = json.loads((private / "config.yaml").read_text())
        self.assertEqual(isolated["model"], config["model"])
        self.assertEqual(isolated["custom_providers"], config["custom_providers"])
        self.assertFalse(isolated["memory"]["memory_enabled"])
        self.assertNotIn("discord", isolated["platforms"])


if __name__ == "__main__":
    unittest.main()
