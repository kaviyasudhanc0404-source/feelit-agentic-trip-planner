"""Live web search through Tavily, cached for a day to stay inside the free quota."""
from app.config import settings
from app.db import DAY, cached
from app.services.geo import slug
from app.services.http import post_json


async def web_search(query: str, max_results: int = 5) -> list[dict]:
    async def lookup():
        data = await post_json(
            "https://api.tavily.com/search",
            headers={"Authorization": f"Bearer {settings.tavily_api_key}"},
            json={"query": query, "max_results": max_results, "search_depth": "basic"},
            timeout=30,
        )
        if data is None:
            return None
        return [{"title": r["title"], "url": r["url"], "content": r["content"][:900]} for r in data.get("results", [])]

    return await cached(f"web:{slug(query)[:120]}", DAY, lookup) or []


def as_text(results: list[dict]) -> str:
    """Search results as compact text for an AI prompt."""
    return "\n".join(f"- {r['title']}: {r['content']}" for r in results) or "(no results)"
