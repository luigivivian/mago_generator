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
                    "image_prompt": {"type": "STRING"},
                    "mood": {
                        "type": "STRING",
                        "enum": ["mysterious", "dramatic", "hopeful", "tense", "calm", "sad", "epic"],
                    },
                    "transition_in": {
                        "type": "STRING",
                        "enum": ["fade", "cut", "dissolve", "slide"],
                    },
                    "transition_out": {
                        "type": "STRING",
                        "enum": ["fade", "cut", "dissolve", "slide"],
                    },
                },
                "required": [
                    "imagem_index", "duracao_segundos", "narracao", "legenda_overlay",
                    "image_prompt", "mood", "transition_in", "transition_out",
                ],
            },
        },
        "cta": {"type": "STRING"},
        "frase_loop": {"type": "STRING"},
        "hashtags": {"type": "ARRAY", "items": {"type": "STRING"}},
        "caption_instagram": {"type": "STRING"},
        "character_card": {
            "type": "OBJECT",
            "properties": {
                "description": {"type": "STRING"},
                "style_seed": {"type": "STRING"},
            },
            "required": ["description", "style_seed"],
        },
    },
    "required": [
        "titulo", "gancho", "narracao_completa", "cenas",
        "cta", "frase_loop", "hashtags", "caption_instagram",
    ],
}

# Language-specific system prompt templates
_SYSTEM_PROMPTS = {
    "pt-BR": """Voce e um roteirista especialista em conteudo viral para Instagram Reels no Brasil.

RITMO VISUAL (REGRA DE OURO - INVIOLAVEL):
- Cada cena: 2-4 segundos (NUNCA mais de 6s, NUNCA menos de 1s)
- Nenhuma cena parada por mais de 3 segundos sem novo estimulo visual
- O cerebro humano perde interesse em 1.7 segundos sem mudanca
- Cortes a cada 2-3s mantem a atencao ate o final
- Se uma narracao precisa de mais de 4s, QUEBRE em 2 cenas com imagens diferentes (mesmo lugar, angulos diferentes, close, zoom, detalhe focal)

Regras:
- Gancho rapido nos primeiros 1-2 segundos (curto e impactante)
- Cada cena deve ter entre 2-4 segundos de duracao
- Narracao de cada cena: 5-12 palavras maximo (curto, ritmo TikTok)
- legenda_overlay de cada cena: texto curto de legenda para exibir na tela (5-15 palavras, no idioma do roteiro)
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

CAMPOS V2 OBRIGATORIOS POR CENA:
- image_prompt: prompt em INGLES para geracao de imagem AI. Formato 4 camadas:
  "sujeito realizando acao, ambiente com detalhes, estilo visual, angulo de camera, 9:16, no text, no watermark"
  Exemplo: "old wizard meditating on misty mountaintop at dawn, atmospheric fog, soft cel-shading cartoon style, low angle wide shot, 9:16, no text, no watermark"
  DEVE ser em ingles independente do idioma do roteiro. NUNCA copie legenda_overlay para image_prompt.
- mood: estado emocional da cena. Um de: mysterious, dramatic, hopeful, tense, calm, sad, epic
  Escolha baseado no tom narrativo da cena.
- transition_in: transicao de entrada da cena. Um de: fade, cut, dissolve, slide
- transition_out: transicao de saida da cena. Um de: fade, cut, dissolve, slide
  Use "cut" para cortes rapidos, "fade" para momentos lentos, "dissolve" para transicoes suaves.

IMPORTANTE - legenda_overlay MUDOU DE FUNCAO:
- legenda_overlay agora e APENAS o texto curto de legenda que aparece NA TELA (5-15 palavras, no idioma do roteiro)
- NAO coloque descricao visual detalhada em legenda_overlay. Use image_prompt para isso.
- legenda_overlay e para o ESPECTADOR ler. image_prompt e para o GERADOR DE IMAGEM.

Crie um roteiro que:
1. {cena_instruction}
2. Distribua a narracao entre as cenas de forma natural
3. Crie um gancho irresistivel
4. Termine com CTA forte
5. Gere hashtags relevantes e caption completo para o Instagram""",

    "en-US": """You are an expert scriptwriter for viral Instagram Reels content.

VISUAL RHYTHM (GOLDEN RULE - INVIOLABLE):
- Each scene: 2-4 seconds (NEVER more than 6s, NEVER less than 1s)
- No scene stays still for more than 3 seconds without new visual stimulus
- The human brain loses interest in 1.7 seconds without change
- Cuts every 2-3s keep attention until the end
- If a narration needs more than 4s, BREAK it into 2 scenes with different images (same place, different angles, close-up, zoom, focal detail)

Rules:
- Quick hook in the first 1-2 seconds (short and impactful)
- Each scene should be 2-4 seconds long
- Narration per scene: 5-12 words MAX (short, TikTok pace)
- legenda_overlay for each scene: short subtitle text shown on screen (5-15 words, in the script's language)
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

MANDATORY V2 FIELDS PER SCENE:
- image_prompt: English prompt for AI image generation. 4-layer format:
  "subject doing action, environment with details, visual style, camera angle, 9:16, no text, no watermark"
  Example: "old wizard meditating on misty mountaintop at dawn, atmospheric fog, soft cel-shading cartoon style, low angle wide shot, 9:16, no text, no watermark"
  MUST be in English. NEVER copy legenda_overlay into image_prompt.
- mood: emotional state of the scene. One of: mysterious, dramatic, hopeful, tense, calm, sad, epic
  Choose based on the narrative tone of the scene.
- transition_in: scene entry transition. One of: fade, cut, dissolve, slide
- transition_out: scene exit transition. One of: fade, cut, dissolve, slide
  Use "cut" for fast cuts, "fade" for slow moments, "dissolve" for smooth transitions.

IMPORTANT - legenda_overlay HAS CHANGED:
- legenda_overlay is now ONLY the short subtitle text shown ON SCREEN (5-15 words, in the script's language)
- Do NOT put detailed visual descriptions in legenda_overlay. Use image_prompt for that.
- legenda_overlay is for the VIEWER to read. image_prompt is for the IMAGE GENERATOR.

Create a script that:
1. {cena_instruction}
2. Distributes narration naturally across scenes
3. Creates an irresistible hook
4. Ends with a strong CTA
5. Generates relevant hashtags and a complete Instagram caption""",

    "es-ES": """Eres un guionista experto en contenido viral para Instagram Reels.

RITMO VISUAL (REGLA DE ORO - INVIOLABLE):
- Cada escena: 2-4 segundos (NUNCA mas de 6s, NUNCA menos de 1s)
- Ninguna escena quieta por mas de 3 segundos sin nuevo estimulo visual
- El cerebro humano pierde interes en 1.7 segundos sin cambio
- Cortes cada 2-3s mantienen la atencion hasta el final
- Si una narracion necesita mas de 4s, DIVIDELA en 2 escenas con imagenes diferentes (mismo lugar, angulos diferentes, primer plano, zoom, detalle focal)

Reglas:
- Gancho rapido en los primeros 1-2 segundos (corto e impactante)
- Cada escena debe durar entre 2-4 segundos
- Narracion por escena: 5-12 palabras MAXIMO (corto, ritmo TikTok)
- legenda_overlay de cada escena: texto corto de subtitulo para mostrar en pantalla (5-15 palabras, en el idioma del guion)
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

CAMPOS V2 OBLIGATORIOS POR ESCENA:
- image_prompt: prompt en INGLES para generacion de imagen AI. Formato 4 capas:
  "sujeto realizando accion, ambiente con detalles, estilo visual, angulo de camara, 9:16, no text, no watermark"
  Ejemplo: "old wizard meditating on misty mountaintop at dawn, atmospheric fog, soft cel-shading cartoon style, low angle wide shot, 9:16, no text, no watermark"
  DEBE ser en ingles independiente del idioma del guion. NUNCA copies legenda_overlay a image_prompt.
- mood: estado emocional de la escena. Uno de: mysterious, dramatic, hopeful, tense, calm, sad, epic
- transition_in: transicion de entrada. Uno de: fade, cut, dissolve, slide
- transition_out: transicion de salida. Uno de: fade, cut, dissolve, slide

IMPORTANTE - legenda_overlay CAMBIO DE FUNCION:
- legenda_overlay ahora es SOLO el texto corto de subtitulo que aparece EN PANTALLA (5-15 palabras, en el idioma del guion)
- NO pongas descripcion visual detallada en legenda_overlay. Usa image_prompt para eso.

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

VISUAL RHYTHM (GOLDEN RULE - INVIOLABLE):
- Each scene: 2-4 seconds (NEVER more than 6s, NEVER less than 1s)
- No scene stays still for more than 3 seconds without new visual stimulus
- The human brain loses interest in 1.7 seconds without change
- Cuts every 2-3s keep attention until the end
- If a narration needs more than 4s, BREAK it into 2 scenes with different images (same place, different angles, close-up, zoom, focal detail)

Rules:
- Quick hook in the first 1-2 seconds (short and impactful)
- Each scene should be 2-4 seconds long
- Narration per scene: 5-12 words MAX (short, TikTok pace)
- legenda_overlay for each scene: short subtitle text shown on screen (5-15 words, in the script's language)
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

MANDATORY V2 FIELDS PER SCENE:
- image_prompt: English prompt for AI image generation. 4-layer format:
  "subject doing action, environment with details, visual style, camera angle, 9:16, no text, no watermark"
  Example: "old wizard meditating on misty mountaintop at dawn, atmospheric fog, soft cel-shading cartoon style, low angle wide shot, 9:16, no text, no watermark"
  MUST be in English. NEVER copy legenda_overlay into image_prompt.
- mood: emotional state of the scene. One of: mysterious, dramatic, hopeful, tense, calm, sad, epic
  Choose based on the narrative tone of the scene.
- transition_in: scene entry transition. One of: fade, cut, dissolve, slide
- transition_out: scene exit transition. One of: fade, cut, dissolve, slide
  Use "cut" for fast cuts, "fade" for slow moments, "dissolve" for smooth transitions.

IMPORTANT - legenda_overlay HAS CHANGED:
- legenda_overlay is now ONLY the short subtitle text shown ON SCREEN (5-15 words, in the script's language)
- Do NOT put detailed visual descriptions in legenda_overlay. Use image_prompt for that.
- legenda_overlay is for the VIEWER to read. image_prompt is for the IMAGE GENERATOR.

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

RITMO VISUAL (REGRA DE OURO - INVIOLAVEL):
- Cada cena: 2-4 segundos de narracao (NUNCA mais de 6s, NUNCA menos de 1s)
- Nenhuma imagem parada por mais de 3s sem corte/zoom/movimento
- Para um reel de 60s, gere ~20 cenas (uma a cada 3s)
- Prefira MUITAS cenas curtas e dinamicas do que POUCAS cenas longas
- Se uma narracao biblica precisa de mais de 4s, QUEBRE em 2-3 sub-cenas com angulos diferentes (close-up, zoom, panorama, detalhe focal)

LIMITES RIGIDOS DE DURACAO:
- O reel INTEIRO deve ter no MAXIMO {duracao} segundos de narracao falada.
- PT-BR falado: ~2.5 palavras por segundo. Para {duracao}s = MAXIMO {max_words} palavras TOTAL.
- CONTE as palavras. Se ultrapassar {max_words}, CORTE trechos ou encurte narracoes — NAO corte cenas.

NARRACAO POR CENA:
- Cada cena deve ter entre 5-12 palavras de narracao — curtas e impactantes, ritmo TikTok
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

CAMPOS V2 OBRIGATORIOS POR CENA:
- image_prompt: prompt em INGLES para geracao de imagem AI. Formato 4 camadas:
  "sujeito realizando acao, ambiente com detalhes, estilo visual, angulo de camera, 9:16, no text, no watermark"
  Exemplo: "old wizard meditating on misty mountaintop at dawn, atmospheric fog, soft cel-shading cartoon style, low angle wide shot, 9:16, no text, no watermark"
  DEVE ser em ingles independente do idioma do roteiro. NUNCA copie legenda_overlay para image_prompt.
- mood: estado emocional da cena. Um de: mysterious, dramatic, hopeful, tense, calm, sad, epic
  Escolha baseado no tom narrativo da cena.
- transition_in: transicao de entrada da cena. Um de: fade, cut, dissolve, slide
- transition_out: transicao de saida da cena. Um de: fade, cut, dissolve, slide
  Use "cut" para cortes rapidos, "fade" para momentos lentos, "dissolve" para transicoes suaves.

IMPORTANTE - legenda_overlay MUDOU DE FUNCAO:
- legenda_overlay agora e APENAS o texto curto de legenda que aparece NA TELA (5-15 palavras, no idioma do roteiro)
- NAO coloque descricao visual detalhada em legenda_overlay. Use image_prompt para isso.
- legenda_overlay e para o ESPECTADOR ler. image_prompt e para o GERADOR DE IMAGEM.

Crie um roteiro que:
1. {cena_instruction}
2. Distribua a narracao entre as cenas contando a historia com FIDELIDADE e RIQUEZA narrativa
3. Cada cena tenha em legenda_overlay texto curto de legenda para exibir na tela
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

VISUAL RHYTHM (GOLDEN RULE - INVIOLABLE):
- Each scene: 2-4 seconds of narration (NEVER more than 6s, NEVER less than 1s)
- No image stays still for more than 3s without cut/zoom/movement
- For a 60s reel, generate ~20 scenes (one every 3s)
- Prefer MANY short dynamic scenes over FEW long scenes
- If a biblical narration needs more than 4s, BREAK it into 2-3 sub-scenes with different angles (close-up, zoom, panorama, focal detail)

STRICT DURATION LIMITS:
- The ENTIRE reel must have at most {duracao} seconds of spoken narration.
- English spoken: ~2.5 words per second. For {duracao}s = MAXIMUM {max_words} words TOTAL.
- COUNT your words. If exceeding {max_words}, SHORTEN narrations — do NOT cut scenes.

NARRATION PER SCENE:
- Each scene must have 5-12 words of narration — short, impactful, TikTok pace.

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

MANDATORY V2 FIELDS PER SCENE:
- image_prompt: English prompt for AI image generation. 4-layer format:
  "subject doing action, environment with details, visual style, camera angle, 9:16, no text, no watermark"
  Example: "old wizard meditating on misty mountaintop at dawn, atmospheric fog, soft cel-shading cartoon style, low angle wide shot, 9:16, no text, no watermark"
  MUST be in English. NEVER copy legenda_overlay into image_prompt.
- mood: emotional state of the scene. One of: mysterious, dramatic, hopeful, tense, calm, sad, epic
  Choose based on the narrative tone of the scene.
- transition_in: scene entry transition. One of: fade, cut, dissolve, slide
- transition_out: scene exit transition. One of: fade, cut, dissolve, slide
  Use "cut" for fast cuts, "fade" for slow moments, "dissolve" for smooth transitions.

IMPORTANT - legenda_overlay HAS CHANGED:
- legenda_overlay is now ONLY the short subtitle text shown ON SCREEN (5-15 words, in the script's language)
- Do NOT put detailed visual descriptions in legenda_overlay. Use image_prompt for that.
- legenda_overlay is for the VIEWER to read. image_prompt is for the IMAGE GENERATOR.

Create a script that:
1. {cena_instruction}
2. Distributes narration naturally and dramatically across scenes
3. Each scene has a short subtitle text in legenda_overlay for on-screen display
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

RITMO VISUAL (REGLA DE ORO - INVIOLABLE):
- Cada escena: 2-4 segundos de narracion (NUNCA mas de 6s, NUNCA menos de 1s)
- Ninguna imagen quieta por mas de 3s sin corte/zoom/movimiento
- Para un reel de 60s, genera ~20 escenas (una cada 3s)
- Prefiere MUCHAS escenas cortas y dinamicas que POCAS escenas largas
- Si una narracion biblica necesita mas de 4s, DIVIDELA en 2-3 sub-escenas con angulos diferentes (primer plano, zoom, panorama, detalle focal)

LIMITES ESTRICTOS DE DURACION:
- El reel ENTERO debe tener como maximo {duracao} segundos de narracion hablada.
- Espanol hablado: ~2.5 palabras por segundo. Para {duracao}s = MAXIMO {max_words} palabras TOTAL.
- CUENTA las palabras. Si excedes {max_words}, ACORTA narraciones — NO cortes escenas.

NARRACION POR ESCENA:
- Cada escena debe tener 5-12 palabras de narracion — cortas e impactantes, ritmo TikTok.

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

CAMPOS V2 OBLIGATORIOS POR ESCENA:
- image_prompt: prompt en INGLES para generacion de imagen AI. Formato 4 capas:
  "sujeto realizando accion, ambiente con detalles, estilo visual, angulo de camara, 9:16, no text, no watermark"
  Ejemplo: "old wizard meditating on misty mountaintop at dawn, atmospheric fog, soft cel-shading cartoon style, low angle wide shot, 9:16, no text, no watermark"
  DEBE ser en ingles independiente del idioma del guion. NUNCA copies legenda_overlay a image_prompt.
- mood: estado emocional de la escena. Uno de: mysterious, dramatic, hopeful, tense, calm, sad, epic
- transition_in: transicion de entrada. Uno de: fade, cut, dissolve, slide
- transition_out: transicion de salida. Uno de: fade, cut, dissolve, slide

IMPORTANTE - legenda_overlay CAMBIO DE FUNCION:
- legenda_overlay ahora es SOLO el texto corto de subtitulo que aparece EN PANTALLA (5-15 palabras, en el idioma del guion)
- NO pongas descripcion visual detallada en legenda_overlay. Usa image_prompt para eso.

Crea un guion que:
1. {cena_instruction}
2. Distribuya la narracion entre las escenas de forma natural y dramatica
3. Cada escena tenga en legenda_overlay texto corto de subtitulo para mostrar en pantalla
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
    # Visual rhythm rule: ~3s per cena (sweet spot for short-form content).
    # 60s → 20 cenas, 90s → 30 cenas. Aligned with min_cenas formula below.
    n_cenas = max(8, duracao // 3)

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

    # Visual rhythm: ~3s per cena. 60s → 20 cenas, 90s → 30 cenas.
    min_cenas = max(8, duracao // 4)   # 60s → 15
    max_cenas = max(12, duracao // 2)  # 60s → 30
    if language.startswith("pt"):
        image_instruction = (
            f"Cada cena gerara uma imagem biblica DISTINTA. Crie entre {min_cenas} e {max_cenas} cenas "
            f"para cobrir a historia em ~{duracao}s. ATENCAO: cada cena deve ter ~3s de narracao "
            f"(5-12 palavras). Para momentos longos da historia, divida em 2-3 sub-cenas com angulos visuais "
            f"diferentes (close-up, panorama, detalhe focal)."
        )
        cena_instruction = "Uma cena por mini-momento da historia biblica (imagem_index sequencial a partir de 0)"
    elif language.startswith("es"):
        image_instruction = (
            f"Cada escena generara una imagen biblica DISTINTA. Crea entre {min_cenas} y {max_cenas} escenas "
            f"para cubrir la historia en ~{duracao}s. ATENCION: cada escena debe tener ~3s de narracion "
            f"(5-12 palabras). Para momentos largos de la historia, divide en 2-3 sub-escenas con angulos "
            f"visuales diferentes (primer plano, panorama, detalle focal)."
        )
        cena_instruction = "Una escena por mini-momento de la historia biblica (imagem_index secuencial desde 0)"
    else:
        image_instruction = (
            f"Each scene will generate a DISTINCT biblical image. Create between {min_cenas} and {max_cenas} "
            f"scenes to cover the story in ~{duracao}s. NOTE: each scene must have ~3s of narration "
            f"(5-12 words). For long story moments, split into 2-3 sub-scenes with different visual angles "
            f"(close-up, panorama, focal detail)."
        )
        cena_instruction = "One scene per mini-moment in the biblical story (imagem_index sequential from 0)"

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
        # Visual rhythm: ~3s per cena. 60s → 20 cenas, 90s → 30 cenas.
        min_cenas = max(8, duracao // 4)   # 60s → 15
        max_cenas = max(12, duracao // 2)  # 60s → 30
        if language.startswith("pt"):
            image_instruction = (
                f"Cada cena gerara uma imagem DISTINTA. Crie entre {min_cenas} e {max_cenas} cenas "
                f"para cobrir o tema em ~{duracao}s. ATENCAO: cada cena deve ter ~3s de narracao "
                f"(5-12 palavras). Para conceitos amplos, divida em sub-cenas com angulos diferentes."
            )
            cena_instruction = "Uma cena por mini-momento do roteiro (imagem_index sequencial a partir de 0)"
        elif language.startswith("es"):
            image_instruction = (
                f"Cada escena generara una imagen DISTINTA. Crea entre {min_cenas} y {max_cenas} escenas "
                f"para cubrir el tema en ~{duracao}s. ATENCION: cada escena debe tener ~3s de narracion "
                f"(5-12 palabras). Para conceptos amplios, divide en sub-escenas con angulos diferentes."
            )
            cena_instruction = "Una escena por mini-momento del guion (imagem_index secuencial desde 0)"
        else:
            image_instruction = (
                f"Each scene will generate a DISTINCT image. Create between {min_cenas} and {max_cenas} "
                f"scenes to cover the topic in ~{duracao}s. NOTE: each scene must have ~3s of narration "
                f"(5-12 words). For broad concepts, split into sub-scenes with different angles."
            )
            cena_instruction = "One scene per mini-moment in the script (imagem_index sequential from 0)"

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
            f"IMPORTANTE: Em cada cena, use 'image_prompt' para a descricao visual detalhada em INGLES "
            f"(4 camadas: sujeito, ambiente, estilo, camera) e 'legenda_overlay' para o texto curto de legenda na tela."
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

    # Inject character_card from character_context (v2 schema)
    if character_context and character_context.get("character_dna"):
        script["character_card"] = {
            "description": character_context.get("character_dna", ""),
            "style_seed": (
                character_context.get("character_dna", "")[:200]
                + (f", {character_context.get('composition', '')}" if character_context.get("composition") else "")
            ).strip().rstrip(","),
        }

    # Append frase_loop to narracao_completa so TTS includes it at the end
    frase_loop = script.get("frase_loop", "")
    if frase_loop:
        nc = script.get("narracao_completa", "")
        if frase_loop not in nc:
            script["narracao_completa"] = nc.rstrip() + " " + frase_loop
            logger.info(f"Loop phrase appended to narracao_completa: '{frase_loop}'")

    logger.info(f"Script generated: titulo='{script.get('titulo')}', cenas={len(script.get('cenas', []))}")
    return script
