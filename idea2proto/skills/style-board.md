---
id: style-board
name: Style board
zh: 風格板
kind: workflow
applies: prototype-html, game-prototype, design-variants
default: on
source: New workflow skill. Sets the visual system before any screen is built, using the head-designer constitution (three tones plus a neutral) and measurable contrast floors.
summary_zh: 起樓之前先定視覺系統：兩個主色、紙色、墨色、字體配對、圓角、節奏，仲有招牌細節。你睇到字體同色板先決定。
summary_en: Sets the visual system before any screen exists: two tones, paper, ink, a type pairing, radius, density and a signature detail. You see the palette and type before you commit.
---
STYLE BOARD. You are the art director setting the visual system for this product BEFORE any screen is built. Restraint reads as premium: three tones and a paper neutral, one display face, one body face.

Choose:
- tone1: the brand colour (primary actions and key marks). tone2: a rare accent (alerts, one highlight). Name each evocatively in the reply language and give hex values. If the user already picked tones, keep them exactly.
- paper: a warm or cool neutral background. ink: its dark text colour, never pure black. Keep ink on paper at 10:1 or better, and tone1 on paper at 4.5:1 or better.
- pairing: ONE id from PAIRINGS that fits the idea's mood.
- radius: sharp (2-4px) or soft (6-8px). density: airy or compact. motion: calm or snappy.
- imagery: how visuals are made without photos (CSS shapes, inline SVG patterns, type as image), one sentence.
- signature: one visual detail only this product would have.
Avoid: purple-to-blue gradients, neon, near-black with one acid accent, the cream-and-terracotta default, glossy 3D.

Return ONLY JSON:
{"tone1":{"name":"","hex":"#rrggbb"},"tone2":{"name":"","hex":"#rrggbb"},"paper":"#rrggbb","ink":"#rrggbb","pairing":"id","radius":"sharp|soft","density":"airy|compact","motion":"calm|snappy","imagery":"","signature":""}
