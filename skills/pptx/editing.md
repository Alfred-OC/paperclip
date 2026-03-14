# Editing Presentations

Template-based workflow for modifying PowerPoint files using XML manipulation.

## Workflow (7 steps — follow in order)

### Step 1: Analyze the Template

```bash
# Visual overview of all slides
python scripts/thumbnail.py template.pptx

# Text content
python -m markitdown template.pptx
```

Note the slide filenames (e.g., `slide1.xml`), layouts, and placeholder text patterns.

### Step 2: Plan Slide Mapping

**Don't default to basic title + bullet slides.** Actively seek out:
- Multi-column layouts
- Image + text combinations
- Full-bleed images with overlays
- Quote slides
- Section dividers
- Stat callouts

Match your content types to varied layouts in the template.

### Step 3: Unpack

```bash
python scripts/office/unpack.py template.pptx unpacked/
```

This extracts the ZIP, pretty-prints XML, and converts smart quotes to XML entities.

### Step 4: Build the Presentation Structure

Complete ALL structural changes before editing content:
- **Delete** unneeded slides: remove from `ppt/slides/`, update `presentation.xml` `<p:sldIdLst>`
- **Duplicate** slides for reuse: `python scripts/add_slide.py unpacked/ slide2.xml`
- **Reorder**: edit `<p:sldIdLst>` in `ppt/presentation.xml`
- **Create from layout**: `python scripts/add_slide.py unpacked/ slideLayout2.xml`

Slide order lives in `presentation.xml` `<p:sldIdLst>`. **Never manually copy slide files** — always use `add_slide.py`.

### Step 5: Edit Content

Edit XML files in `unpacked/ppt/slides/`. Use the Edit tool for string replacement — do NOT write Python scripts for text replacement.

**Text formatting:**
- Use `b="1"` to bold headers
- Use separate `<a:p>` elements for multi-item lists (never concatenate)
- Smart quotes use XML entities: `&#x201C;` (") `&#x201D;` (") `&#x2018;` (') `&#x2019;` (')

**Removing template placeholders:**
- When source content differs from template slots: **delete entire shapes**, not just text
- Remove excess `<p:sp>` elements completely rather than leaving empty containers

**For subagents:** After structural work is complete, use subagents to edit slides in parallel (each slide is independent).

### Step 6: Clean Orphaned Files

```bash
python scripts/clean.py unpacked/
```

Removes slides not in `<p:sldIdLst>`, trash directory, orphaned media/charts/drawings.

### Step 7: Pack

```bash
python scripts/office/pack.py unpacked/ output.pptx --original template.pptx
```

Use `--validate false` to skip validation if needed.

---

## Converting to Images (for QA)

```bash
python scripts/office/soffice.py --headless --convert-to pdf output.pptx
pdftoppm -jpeg -r 150 output.pdf slide
# Creates slide-01.jpg, slide-02.jpg, etc.
```

---

## Common Errors

- **Don't just clear placeholder text** — remove entire `<p:sp>` elements when content differs in quantity from template slots
- **Don't manually copy slide files** — use `add_slide.py` to handle relationship management
- **Smart quotes in XML** — always encode as `&#x201C;` etc., never paste raw Unicode
