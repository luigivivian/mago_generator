"""Client for bolls.life Bible API — fetches real Bible verses for script generation.

API: https://bolls.life/get-chapter/{translation}/{book_id}/{chapter}/
No auth required. Supports NVIPT (NVI Portuguese), ARA, KJV, etc.
"""

import logging
import re

import httpx

logger = logging.getLogger("clip-flow.reels.bible_api")

BASE_URL = "https://bolls.life"

# Map version names to bolls.life translation slugs
VERSION_MAP = {
    "NVI": "NVIPT",
    "ARA": "ARA",
    "ACF": "ACF11",
    "KJV": "KJV",
    "NVT": "NVT",
    "NTLH": "NTLH",
    "NAA": "NAA",
}

# Bible book names → bolls.life book IDs (1-66 canonical order)
# bolls.life uses sequential IDs: Genesis=1, Exodus=2, ..., Revelation=66
BOOK_ID = {
    # English names
    "genesis": 1, "exodus": 2, "leviticus": 3, "numbers": 4,
    "deuteronomy": 5, "joshua": 6, "judges": 7, "ruth": 8,
    "1 samuel": 9, "2 samuel": 10, "1 kings": 11, "2 kings": 12,
    "1 chronicles": 13, "2 chronicles": 14, "ezra": 15, "nehemiah": 16,
    "esther": 17, "job": 18, "psalms": 19, "proverbs": 20,
    "ecclesiastes": 21, "song of solomon": 22, "isaiah": 23, "jeremiah": 24,
    "lamentations": 25, "ezekiel": 26, "daniel": 27, "hosea": 28,
    "joel": 29, "amos": 30, "obadiah": 31, "jonah": 32,
    "micah": 33, "nahum": 34, "habakkuk": 35, "zephaniah": 36,
    "haggai": 37, "zechariah": 38, "malachi": 39,
    "matthew": 40, "mark": 41, "luke": 42, "john": 43,
    "acts": 44, "romans": 45, "1 corinthians": 46, "2 corinthians": 47,
    "galatians": 48, "ephesians": 49, "philippians": 50, "colossians": 51,
    "1 thessalonians": 52, "2 thessalonians": 53, "1 timothy": 54,
    "2 timothy": 55, "titus": 56, "philemon": 57, "hebrews": 58,
    "james": 59, "1 peter": 60, "2 peter": 61, "1 john": 62,
    "2 john": 63, "3 john": 64, "jude": 65, "revelation": 66,
}


def _resolve_book_id(book_name: str) -> int:
    """Resolve a book name (English) to bolls.life book ID."""
    key = book_name.strip().lower()
    if key in BOOK_ID:
        return BOOK_ID[key]
    # Partial match
    for name, bid in BOOK_ID.items():
        if key in name or name in key:
            return bid
    raise ValueError(f"Unknown Bible book: {book_name}")


def parse_ref(ref: str) -> list[tuple[int, int, int | None, int | None]]:
    """Parse a Bible reference into (book_id, chapter, verse_start, verse_end) tuples.

    Supports:
      - "Genesis 1"           → [(1, 1, None, None)]
      - "Genesis 1-2"         → [(1, 1, None, None), (1, 2, None, None)]
      - "Luke 10:25-37"       → [(42, 10, 25, 37)]
      - "Matthew 26-28"       → [(40, 26, ...), (40, 27, ...), (40, 28, ...)]
      - "Ephesians 6:10-18"   → [(49, 6, 10, 18)]
    """
    ref = ref.strip()
    m = re.match(r"^(.+?)\s+(\d+)(?::(\d+))?(?:\s*-\s*(\d+))?$", ref)
    if not m:
        raise ValueError(f"Cannot parse Bible reference: {ref}")

    book = m.group(1)
    book_id = _resolve_book_id(book)
    ch_start = int(m.group(2))
    verse_or_end = m.group(3)  # verse start (after :) or None
    range_end = m.group(4)     # number after -

    if verse_or_end:
        # Format: Book Ch:V1-V2
        v_start = int(verse_or_end)
        v_end = int(range_end) if range_end else v_start
        return [(book_id, ch_start, v_start, v_end)]
    elif range_end:
        # Format: Book Ch1-Ch2 (multiple chapters)
        ch_end = int(range_end)
        return [(book_id, ch, None, None) for ch in range(ch_start, ch_end + 1)]
    else:
        # Format: Book Ch (single chapter)
        return [(book_id, ch_start, None, None)]


async def fetch_chapter(version: str, book_id: int, chapter: int) -> list[dict]:
    """Fetch all verses of a chapter. Returns list of {verse, text}."""
    api_version = VERSION_MAP.get(version.upper(), version)
    url = f"{BASE_URL}/get-chapter/{api_version}/{book_id}/{chapter}/"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    return [{"number": v["verse"], "text": v["text"]} for v in data]


async def fetch_verses(version: str, book_id: int, chapter: int,
                       v_start: int, v_end: int) -> list[dict]:
    """Fetch a verse range from a chapter."""
    verses = await fetch_chapter(version, book_id, chapter)
    return [v for v in verses if v_start <= v["number"] <= v_end]


async def fetch_ref_text(ref: str, version: str = "NVI", max_chapters: int = 5) -> str:
    """Fetch the actual Bible text for a reference string.

    Returns concatenated verses as a single text block with verse markers.
    Caps at max_chapters to avoid huge prompts.
    """
    try:
        parts = parse_ref(ref)
    except ValueError as e:
        logger.warning("Could not parse ref '%s': %s", ref, e)
        return ""

    if len(parts) > max_chapters:
        logger.info("Ref '%s' spans %d chapters, capping at %d", ref, len(parts), max_chapters)
        parts = parts[:max_chapters]

    text_blocks = []
    for book_id, chapter, v_start, v_end in parts:
        try:
            if v_start is not None and v_end is not None:
                verses = await fetch_verses(version, book_id, chapter, v_start, v_end)
                header = f"--- {ref} (cap. {chapter}:{v_start}-{v_end}) ---"
            else:
                verses = await fetch_chapter(version, book_id, chapter)
                header = f"--- {ref} (cap. {chapter}) ---"

            if verses:
                lines = [f"{v['number']}. {v['text']}" for v in verses]
                text_blocks.append(f"{header}\n" + "\n".join(lines))
            else:
                logger.warning("No verses returned for book %d ch.%d", book_id, chapter)
        except Exception as e:
            logger.error("Failed to fetch book %d ch.%d: %s", book_id, chapter, e)

    return "\n\n".join(text_blocks)
