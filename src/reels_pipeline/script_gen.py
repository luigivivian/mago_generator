"""Reels script generation — Gemini multimodal with structured JSON output."""

import json
import logging
from pathlib import Path

from google.genai import types

from src.llm_client import _get_client
from src.reels_pipeline.bible_stories import (
    BIBLE_STORIES, BIBLE_VERSIONS, BIBLE_HASHTAGS,
    parse_manual_script, get_story_by_key,
)
from src.reels_pipeline.config import (
    REELS_SCRIPT_LANGUAGE,
    REELS_SCRIPT_MODEL,
)

logger = logging.getLogger("clip-flow.reels.script_gen")

# Structured JSON schema for Gemini response_schema (per RESEARCH Pattern 2)
ROTEIRO_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "titulo": {"type": "STRING"},
        "gancho": {"type": "STRING"},
        "narracao_completa": {"type": "STRING"},
        "cenas": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "imagem_index": {"type": "INTEGER"},
                    "duracao_segundos": {"type": "NUMBER"},
                    "narracao": {"type": "STRING"},
                    "legenda_overlay": {"type": "STRING"},
                },
                "required": ["imagem_index", "duracao_segundos", "narracao", "legenda_overlay"],
            },
        },
        "cta": {"type": "STRING"},
        "frase_loop": {"type": "STRING"},
        "hashtags": {"type": "ARRAY", "items": {"type": "STRING"}},
        "caption_instagram": {"type": "STRING"},
    },
    "required": [
        "titulo", "gancho", "narracao_completa", "cenas",
        "cta", "frase_loop", "hashtags", "caption_instagram",
    ],
}

# Language-specific system prompt templates
_SYSTEM_PROMPTS = {
    "pt-BR": """Voce e um roteirista especialista em conteudo viral para Instagram Reels no Brasil.

Regras:
- Gancho forte nos primeiros 3 segundos para prender a atencao
- Cada cena deve ter entre 3-6 segundos de duracao
- Narracao de cada cena: maximo 15 palavras
- legenda_overlay de cada cena: descricao visual detalhada do cenario (15-30 palavras, ex: 'mago idoso meditando no topo de montanha com neblina ao amanhecer'). Sera usado como prompt para gerar a imagem da cena
- CTA final claro e direto
- NUNCA use termos de Star Wars (padawan, jedi, force). Para se dirigir ao espectador use expressoes de mago/feiticeiro: "meu jovem bruxo", "jovem feiticeiro", "meu caro aprendiz", "nobre aventureiro", "jovem mago"
- Linguagem PT-BR coloquial, tom {tom}
- Duracao total alvo: {duracao}s
- Nicho: {nicho}
- Keywords: {keywords}
- CTA padrao: {cta}

ESTRUTURA OBRIGATÓRIA DO ROTEIRO (5 fases):
1. GANCHO (0-3s): Primeira frase impactante, SEM saudação. Crie um gap de informação que obrigue o espectador a continuar.
2. CONTEXTO (3-5s): Por que o espectador deveria se importar. Use prova social ou conexão emocional.
3. CONTEÚDO (5-25s): Entregue o valor prometido no gancho. UMA mensagem central por vídeo. Ritmo acelerado, sem pausas mortas.
4. PAYOFF (penúltimos segundos): Entregue a promessa do gancho. Momento de satisfação que gera saves e shares.
5. LOOP/CTA (últimos segundos): A frase final deve fluir imperceptivelmente de volta ao gancho — o espectador não deve perceber onde o vídeo termina e recomeça.

A primeira cena SEMPRE é o gancho. A última cena SEMPRE termina com frase que conecta ao gancho para criar loop.

TÉCNICA DE LOOP VERBAL (OBRIGATÓRIO):
O campo frase_loop deve conter uma frase curta (3-8 palavras) que cria curiosidade e reconecta ao gancho inicial. NÃO repita o CTA — a frase_loop é uma TRANSIÇÃO que faz o espectador querer rever o início.
Exemplo: se o gancho é "Acordar sem energia é um feitiço terrível!" a frase_loop pode ser "E por falar em feitiço..."
A frase_loop NÃO deve aparecer na narracao_completa nem nas cenas — será adicionada automaticamente ao final do vídeo.

SEO DE VOZ (OBRIGATÓRIO):
Fale as palavras-chave principais do tema em voz alta na narração, especialmente nos primeiros 5 segundos. TikTok e YouTube indexam o áudio falado — keywords ditas em voz alta melhoram a descoberta orgânica.

{hook_type_instruction}{image_instruction}
Crie um roteiro que:
1. {cena_instruction}
2. Distribua a narracao entre as cenas de forma natural
3. Crie um gancho irresistivel
4. Termine com CTA forte
5. Gere hashtags relevantes e caption completo para o Instagram""",

    "en-US": """You are an expert scriptwriter for viral Instagram Reels content.

Rules:
- Strong hook in the first 3 seconds to grab attention
- Each scene should be 3-6 seconds long
- Narration per scene: max 15 words
- legenda_overlay for each scene: detailed visual description of the setting (15-30 words, e.g. 'old wizard meditating on mountaintop with fog at sunrise'). This will be used as a prompt to generate the scene image
- Clear and direct final CTA
- Casual {tom} tone
- Target duration: {duracao}s
- Niche: {nicho}
- Keywords: {keywords}
- Default CTA: {cta}

MANDATORY SCRIPT STRUCTURE (5 phases):
1. HOOK (0-3s): First impactful sentence, NO greeting. Create an information gap that forces the viewer to continue.
2. CONTEXT (3-5s): Why the viewer should care. Use social proof or emotional connection.
3. CONTENT (5-25s): Deliver the value promised in the hook. ONE central message per video. Fast pace, no dead pauses.
4. PAYOFF (second-to-last seconds): Deliver on the hook's promise. Moment of satisfaction that generates saves and shares.
5. LOOP/CTA (last seconds): The final sentence should flow imperceptibly back to the hook — the viewer should not notice where the video ends and restarts.

The first scene is ALWAYS the hook. The last scene ALWAYS ends with a phrase that connects to the hook to create a loop.

VERBAL LOOP TECHNIQUE (MANDATORY):
The frase_loop field must contain a short phrase (3-8 words) that creates curiosity and reconnects to the opening hook. Do NOT repeat the CTA — frase_loop is a TRANSITION that makes the viewer want to rewatch.
Example: if the hook is "Nobody talks about this but..." the frase_loop could be "And speaking of things nobody mentions..."
frase_loop must NOT appear in narracao_completa or in the scenes — it will be automatically appended to the end of the video.

VOICE SEO (MANDATORY):
Speak the main keywords of the topic out loud in the narration, especially in the first 5 seconds.

{hook_type_instruction}{image_instruction}
Create a script that:
1. {cena_instruction}
2. Distributes narration naturally across scenes
3. Creates an irresistible hook
4. Ends with a strong CTA
5. Generates relevant hashtags and a complete Instagram caption""",

    "es-ES": """Eres un guionista experto en contenido viral para Instagram Reels.

Reglas:
- Gancho fuerte en los primeros 3 segundos para captar la atencion
- Cada escena debe durar entre 3-6 segundos
- Narracion por escena: maximo 15 palabras
- legenda_overlay de cada escena: descripcion visual detallada del escenario (15-30 palabras, ej: 'mago anciano meditando en la cima de una montana con niebla al amanecer'). Se usara como prompt para generar la imagen de la escena
- CTA final claro y directo
- Lenguaje coloquial, tono {tom}
- Duracion objetivo: {duracao}s
- Nicho: {nicho}
- Keywords: {keywords}
- CTA predeterminado: {cta}

ESTRUTURA OBRIGATÓRIA DO ROTEIRO (5 fases):
1. GANCHO (0-3s): Primeira frase impactante, SEM saudação. Crie um gap de informação que obrigue o espectador a continuar.
2. CONTEXTO (3-5s): Por que o espectador deveria se importar. Use prova social ou conexão emocional.
3. CONTEÚDO (5-25s): Entregue o valor prometido no gancho. UMA mensagem central por vídeo. Ritmo acelerado, sem pausas mortas.
4. PAYOFF (penúltimos segundos): Entregue a promessa do gancho. Momento de satisfação que gera saves e shares.
5. LOOP/CTA (últimos segundos): A frase final deve fluir imperceptivelmente de volta ao gancho — o espectador não deve perceber onde o vídeo termina e recomeça.

A primeira cena SEMPRE é o gancho. A última cena SEMPRE termina com frase que conecta ao gancho para criar loop.

TÉCNICA DE LOOP VERBAL (OBRIGATÓRIO):
O campo frase_loop deve conter uma frase curta (3-8 palavras) que cria curiosidade e reconecta ao gancho inicial. NÃO repita o CTA — a frase_loop é uma TRANSIÇÃO que faz o espectador querer rever o início.
Exemplo: se o gancho é "Acordar sem energia é um feitiço terrível!" a frase_loop pode ser "E por falar em feitiço..."
A frase_loop NÃO deve aparecer na narracao_completa nem nas cenas — será adicionada automaticamente ao final do vídeo.

SEO DE VOZ (OBRIGATÓRIO):
Fale as palavras-chave principais do tema em voz alta na narração, especialmente nos primeiros 5 segundos. TikTok e YouTube indexam o áudio falado — keywords ditas em voz alta melhoram a descoberta orgânica.

{hook_type_instruction}{image_instruction}
Crea un guion que:
1. {cena_instruction}
2. Distribuya la narracion entre las escenas de forma natural
3. Cree un gancho irresistible
4. Termine con un CTA fuerte
5. Genere hashtags relevantes y un caption completo para Instagram""",
}

# Fallback for unsupported languages: use English template with language instruction
_SYSTEM_PROMPT_FALLBACK = """You are an expert scriptwriter for viral Instagram Reels content.
IMPORTANT: Write ALL narration, captions, hashtags, and CTA in {language}.

Rules:
- Strong hook in the first 3 seconds to grab attention
- Each scene should be 3-6 seconds long
- Narration per scene: max 15 words
- legenda_overlay for each scene: detailed visual description of the setting (15-30 words). This will be used as a prompt to generate the scene image. Write legenda_overlay in English regardless of output language.
- Clear and direct final CTA
- Casual {tom} tone
- Target duration: {duracao}s
- Niche: {nicho}
- Keywords: {keywords}
- Default CTA: {cta}

ESTRUTURA OBRIGATÓRIA DO ROTEIRO (5 fases):
1. GANCHO (0-3s): Primeira frase impactante, SEM saudação. Crie um gap de informação que obrigue o espectador a continuar.
2. CONTEXTO (3-5s): Por que o espectador deveria se importar. Use prova social ou conexão emocional.
3. CONTEÚDO (5-25s): Entregue o valor prometido no gancho. UMA mensagem central por vídeo. Ritmo acelerado, sem pausas mortas.
4. PAYOFF (penúltimos segundos): Entregue a promessa do gancho. Momento de satisfação que gera saves e shares.
5. LOOP/CTA (últimos segundos): A frase final deve fluir imperceptivelmente de volta ao gancho — o espectador não deve perceber onde o vídeo termina e recomeça.

A primeira cena SEMPRE é o gancho. A última cena SEMPRE termina com frase que conecta ao gancho para criar loop.

VERBAL LOOP TECHNIQUE (MANDATORY):
The frase_loop field must contain a short phrase (3-8 words) that creates curiosity and reconnects to the opening hook. Do NOT repeat the CTA — frase_loop is a TRANSITION that makes the viewer want to rewatch.
Example: if the hook is "Nobody talks about this but..." the frase_loop could be "And speaking of things nobody mentions..."
frase_loop must NOT appear in narracao_completa or in the scenes — it will be automatically appended to the end of the video.

VOICE SEO (MANDATORY):
Speak the main keywords of the topic out loud in the narration, especially in the first 5 seconds.

{hook_type_instruction}{image_instruction}
Create a script that:
1. {cena_instruction}
2. Distributes narration naturally across scenes
3. Creates an irresistible hook
4. Ends with a strong CTA
5. Generates relevant hashtags and a complete Instagram caption"""


# Biblical narration system prompts — parallel to _SYSTEM_PROMPTS but with guardrails
_BIBLE_SYSTEM_PROMPTS = {
    "pt-BR": """Voce e um narrador biblico extraordinario, com o dom de transportar o ouvinte para dentro da historia sagrada. Seu objetivo e fazer a pessoa SENTIR que estava la, vivendo cada momento.

REGRAS INVIOLAVEIS:
- Siga FIELMENTE o texto biblico. Use o texto real como base absoluta.
- NAO inclua citacoes de capitulo e versiculo na narracao (ex: nada de "Genesis 1:9" no texto falado).
- NAO invente fatos, personagens ou dialogos que nao existam na Biblia.
- NAO adicione personagens que nao estejam na historia original.
- NAO altere o desfecho ou a sequencia dos eventos.
- Parafraseie para fluir como narracao falada envolvente, mas NUNCA altere o sentido.
- Versao biblica de referencia: {bible_version}

TOM E TECNICA NARRATIVA:
- Narre como um contador de historias magistral ao pe da fogueira
- Use descricoes SENSORIAIS: o que se via, ouvia, sentia, cheirava
- Construa TENSAO antes dos momentos decisivos — faca o ouvinte prender a respiracao
- Varie o ritmo: rapido e urgente na acao, lento e reverente nos momentos divinos
- Use PAUSAS DRAMATICAS implicitas (frases curtas isoladas para impacto)
- Conecte emocionalmente: "Imagine voce ali...", "Sinta o peso daquele momento..."
- Cada cena deve terminar criando expectativa para a proxima — o ouvinte NAO pode querer parar

LIMITES RIGIDOS DE DURACAO:
- O reel INTEIRO deve ter no MAXIMO {duracao} segundos de narracao falada.
- PT-BR falado: ~2.5 palavras por segundo. Para {duracao}s = MAXIMO {max_words} palavras TOTAL.
- CONTE as palavras. Se ultrapassar {max_words}, CORTE trechos ou encurte narracoes — NAO corte cenas.
- Prefira MAIS cenas curtas e bem ritmadas do que POUCAS cenas longas — isso mantem o ritmo visual e da respiracao para cada momento da historia.

NARRACAO POR CENA:
- Cada cena deve ter entre 8-18 palavras de narracao — curtas e impactantes, para multiplas cenas caberem no limite
- Seja DESCRITIVO e FIEL: inclua detalhes da historia biblica original
- RESUMA com sabedoria — selecione os momentos mais impactantes da historia
- Use dialogos biblicos quando existirem ("E Deus disse: Haja luz!") mas SEM citar versiculo

ESTRUTURA DO ROTEIRO:
1. GANCHO (0-3s): Pergunta provocativa ou afirmacao impactante que conecta com uma luta humana universal
2. CENARIO (3-8s): Transporte o ouvinte — descreva o lugar, a epoca, a atmosfera com detalhes vividos
3. NARRATIVA ({narrative_time}s): Conte a historia fielmente, cena por cena, com riqueza de detalhes
4. CLIMAX: O momento decisivo deve ser a cena mais impactante — construa para ele
5. LICAO ({lesson_time}s): O que essa historia ensina{reflection_instruction}
6. CTA (ultimos 3s): Convite ao compartilhamento

{image_instruction}

Historia biblica: {story_ref}
Idioma: pt-BR
Duracao alvo: {duracao}s
Numero de cenas: ~{n_cenas}

Crie um roteiro que:
1. {cena_instruction}
2. Distribua a narracao entre as cenas contando a historia com FIDELIDADE e RIQUEZA narrativa
3. Cada cena tenha em legenda_overlay uma descricao visual detalhada e cinematografica do cenario biblico
4. NAO inclua referencias de versiculo na narracao — conte a historia naturalmente
5. Gere hashtags relevantes e caption para Instagram
6. Faca o ouvinte sentir que PRECISA ouvir ate o final""",

    "en-US": """You are an expert biblical narrator specialized in telling Scripture stories engagingly for Instagram Reels.

INVIOLABLE RULES:
- Follow the biblical text FAITHFULLY. Use real Scripture as the base.
- Do NOT include chapter and verse citations in the narration (e.g., no "Genesis 1:9" in spoken text).
- Do NOT invent facts, characters, or dialogues not in the Bible.
- Do NOT add characters not in the original story.
- Do NOT alter the outcome or sequence of events.
- Paraphrase ONLY to flow as spoken narration, never to change meaning.
- Bible version reference: {bible_version}

STRICT DURATION LIMITS:
- The ENTIRE reel must have at most {duracao} seconds of spoken narration.
- English spoken: ~2.5 words per second. For {duracao}s = MAXIMUM {max_words} words TOTAL.
- COUNT your words. If exceeding {max_words}, SHORTEN narrations — do NOT cut scenes.
- Prefer MORE short well-paced scenes over FEWER long scenes — it keeps visual rhythm and gives each story beat room to breathe.

TONE: Engaging and dramatic, like an experienced storyteller.
- Vary the rhythm: fast during action, slower during reflections.
- Emotionally connected yet reverent.

SCRIPT STRUCTURE:
1. HOOK (0-3s): Emotional connection to a modern struggle the biblical story answers
2. SETTING (3-8s): Place the listener in the time and place with vivid description
3. NARRATIVE ({narrative_time}s): Tell the story faithfully, scene by scene
4. LESSON ({lesson_time}s): What this story teaches{reflection_instruction}
5. CTA (last 3s): Invitation to share

{image_instruction}

Biblical story: {story_ref}
Language: en-US
Target duration: {duracao}s
Number of scenes: ~{n_cenas}

Create a script that:
1. {cena_instruction}
2. Distributes narration naturally and dramatically across scenes
3. Each scene has a detailed visual description of the biblical setting in legenda_overlay
4. Does NOT include verse references in narration — tell the story naturally
5. Generates relevant hashtags and an Instagram caption""",

    "es-ES": """Eres un narrador biblico experto en contar historias de las Escrituras de forma envolvente para Instagram Reels.

REGLAS INVIOLABLES:
- Sigue FIELMENTE el texto biblico. Usa texto real como base.
- NO incluyas citas de capitulo y versiculo en la narracion (ej: nada de "Genesis 1:9" en el texto hablado).
- NO inventes hechos, personajes o dialogos que no existan en la Biblia.
- NO agregues personajes que no esten en la historia original.
- NO alteres el desenlace o la secuencia de los eventos.
- Parafrasea SOLO para fluir como narracion hablada, nunca para cambiar el sentido.
- Version biblica de referencia: {bible_version}

LIMITES ESTRICTOS DE DURACION:
- El reel ENTERO debe tener como maximo {duracao} segundos de narracion hablada.
- Espanol hablado: ~2.5 palabras por segundo. Para {duracao}s = MAXIMO {max_words} palabras TOTAL.
- CUENTA las palabras. Si excedes {max_words}, ACORTA narraciones — NO cortes escenas.
- Prefiere MAS escenas cortas bien ritmadas que POCAS escenas largas — mantiene el ritmo visual y da respiracion a cada momento.

TONO: Envolvente y dramatico, como un narrador de historias experimentado.
- Variacion de ritmo: rapido en los momentos de accion, pausado en las reflexiones.
- Emocionalmente conectado pero reverente.

ESTRUCTURA DEL GUION:
1. GANCHO (0-3s): Conexion emocional con una lucha moderna que la historia biblica responde
2. ESCENARIO (3-8s): Situa al oyente en la epoca y lugar con descripcion vivida
3. NARRATIVA ({narrative_time}s): Cuenta la historia fielmente, escena por escena
4. LECCION ({lesson_time}s): Lo que esta historia ensena{reflection_instruction}
5. CTA (ultimos 3s): Invitacion a compartir

{image_instruction}

Historia biblica: {story_ref}
Idioma: es-ES
Duracion objetivo: {duracao}s
Numero de escenas: ~{n_cenas}

Crea un guion que:
1. {cena_instruction}
2. Distribuya la narracion entre las escenas de forma natural y dramatica
3. Cada escena tenga en legenda_overlay una descripcion visual detallada del escenario biblico
4. NO incluya referencias de versiculo en la narracion — cuente la historia naturalmente
5. Genere hashtags relevantes y caption para Instagram""",
}


def _get_bible_system_prompt(cfg: dict) -> str:
    """Build dedicated system prompt for biblical narration.

    Selects language-appropriate template, fills placeholders with bible config.
    """
    bible_config = cfg.get("bible_config", {})
    story_ref = bible_config.get("story_ref", "")
    story_key = bible_config.get("story_key")
    if story_key:
        story = get_story_by_key(story_key)
        if story:
            story_ref = story_ref or story["ref"]

    include_reflection = bible_config.get("include_reflection", True)
    language = cfg.get("script_language", "pt-BR")
    bible_version = bible_config.get("bible_version") or BIBLE_VERSIONS.get(language, "NVI")
    duracao = cfg.get("target_duration", 60)
    # Align with the min_cenas computed below (duracao // 6). Old formula
    # (duracao // 12) produced "~5" which conflicted with the "between 10 and 15"
    # range in image_instruction and collapsed biblical narratives into too-few scenes.
    n_cenas = max(5, duracao // 6)

    # Time allocation: ~60% narrative, ~20% lesson, rest for hook/setting/cta
    narrative_time = int(duracao * 0.6)
    lesson_time = int(duracao * 0.2)
    max_words = int(duracao * 2.5)  # ~2.5 words/sec for PT-BR spoken

    # Reflection instruction varies by language
    if include_reflection:
        reflection_map = {
            "pt-BR": "\n- Termine com 2-3 frases conectando a historia com a vida atual do espectador",
            "en-US": "\n- End with 2-3 sentences connecting the story to the viewer's modern life",
            "es-ES": "\n- Termina con 2-3 frases conectando la historia con la vida actual del espectador",
        }
        reflection_instruction = reflection_map.get(language, reflection_map["en-US"])
    else:
        no_reflection_map = {
            "pt-BR": "\n- NAO inclua reflexao moderna. Termine com a conclusao biblica original.",
            "en-US": "\n- Do NOT include modern reflection. End with the original biblical conclusion.",
            "es-ES": "\n- NO incluyas reflexion moderna. Termina con la conclusion biblica original.",
        }
        reflection_instruction = no_reflection_map.get(language, no_reflection_map["en-US"])

    # Image and scene instructions (same logic as existing generate_script)
    min_cenas = max(3, duracao // 6)
    max_cenas = max(5, duracao // 4)
    if language.startswith("pt"):
        image_instruction = (
            f"Cada cena gerara uma imagem biblica. Crie entre {min_cenas} e {max_cenas} cenas "
            f"para cobrir a historia em ~{duracao}s."
        )
        cena_instruction = "Uma cena por momento-chave da historia biblica (imagem_index sequencial a partir de 0)"
    elif language.startswith("es"):
        image_instruction = (
            f"Cada escena generara una imagen biblica. Crea entre {min_cenas} y {max_cenas} escenas "
            f"para cubrir la historia en ~{duracao}s."
        )
        cena_instruction = "Una escena por momento clave de la historia biblica (imagem_index secuencial desde 0)"
    else:
        image_instruction = (
            f"Each scene will generate a biblical image. Create between {min_cenas} and {max_cenas} scenes "
            f"to cover the story in ~{duracao}s."
        )
        cena_instruction = "One scene per key moment in the biblical story (imagem_index sequential from 0)"

    template = _BIBLE_SYSTEM_PROMPTS.get(language)
    if not template:
        template = _BIBLE_SYSTEM_PROMPTS["en-US"]

    return template.format(
        bible_version=bible_version,
        narrative_time=narrative_time,
        lesson_time=lesson_time,
        max_words=max_words,
        reflection_instruction=reflection_instruction,
        image_instruction=image_instruction,
        story_ref=story_ref,
        duracao=duracao,
        n_cenas=n_cenas,
        cena_instruction=cena_instruction,
    )


async def generate_script(
    image_paths: list[str] | None = None,
    tema: str = "",
    config_override: dict | None = None,
    character_context: dict | None = None,
) -> dict:
    """Generate a structured roteiro (script) via Gemini.

    Supports two modes:
    - Multimodal (image_paths provided): sends images + text to Gemini
    - Text-only (image_paths=None): generates script from tema text only (v2 interactive)

    Args:
        image_paths: Optional paths to reel images. None for text-only mode.
        tema: Theme/topic for the script.
        config_override: Optional DB config values to merge with defaults.
        character_context: Optional dict with character persona (name, system_prompt, humor_style, tone).

    Returns:
        Parsed JSON dict matching RoteiroSchema structure.
    """
    cfg = config_override or {}
    tom = cfg.get("tone", "inspiracional")
    duracao = cfg.get("target_duration", 30)
    nicho = cfg.get("niche", "lifestyle")
    keywords = ", ".join(cfg.get("keywords", []))
    cta = cfg.get("cta_default", "salve esse post")
    language = cfg.get("script_language", REELS_SCRIPT_LANGUAGE)
    model = cfg.get("script_model", REELS_SCRIPT_MODEL)

    # Inject character persona into script generation
    character_section = ""
    if character_context:
        char_name = character_context.get("name", "")
        char_prompt = character_context.get("system_prompt", "")
        char_humor = character_context.get("humor_style", "")
        char_tone = character_context.get("tone", "")
        if char_prompt:
            character_section = (
                f"\n\nPERSONAGEM: {char_name}\n"
                f"Use a persona deste personagem para narrar o Reel:\n{char_prompt}\n"
                f"Estilo de humor: {char_humor}\nTom: {char_tone}\n"
                f"A narracao deve soar como se o personagem estivesse falando diretamente.\n\n"
                f"REGRA CRITICA PARA legenda_overlay:\n"
                f"TODAS as descricoes visuais (legenda_overlay) DEVEM referenciar o personagem '{char_name}' "
                f"como protagonista da cena. NUNCA use termos genericos como 'uma pessoa', 'um homem', "
                f"'alguem', 'uma figura'. SEMPRE descreva o '{char_name}' realizando a acao da cena. "
                f"Exemplo correto: '{char_name} sentado numa poltrona lendo um livro magico'. "
                f"Exemplo ERRADO: 'Uma pessoa sorridente abrindo cortinas'."
            )
            tom = char_tone or tom

    # Bible mode: dedicated system prompt for faithful biblical narration
    bible_config = cfg.get("bible_config")
    if bible_config:
        script_mode = bible_config.get("script_mode", "ai")
        if script_mode == "manual":
            manual_text = bible_config.get("manual_text", tema)
            return parse_manual_script(manual_text, duracao)
        # AI mode: use bible-specific system prompt
        system_prompt = _get_bible_system_prompt(cfg)
        # Character DNA does NOT influence biblical scripts
        character_section = ""

    if image_paths:
        n_imagens = len(image_paths)
        if language.startswith("pt"):
            image_instruction = f"Voce recebera {n_imagens} imagens que serao usadas no Reel."
            cena_instruction = f"Use cada imagem em ordem (imagem_index 0 a {n_imagens - 1})"
        elif language.startswith("es"):
            image_instruction = f"Recibiras {n_imagens} imagenes que se usaran en el Reel."
            cena_instruction = f"Usa cada imagen en orden (imagem_index 0 a {n_imagens - 1})"
        else:
            image_instruction = f"You will receive {n_imagens} images to use in the Reel."
            cena_instruction = f"Use each image in order (imagem_index 0 to {n_imagens - 1})"
    else:
        # Dynamic: duration drives scene count (~1 cena per 4-6s of content)
        min_cenas = max(3, duracao // 6)
        max_cenas = max(5, duracao // 4)
        if language.startswith("pt"):
            image_instruction = (
                f"Cada cena gerara uma imagem. Crie entre {min_cenas} e {max_cenas} cenas "
                f"para cobrir o tema em ~{duracao}s."
            )
            cena_instruction = "Uma cena por momento-chave do roteiro (imagem_index sequencial a partir de 0)"
        elif language.startswith("es"):
            image_instruction = (
                f"Cada escena generara una imagen. Crea entre {min_cenas} y {max_cenas} escenas "
                f"para cubrir el tema en ~{duracao}s."
            )
            cena_instruction = "Una escena por momento clave del guion (imagem_index secuencial desde 0)"
        else:
            image_instruction = (
                f"Each scene will generate an image. Create between {min_cenas} and {max_cenas} scenes "
                f"to cover the topic in ~{duracao}s."
            )
            cena_instruction = "One scene per key moment in the script (imagem_index sequential from 0)"

    # Build hook_type instruction if provided in config
    hook_type = cfg.get("hook_type")
    if hook_type:
        hook_type_instruction = (
            f"TIPO DE GANCHO: {hook_type}\n"
            "- curiosidade: Abra um loop mental (ex: \"Ninguém fala sobre isso, mas...\")\n"
            "- dor: Toque na frustração (ex: \"Para de fazer [ERRO] agora!\")\n"
            "- contrario: Desafie crença popular (ex: \"Tudo que você sabia sobre [X] está errado\")\n"
            "- autoridade: Mostre resultado concreto (ex: \"Como eu fui de [X] para [Y]\")\n"
            "- resultado: Mostre o final primeiro (ex: \"[RESULTADO] — e aqui está como\")\n"
            "Use este tipo de gancho no roteiro.\n\n"
        )
    else:
        hook_type_instruction = ""

    # Select language-appropriate system prompt template (skip if bible mode already set it)
    if not bible_config:
        prompt_template = _SYSTEM_PROMPTS.get(language)
        if prompt_template:
            system_prompt = prompt_template.format(
                tom=tom,
                duracao=duracao,
                nicho=nicho,
                keywords=keywords or ("nenhuma" if language.startswith("pt") else "none"),
                cta=cta,
                image_instruction=image_instruction,
                cena_instruction=cena_instruction,
                hook_type_instruction=hook_type_instruction,
            )
        else:
            system_prompt = _SYSTEM_PROMPT_FALLBACK.format(
                language=language,
                tom=tom,
                duracao=duracao,
                nicho=nicho,
                keywords=keywords or "none",
                cta=cta,
                image_instruction=image_instruction,
                cena_instruction=cena_instruction,
                hook_type_instruction=hook_type_instruction,
            )
    system_prompt += character_section

    # Build content parts
    parts = []
    if image_paths:
        for img_path in image_paths:
            img_bytes = Path(img_path).read_bytes()
            mime = "image/jpeg" if img_path.lower().endswith((".jpg", ".jpeg")) else "image/png"
            parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
        user_prompt = (
            f"Tema do Reel: {tema}\n"
            f"Idioma: {language}\n"
            f"Crie o roteiro completo para este Reel usando as {len(image_paths)} imagens acima."
        )
    else:
        # v2 text-only: script generates from tema text before images exist
        user_prompt = (
            f"Tema do Reel: {tema}\n"
            f"Idioma: {language}\n"
            f"Crie o roteiro completo para este Reel.\n"
            f"IMPORTANTE: Em cada cena, o campo 'legenda_overlay' deve descrever detalhadamente "
            f"o cenario visual, objetos, acoes e ambiente da cena (ex: 'personagem meditando em montanha ao amanhecer', "
            f"'pessoa servindo cafe em cozinha moderna', 'close no rosto com expressao de surpresa'). "
            f"Esse campo sera usado diretamente como prompt para gerar a imagem da cena. "
            f"Quanto mais descritivo e visual, melhor a imagem gerada."
        )
    parts.append(user_prompt)

    client = _get_client()
    response = client.models.generate_content(
        model=model,
        contents=parts,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=ROTEIRO_SCHEMA,
            temperature=0.9,
        ),
    )

    script = json.loads(response.text)

    # Append frase_loop to narracao_completa so TTS includes it at the end
    frase_loop = script.get("frase_loop", "")
    if frase_loop:
        nc = script.get("narracao_completa", "")
        if frase_loop not in nc:
            script["narracao_completa"] = nc.rstrip() + " " + frase_loop
            logger.info(f"Loop phrase appended to narracao_completa: '{frase_loop}'")

    logger.info(f"Script generated: titulo='{script.get('titulo')}', cenas={len(script.get('cenas', []))}")
    return script
