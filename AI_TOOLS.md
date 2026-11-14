# AI Tools Documentation — LAST SIGNAL: Escape the City

In compliance with the project owner policy, transparent development guidelines, and contest ethics, this document records the usage of AI tooling throughout the development of **LAST SIGNAL: Escape the City**.

## Project Ownership & Authorship
- **Sole Project Owner & Human Author**: Adeniji Elijah Adetomiwa (`adenijielijah2003@gmail.com`)
- **Git Author & Commits**: All commits are made solely under the human owner's identity. No bots, service accounts, or AI identities are listed as Git contributors, authors, or `Co-authored-by` trailer entities.

## Design Attribution
- **Visual Design System**: Gold Noir design system art-directed by the project owner (reference screenshot and motion video supplied by the owner) and produced with Claude (Anthropic) — see AI Tools Utilized below.
  - Palette: Dark espresso background, `#603E1E` brown, `#F1D8A8` pale gold, `#FFC34D` glowing gold.
  - Typography: Cormorant Garamond (display) and Inter (sans).
  - Components: Folded-metal courier vehicle, procedural Gold Noir city blocks with offscreen sprite caching, speed gauge HUD, glass cards, and pure CSS cross-fade / staggered reveal animations.

## AI Tools Utilized

### 1. OpenAI ChatGPT
- **Role**: High-level planning, conceptual architecture review, contest strategy, narrative framing, and game design soundboarding.
- **Scope**: Advisory and design verification; does not directly commit to version control.

### 2. Google Antigravity
- **Role**: AI coding assistant and implementation agent.
- **Scope**: Code scaffolding, refactoring, test execution, Base44 CLI workflow coordination, and technical verification under the direct guidance and explicit review of the human project owner.

### 3. Anthropic Claude
- **Role**: UI/UX and product design, game-systems design, and code generation.
- **Scope**: Produced the Gold Noir redesign of all screens and motion, the city-block renderer, the city modes (New York, Lagos Island, Chicago, Gold City), solid obstacles and collisions, traffic, armed checkpoint officers, per-object colour variation, and performance tuning. Code is delivered to the project owner, who reviews, tests and commits it under their own identity. Claude is a tool only and is not listed as a Git contributor, author or `Co-authored-by` entity.

## Policy & Attribution Rules
- All code generated or suggested by AI tools undergoes review, testing, and validation by the project owner.
- Third-party copyrighted game characters, audio tracks, and art assets are strictly prohibited.
- Game rendering utilizes procedural Canvas 2D math and browser Web Audio API synthesis to ensure clean licensing and zero unauthorized copyright dependencies.
