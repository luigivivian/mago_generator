"""Pre-defined biblical stories list, manual script parser, and bible constants.

Phase 1001: Biblical Reels Category — data foundation.
"""

import re
from typing import Optional


# 25 pre-defined stories: 14 Old Testament + 11 New Testament
BIBLE_STORIES = {
    # Old Testament
    "creation": {"ref": "Genesis 1-2", "title_pt": "A Criacao", "title_en": "The Creation", "title_es": "La Creacion", "testament": "OT"},
    "adam-eve": {"ref": "Genesis 3", "title_pt": "Adao e Eva", "title_en": "Adam and Eve", "title_es": "Adan y Eva", "testament": "OT"},
    "noah-ark": {"ref": "Genesis 6-9", "title_pt": "A Arca de Noe", "title_en": "Noah's Ark", "title_es": "El Arca de Noe", "testament": "OT"},
    "abraham-isaac": {"ref": "Genesis 22", "title_pt": "Abraao e Isaque", "title_en": "Abraham and Isaac", "title_es": "Abraham e Isaac", "testament": "OT"},
    "joseph-egypt": {"ref": "Genesis 37-50", "title_pt": "Jose do Egito", "title_en": "Joseph in Egypt", "title_es": "Jose en Egipto", "testament": "OT"},
    "moses-red-sea": {"ref": "Exodus 14", "title_pt": "Moises e o Mar Vermelho", "title_en": "Moses and the Red Sea", "title_es": "Moises y el Mar Rojo", "testament": "OT"},
    "moses-commandments": {"ref": "Exodus 20", "title_pt": "Os Dez Mandamentos", "title_en": "The Ten Commandments", "title_es": "Los Diez Mandamientos", "testament": "OT"},
    "david-goliath": {"ref": "1 Samuel 17", "title_pt": "Davi e Golias", "title_en": "David and Goliath", "title_es": "David y Goliat", "testament": "OT"},
    "daniel-lions": {"ref": "Daniel 6", "title_pt": "Daniel na Cova dos Leoes", "title_en": "Daniel in the Lions' Den", "title_es": "Daniel en el Foso de los Leones", "testament": "OT"},
    "jonah-whale": {"ref": "Jonas 1-4", "title_pt": "Jonas e a Baleia", "title_en": "Jonah and the Whale", "title_es": "Jonas y la Ballena", "testament": "OT"},
    "ruth-naomi": {"ref": "Ruth 1-4", "title_pt": "Rute e Noemi", "title_en": "Ruth and Naomi", "title_es": "Rut y Noemi", "testament": "OT"},
    "esther-queen": {"ref": "Esther 1-10", "title_pt": "Ester, a Rainha", "title_en": "Queen Esther", "title_es": "Ester, la Reina", "testament": "OT"},
    "elijah-prophets": {"ref": "1 Kings 18", "title_pt": "Elias e os Profetas de Baal", "title_en": "Elijah vs Prophets of Baal", "title_es": "Elias y los Profetas de Baal", "testament": "OT"},
    "samson-delilah": {"ref": "Judges 16", "title_pt": "Sansao e Dalila", "title_en": "Samson and Delilah", "title_es": "Sanson y Dalila", "testament": "OT"},
    # New Testament
    "birth-jesus": {"ref": "Luke 2", "title_pt": "O Nascimento de Jesus", "title_en": "The Birth of Jesus", "title_es": "El Nacimiento de Jesus", "testament": "NT"},
    "good-samaritan": {"ref": "Luke 10:25-37", "title_pt": "O Bom Samaritano", "title_en": "The Good Samaritan", "title_es": "El Buen Samaritano", "testament": "NT"},
    "prodigal-son": {"ref": "Luke 15:11-32", "title_pt": "O Filho Prodigo", "title_en": "The Prodigal Son", "title_es": "El Hijo Prodigo", "testament": "NT"},
    "sower-parable": {"ref": "Matthew 13:1-23", "title_pt": "Parabola do Semeador", "title_en": "Parable of the Sower", "title_es": "Parabola del Sembrador", "testament": "NT"},
    "sermon-mount": {"ref": "Matthew 5-7", "title_pt": "Sermao da Montanha", "title_en": "Sermon on the Mount", "title_es": "Sermon del Monte", "testament": "NT"},
    "water-wine": {"ref": "John 2:1-11", "title_pt": "Agua em Vinho", "title_en": "Water into Wine", "title_es": "Agua en Vino", "testament": "NT"},
    "feeding-5000": {"ref": "John 6:1-14", "title_pt": "Alimentacao dos 5000", "title_en": "Feeding of the 5000", "title_es": "Alimentacion de los 5000", "testament": "NT"},
    "walking-water": {"ref": "Matthew 14:22-33", "title_pt": "Jesus Anda sobre as Aguas", "title_en": "Walking on Water", "title_es": "Caminando sobre el Agua", "testament": "NT"},
    "lazarus": {"ref": "John 11:1-44", "title_pt": "Ressurreicao de Lazaro", "title_en": "Raising of Lazarus", "title_es": "Resurreccion de Lazaro", "testament": "NT"},
    "passion-resurrection": {"ref": "Matthew 26-28", "title_pt": "Paixao e Ressurreicao", "title_en": "Passion and Resurrection", "title_es": "Pasion y Resurreccion", "testament": "NT"},
    "mustard-seed": {"ref": "Matthew 13:31-32", "title_pt": "Parabola do Grao de Mostarda", "title_en": "Parable of the Mustard Seed", "title_es": "Parabola del Grano de Mostaza", "testament": "NT"},
}

BIBLE_VERSIONS = {
    "pt-BR": "NVI",
    "en-US": "NIV",
    "es-ES": "NVI",
}

BIBLE_HASHTAGS = ["#historiasbiblicas", "#biblia", "#fe", "#deus", "#jesus", "#versiculododia"]


def get_story_by_key(key: str) -> Optional[dict]:
    """Return a pre-defined story dict by key, or None if not found."""
    return BIBLE_STORIES.get(key)


def parse_manual_script(text: str, target_duration: int) -> dict:
    """Parse user-written script text into a RoteiroSchema-compatible dict.

    Splits by double newline or --- markers into scenes.
    Distributes duration evenly across scenes.
    """
    paragraphs = [p.strip() for p in re.split(r"\n\n+|---+", text) if p.strip()]
    duration_per_scene = target_duration / max(len(paragraphs), 1)

    cenas = []
    for i, para in enumerate(paragraphs):
        cenas.append({
            "imagem_index": i,
            "duracao_segundos": duration_per_scene,
            "narracao": para,
            "legenda_overlay": para[:100],
            "image_prompt": para[:100],
            "mood": "calm",
            "transition_in": "fade",
            "transition_out": "fade",
        })

    return {
        "titulo": paragraphs[0][:50] if paragraphs else "Historia Biblica",
        "gancho": paragraphs[0] if paragraphs else "",
        "narracao_completa": text,
        "cenas": cenas,
        "cta": "Compartilha com alguem que precisa dessa palavra hoje",
        "frase_loop": "",
        "hashtags": BIBLE_HASHTAGS,
        "caption_instagram": "",
    }
