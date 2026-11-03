"""Call the installed Hermes search backend with only a user-approved search phrase."""
import contextlib
import json
import logging
import os
import sys
from urllib.parse import urlsplit


def main():
    # Hermes' existing Python runtime provides its configured search backend and auth.
    # Suppress provider logs: they may contain query text or credential-bearing endpoints.
    logging.disable(logging.CRITICAL)
    os.environ["WEB_TOOLS_DEBUG"] = "false"
    with open(os.devnull, "w") as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        sys.path.insert(0, sys.argv[1])
        import hermes_bootstrap  # noqa: F401 - activate the installed Hermes environment
        from tools.web_tools import web_search_tool
        # Bootstrap may re-exec Python; consume stdin only after it has settled.
        query = json.loads(sys.stdin.read()).get("query", "")
        if not isinstance(query, str) or not 1 <= len(query.strip()) <= 500:
            raise ValueError("invalid_search")
        response = json.loads(web_search_tool(query=query, limit=5))
    if not response.get("success"):
        raise ValueError("web_search_unavailable")
    results = []
    for item in response.get("data", {}).get("web", [])[:5]:
        url = str(item.get("url", ""))
        parsed = urlsplit(url)
        if len(url) > 2000 or parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            continue
        results.append({"title": str(item.get("title", ""))[:300], "url": url, "description": str(item.get("description", ""))[:2500]})
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.stderr.write("web_search_unavailable\n")
        sys.exit(1)
