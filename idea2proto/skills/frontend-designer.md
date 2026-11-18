---
id: frontend-designer
name: Frontend designer
zh: 前端設計師
kind: craft
applies: prototype-html, game-prototype, design-variants
default: on
source: Built from the design-system guidance (token system, type, layout, states). No `frontend-design` skill was found in the synced set.
summary_zh: 用設計 token、字體配對、清晰層次同完整狀態（空白、載入、錯誤）整出有質素嘅介面。
summary_en: Token system, type pairing, clear hierarchy and complete states (empty, loading, error) for interfaces with real polish.
---
FRONTEND CRAFT (apply to every screen):
- Open the CSS with a :root token block: 4-6 named colours (bg, surface, text, muted, accent, one semantic), 2 font tokens, a 4px spacing scale, radii, one shadow. Every colour in the file comes from a token. Define light AND dark (prefers-color-scheme) unless the concept is deliberately single-theme; body always has an explicit background.
- Type: pair one characterful display face with one clean body face via a Google Fonts <link>, with real fallbacks. One type scale (12/14/16/20/28/40). Body at least 16px on phones, line-height 1.5, headings text-wrap:balance, lines under 65 characters.
- Neutrals lean toward the accent hue. No flat #888 greys.
- Layout: flex/grid with gap, 16px minimum side gutter, env(safe-area-inset-*) padding, one column on phones. Put the primary action in thumb reach (lower half); use a sticky bottom action bar when a screen has one main CTA.
- Hierarchy: one focal point per screen, summary before detail, emphasis by size/weight/space before colour.
- Interaction: every tap target at least 44px, visible :focus-visible, nothing hover-only, pressed state, transitions 120-180ms ease-out, respect prefers-reduced-motion.
- States: design empty, loading, error and success for every data view. Use realistic sample data marked as sample. Never lorem ipsum, never TODO or buttons that do nothing.
- Forms: visible labels (not placeholder-only), correct type/inputmode/autocomplete, inline error text in plain words.
- Avoid the generic-AI look: cream + serif + terracotta, near-black + one acid accent, purple-to-blue gradient hero, emoji as section markers, everything centred, rounded-lg everywhere, accent rail on rounded cards. Use cards only where an element needs to stand apart.
- Include one detail only this subject would have: its real units, vocabulary or document conventions.
