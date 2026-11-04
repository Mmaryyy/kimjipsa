"""Read-only Hermes tool. Worker credentials never enter the model context."""

import json
from pathlib import Path
from urllib.request import Request, build_opener, ProxyHandler, HTTPRedirectHandler


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_household(args, **kwargs):
    try:
        # This installation descriptor contains only a local token-file path.
        descriptor = json.loads(Path(__file__).with_name("bridge.json").read_text())
        token = Path(descriptor["tokenFile"]).read_text().strip()
        request = Request(
            "http://127.0.0.1:8644/hermes/read",
            data=json.dumps(args).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST",
        )
        # Do not send the local credential through proxy settings or redirects.
        with build_opener(ProxyHandler({}), NoRedirect()).open(request, timeout=35) as response:
            return response.read(2_000_000).decode()
    except Exception:
        return json.dumps({"ok": False, "error": "kimjipsa_read_unavailable"})


def register(ctx):
    ctx.register_tool(
        name="kimjipsa_read",
        toolset="kimjipsa",
        schema={
            "name": "kimjipsa_read",
            "description": "Read current shared household data from Kimjipsa Supabase. No writes or private chat/schedule contents. Load kimjipsa-supabase skill for usage.",
            "parameters": {
                "type": "object",
                "properties": {
                    "resource": {"type": "string", "enum": ["memories", "inventory", "cart", "calendar"]},
                    "start": {"type": "string", "description": "Calendar only: inclusive YYYY-MM-DD in Asia/Seoul; provide end too."},
                    "end": {"type": "string", "description": "Calendar only: inclusive YYYY-MM-DD; range at most 366 days."},
                },
                "required": ["resource"],
                "additionalProperties": False,
            },
        },
        handler=read_household,
    )
