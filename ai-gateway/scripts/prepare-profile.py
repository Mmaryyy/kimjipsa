"""Use the local Hermes model in the dedicated family profile, without copying history."""

import json
import os
import sys
from pathlib import Path

from ruamel.yaml import YAML


def prepare(profile: Path, port: int):
    if profile.name != "kimjipsa" or profile.parent.name != "profiles":
        raise ValueError("invalid_family_profile")
    if not (profile / ".kimjipsa-managed").is_file():
        raise ValueError("family_profile_not_prepared")
    parser = YAML(typ="safe")
    parser.version = (1, 1)
    source = parser.load((profile.parent.parent / "config.yaml").read_text())
    model = source.get("model")
    if isinstance(model, str):
        model = {"default": model}
    if not isinstance(model, dict) or not model.get("default"):
        raise ValueError("local_model_missing")
    config = {
        "model": model,
        "gateway": {"standalone": True},
        "platforms": {"api_server": {"enabled": True, "host": "127.0.0.1", "port": port}},
        "platform_toolsets": {"api_server": []},
        "mcp_servers": {},
        "memory": {"memory_enabled": False, "user_profile_enabled": False, "nudge_interval": 0},
        "display": {"interim_assistant_messages": False},
        "agent": {"max_turns": 2},
    }
    # Named model endpoints belong to the model configuration, not the personal agent context.
    if source.get("custom_providers"):
        config["custom_providers"] = source["custom_providers"]
    target = profile / "config.yaml"
    target.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n")
    os.chmod(target, 0o600)


if __name__ == "__main__":
    try:
        prepare(Path(sys.argv[1]), int(sys.argv[2]))
    except Exception:
        # Config/provider exceptions may include credential-bearing endpoints.
        sys.stderr.write("family_profile_configuration_failed\n")
        sys.exit(1)
