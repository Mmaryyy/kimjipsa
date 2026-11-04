"""Prepare a persistent shared Hermes profile or a disposable private profile."""

import json
import sys
from pathlib import Path
from ruamel.yaml import YAML


def write_changed(path, text):
    if path.is_file() and path.read_text() == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    path.chmod(0o600)
    return True


def prepare(profile: Path, port: int, isolated=False):
    expected = "kimjipsa-private" if isolated else "kimjipsa"
    if profile.name != expected or profile.parent.name != "profiles":
        raise ValueError("invalid_family_profile")
    marker = profile / (".kimjipsa-managed-private" if isolated else ".kimjipsa-managed")
    if isolated and not profile.exists():
        profile.mkdir(mode=0o700)
        marker.touch(mode=0o600)
    if not marker.is_file():
        raise ValueError("family_profile_not_prepared")
    parser = YAML(typ="safe")
    parser.version = (1, 1)
    source = parser.load((profile.parent.parent / "config.yaml").read_text())
    family_config = profile.with_name("kimjipsa") / "config.yaml"
    family = {}
    if family_config.exists():
        family = parser.load(family_config.read_text()) or {}
    # Only bootstrap from default; other bots' model changes must not overwrite this family.
    model = family.get("model", source.get("model"))
    if isinstance(model, str):
        model = {"default": model}
    if not isinstance(model, dict) or not model.get("default"):
        raise ValueError("local_model_missing")
    root = Path(__file__).resolve().parents[1]
    target = profile / "config.yaml"
    config = {} if isolated or not target.exists() else parser.load(target.read_text()) or {}
    upgraded = (profile / ".kimjipsa-memory-v2").exists()
    config["model"] = model
    config.setdefault("gateway", {})["standalone"] = True
    config.setdefault("platforms", {})["api_server"] = {"enabled": True, "host": "127.0.0.1", "port": port}
    config.setdefault("platform_toolsets", {})["api_server"] = ["no_mcp"] if isolated else ["memory", "skills", "kimjipsa", "no_mcp"]
    config.setdefault("display", {})["interim_assistant_messages"] = False
    config.setdefault("agent", {})["max_turns"] = 2 if isolated else 10
    custom_providers = family.get("custom_providers", source.get("custom_providers"))
    if custom_providers:
        config["custom_providers"] = custom_providers
    changed = False
    if isolated:
        config["memory"] = {"memory_enabled": False, "user_profile_enabled": False, "nudge_interval": 0}
        config["mcp_servers"] = {}
        config["plugins"] = {"enabled": []}
    else:
        if not upgraded:
            config.setdefault("memory", {}).update({"memory_enabled": True, "user_profile_enabled": True, "nudge_interval": 10})
            changed |= write_changed(profile / "SOUL.md", (root / "hermes-soul.md").read_text())
        tools = config["platform_toolsets"].setdefault("discord", ["memory", "skills", "kimjipsa"])
        if isinstance(tools, list):
            for name in ["memory", "skills", "kimjipsa"]:
                if name not in tools:
                    tools.append(name)
        enabled = config.setdefault("plugins", {}).setdefault("enabled", [])
        if "kimjipsa-read" not in enabled:
            enabled.append("kimjipsa-read")
        plugin = profile / "plugins/kimjipsa-read"
        for name in ["plugin.yaml", "__init__.py"]:
            changed |= write_changed(plugin / name, (root / "hermes-plugin" / name).read_text())
        changed |= write_changed(plugin / "bridge.json", json.dumps({"tokenFile": str(root / ".runtime/read-tool-token")}) + "\n")
        changed |= write_changed(profile / "skills/kimjipsa-supabase/SKILL.md", (root / "skills/kimjipsa-supabase/SKILL.md").read_text())
    changed |= write_changed(target, json.dumps(config, ensure_ascii=False, indent=2) + "\n")
    if not isolated:
        (profile / ".kimjipsa-memory-v2").touch(mode=0o600)
    return changed


if __name__ == "__main__":
    try:
        print(json.dumps({"changed": prepare(Path(sys.argv[1]), int(sys.argv[2]), len(sys.argv) > 3 and sys.argv[3] == "isolated")}))
    except Exception:
        sys.stderr.write("family_profile_configuration_failed\n")
        sys.exit(1)
