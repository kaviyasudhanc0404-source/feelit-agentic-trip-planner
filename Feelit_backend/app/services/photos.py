"""Photos: Wikipedia for exact places, Unsplash (or Wikipedia) for destination covers.

Only the image link is cached (never the image itself), so the same place
does not spend a second request against the free limits.
"""
from app.config import settings
from app.db import DAY, cached
from app.services.geo import slug
from app.services.http import get_json

NONE = {"url": None}
NOT_A_VIEW = ("map", "locator", "flag", "seal", "logo", "emblem", ".svg")
DULL = ("grayscale", "monochrome", "black and white")


def _is_view(url: str) -> bool:
    """False for locator maps, flags and logos, which some town articles use as their lead image."""
    name = url.rsplit("/", 1)[-1].lower()
    return not any(word in name for word in NOT_A_VIEW)


WIKI = {"action": "query", "format": "json", "generator": "search", "gsrlimit": 5}


def _matches(title: str, must_match: set[str] | None) -> bool:
    return not must_match or bool(must_match & set(slug(title).split("-")))


async def _wikipedia_article(title: str) -> dict | None:
    """The lead image of the article with exactly this title (following redirects such as Udhagamandalam → Ooty)."""
    data = await get_json(
        "https://en.wikipedia.org/w/api.php",
        params={"action": "query", "format": "json", "titles": title, "redirects": 1, "prop": "pageimages", "piprop": "thumbnail", "pithumbsize": 1200},
    )
    for page in (data or {}).get("query", {}).get("pages", {}).values():
        thumb = page.get("thumbnail", {}).get("source")
        if thumb and _is_view(thumb):
            return {"url": thumb, "credit": "Wikipedia", "link": f"https://en.wikipedia.org/?curid={page['pageid']}"}
    return None


async def _wikipedia(query: str, must_match: set[str] | None = None) -> dict | None:
    """The lead image of the best-matching Wikipedia article, else a matching Wikimedia Commons photo."""
    articles = await get_json(
        "https://en.wikipedia.org/w/api.php",
        params={**WIKI, "gsrsearch": query, "prop": "pageimages", "piprop": "thumbnail", "pithumbsize": 800},
    )
    if articles is None:
        return None
    pages = sorted(articles.get("query", {}).get("pages", {}).values(), key=lambda p: p["index"])
    for page in pages:
        if "thumbnail" in page and _is_view(page["thumbnail"]["source"]) and _matches(page["title"], must_match):
            return {"url": page["thumbnail"]["source"], "credit": "Wikipedia", "link": f"https://en.wikipedia.org/?curid={page['pageid']}"}

    files = await get_json(
        "https://commons.wikimedia.org/w/api.php",
        params={**WIKI, "gsrsearch": f"{query} filetype:bitmap", "gsrnamespace": 6, "prop": "imageinfo", "iiprop": "url", "iiurlwidth": 800},
    )
    for page in sorted((files or {}).get("query", {}).get("pages", {}).values(), key=lambda p: p["index"]):
        info = (page.get("imageinfo") or [{}])[0]
        if info.get("thumburl") and _is_view(info["thumburl"]) and _matches(page["title"], must_match):
            return {"url": info["thumburl"], "credit": "Wikimedia Commons", "link": info.get("descriptionurl")}
    return NONE


async def _unsplash(destination: str) -> dict | None:
    """A photo whose caption actually names the destination.

    Unsplash ranks popular photos highly even when they are of somewhere else (a famous temple
    shows up for many Tamil Nadu towns), so the caption must mention the place.
    """
    data = await get_json(
        "https://api.unsplash.com/search/photos",
        params={"query": destination, "per_page": 20, "orientation": "landscape", "content_filter": "high"},
        headers={"Authorization": f"Client-ID {settings.unsplash_access_key}"},
    )
    if data is None:
        return None
    words = {w for w in slug(destination).split("-") if len(w) > 3}
    for photo in data.get("results", []):
        caption = f"{photo.get('description') or ''} {photo.get('alt_description') or ''}".lower()
        if words & set(slug(caption).split("-")) and not any(word in caption for word in DULL):
            return {
                "url": photo["urls"]["regular"],
                "credit": f"{photo['user']['name']} / Unsplash",
                "link": f"{photo['links']['html']}?utm_source=feel_it&utm_medium=referral",
            }
    return NONE


async def place_photo(name: str, destination: str) -> dict:
    """A photo of one specific spot. Rejected unless the article is about that spot,
    so a search for a small viewpoint doesn't return the town's generic photo."""
    own_words = {w for w in slug(name).split("-") if len(w) > 3} - set(slug(destination).split("-"))
    if not own_words:
        return NONE
    return await cached(f"photo:{slug(name)}:{slug(destination)}", 30 * DAY, lambda: _wikipedia(f"{name} {destination}", own_words)) or NONE


async def cover_photo(destination: str, state: str | None = None) -> dict:
    """A wide cover image of the destination itself: a matching Unsplash photo, else the Wikipedia one."""
    async def lookup():
        photo = await _unsplash(destination)
        if photo and photo["url"]:
            return photo
        own_words = {w for w in slug(destination).split("-") if len(w) > 3}
        return await _wikipedia_article(destination) or await _wikipedia(f"{destination} {state or ''}".strip(), own_words) or photo

    return await cached(f"cover:{slug(destination)}", 30 * DAY, lookup) or NONE
