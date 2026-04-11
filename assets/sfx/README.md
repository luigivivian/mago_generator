# SFX Asset Library

This directory holds royalty-free sound effects referenced by
`src/product_studio/sfx_library.py` for the Product Studio v2 pipeline.

## Required structure

```
assets/sfx/
  asmr/
    crunch_cookie.mp3
    sizzle_burger.mp3
    pour_chocolate.mp3
    drop_serum.mp3
    ice_cubes.mp3
  epic/
    hit_impact.mp3
    riser_buildup.mp3
    whoosh_pass.mp3
    boom_bass.mp3
  ambient/
    warmth_pad.mp3
    nature_breeze.mp3
    urban_cafe.mp3
```

## Sourcing

All SFX should be CC0 / public domain. Recommended source:
- [Freesound.org](https://freesound.org) (filter by CC0 license)

## Fallback behavior

If an SFX file is missing at runtime, `resolve_sfx_path` returns None and
the take is rendered without that SFX layer. The pipeline does not fail.
