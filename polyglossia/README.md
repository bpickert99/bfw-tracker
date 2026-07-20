# 🌐 Polyglossia

A free, open, **document-driven** language-learning platform for the languages the big
apps don't offer — Duolingo-style lessons, generated from documents *you* upload, aligned
to the CEFR scale.

**Live site:** https://bpickert99.github.io/polyglossia/

## How it works

```
sources/<lang>/*.pdf|txt|md      you upload documents here
        │
        ▼   GitHub Action + Claude API
data/<lang>/course.json          CEFR-aligned skill tree
data/<lang>/units/*.json         lessons: vocab, grammar, exercises
data/<lang>/script.json          script inventory for drawing practice
data/<lang>/culture.json         cultural background articles
        │
        ▼   GitHub Pages
the site                         static app — no backend, progress in localStorage
```

1. **Upload documents** — grammars, word lists, phrasebooks, readers — to
   `sources/<language-code>/` (easiest: GitHub web UI → *Add file → Upload files*).
2. On push, the **Build course from sources** workflow sends the documents to Claude,
   which designs (or incrementally updates) the course: honest CEFR placement, lessons
   with vocabulary/grammar/exercises, cultural notes, and a full script inventory for
   non-Latin scripts.
3. The result is committed to `data/`, which triggers the **Deploy to GitHub Pages**
   workflow. New documents → updated tree, automatically.

## One-time setup after cloning/forking

1. **Add your Anthropic API key**: *Settings → Secrets and variables → Actions →
   New repository secret*, name `ANTHROPIC_API_KEY`. (Rebuilds cost roughly cents to a
   few dollars depending on document size — the builder only regenerates what changed.)
2. **Enable GitHub Pages**: the deploy workflow enables it automatically on first run;
   if it fails, set *Settings → Pages → Source* to **GitHub Actions** and re-run.

That's it. The bundled Cherokee starter course works with zero setup.

## Features

- 📚 **Skill tree** — units grouped into CEFR sections A1→C2; sections stay locked until
  the source material can honestly support them
- 📝 **Lesson engine** — teach cards, grammar notes, and four exercise types
  (multiple choice, listening, typing, matching) with wrong-answer requeuing, XP, and streaks
- ✍️ **Script practice** — for non-Latin scripts: a drawing canvas with glyph tracing,
  hint toggle, and a self-check score
- 🏛️ **Culture tab** — background articles generated from the same documents
- 🔊 **Audio everywhere** — browser TTS on every word and sentence. For languages with no
  real TTS voice (most under-served languages, including Cherokee), audio uses the closest
  available voice with per-language phonetic substitutions and is clearly labeled
  **approximate**
- 🔒 **Private by design** — static site, no accounts; progress lives in your browser

## Adding a new language

Create `sources/<code>/` (use the ISO 639 code, e.g. `nv` for Navajo, `haw` for Hawaiian),
upload documents, push. The builder creates `data/<code>/` and adds the language to the
site's language index. Multiple languages coexist happily.

## Local development

```bash
# serve the site
python3 -m http.server 8080          # then open http://localhost:8080

# rebuild a course locally
ANTHROPIC_API_KEY=sk-... npm install && npm run build-course
```

## A note on accuracy and respect

The bundled Cherokee starter course was seeded from public reference material so the
platform works out of the box. It is illustrative, not authoritative: spelling, dialect,
and usage vary between communities, and Indigenous communities are the owners of their
languages. Prefer materials from language keepers — the whole point of this project is
that **your uploaded documents become the course**.
