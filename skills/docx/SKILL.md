---
name: docx
description: "Use this skill any time you need to create, edit, read, or analyze Word (.docx) documents. Trigger for: creating new Word documents from scratch; editing existing documents with tracked changes or comments; reading or extracting content from .docx files; converting between document formats; filling document templates. The deliverable must be a Word document or analysis of one."
license: Proprietary. LICENSE.txt has complete terms
---

# DOCX creation, editing, and analysis

## Quick Reference

| Task | Approach |
|------|----------|
| Read/analyze content | `pandoc` or unpack for raw XML |
| Create new document | Use `docx` npm package — see Creating New Documents below |
| Edit existing document | Unpack → edit XML → repack — see Editing Existing Documents below |

### Converting .doc to .docx

Legacy `.doc` files must be converted before editing:

```bash
python scripts/office/soffice.py --headless --convert-to docx document.doc
```

### Reading Content

```bash
# Text extraction with tracked changes
pandoc --track-changes=all document.docx -o output.md

# Raw XML access
python scripts/office/unpack.py document.docx unpacked/
```

### Converting to Images

```bash
python scripts/office/soffice.py --headless --convert-to pdf document.docx
pdftoppm -jpeg -r 150 document.pdf page
```

### Accepting Tracked Changes

```bash
python scripts/accept_changes.py input.docx output.docx
```

---

## Creating New Documents

Generate .docx files with JavaScript. Install: `npm install -g docx`

### Setup
```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
        Header, Footer, AlignmentType, PageOrientation, LevelFormat, ExternalHyperlink,
        TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
        VerticalAlign, PageNumber, PageBreak } = require('docx');

const doc = new Document({ sections: [{ children: [/* content */] }] });
Packer.toBuffer(doc).then(buffer => fs.writeFileSync("doc.docx", buffer));
```

### Page Size

```javascript
// CRITICAL: docx-js defaults to A4, not US Letter
// Always set page size explicitly
sections: [{
  properties: {
    page: {
      size: {
        width: 12240,   // 8.5 inches in DXA (1440 DXA = 1 inch)
        height: 15840   // 11 inches in DXA
      },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
    }
  },
  children: [/* content */]
}]
```

**Common page sizes:**

| Paper | Width | Height | Content Width (1" margins) |
|-------|-------|--------|---------------------------|
| US Letter | 12,240 | 15,840 | 9,360 |
| A4 (default) | 11,906 | 16,838 | 9,026 |

**Landscape orientation:** pass portrait dimensions, let docx-js handle the swap:
```javascript
size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE }
```

### Styles

```javascript
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } }, // 12pt default
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 } },
    ]
  },
  sections: [{ children: [...] }]
});
```

### Lists (NEVER use unicode bullets)

```javascript
// ❌ WRONG
new Paragraph({ children: [new TextRun("• Item")] })

// ✅ CORRECT - use numbering config
const doc = new Document({
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    children: [
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Bullet item")] }),
    ]
  }]
});
```

### Tables

```javascript
// CRITICAL: Tables need dual widths — columnWidths on table AND width on each cell
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

new Table({
  width: { size: 9360, type: WidthType.DXA }, // Always use DXA
  columnWidths: [4680, 4680], // Must sum to table width
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 4680, type: WidthType.DXA }, // Also set on each cell
          shading: { fill: "D5E8F0", type: ShadingType.CLEAR }, // CLEAR not SOLID
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun("Cell")] })]
        })
      ]
    })
  ]
})
```

**Always use `WidthType.DXA`** — never `WidthType.PERCENTAGE` (breaks in Google Docs).

### Images

```javascript
// CRITICAL: type parameter is REQUIRED
new Paragraph({
  children: [new ImageRun({
    type: "png", // Required: png, jpg, jpeg, gif, bmp, svg
    data: fs.readFileSync("image.png"),
    transformation: { width: 200, height: 150 },
    altText: { title: "Title", description: "Desc", name: "Name" }
  })]
})
```

### Page Breaks

```javascript
// CRITICAL: PageBreak must be inside a Paragraph
new Paragraph({ children: [new PageBreak()] })
new Paragraph({ pageBreakBefore: true, children: [new TextRun("New page")] })
```

### Table of Contents

```javascript
// CRITICAL: Headings must use HeadingLevel ONLY
new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" })
```

### Headers/Footers

```javascript
sections: [{
  properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
  headers: {
    default: new Header({ children: [new Paragraph({ children: [new TextRun("Header")] })] })
  },
  footers: {
    default: new Footer({ children: [new Paragraph({
      children: [new TextRun("Page "), new TextRun({ children: [PageNumber.CURRENT] })]
    })] })
  },
  children: [/* content */]
}]
```

### Critical Rules

- **Set page size explicitly** — docx-js defaults to A4
- **Never use `\n`** — use separate Paragraph elements
- **Never use unicode bullets** — use `LevelFormat.BULLET`
- **PageBreak must be in Paragraph** — standalone creates invalid XML
- **ImageRun requires `type`** — always specify png/jpg/etc
- **Always `WidthType.DXA`** for tables — never `PERCENTAGE`
- **Tables need dual widths** — `columnWidths` AND cell `width`
- **Use `ShadingType.CLEAR`** — never SOLID for table shading
- **Include `outlineLevel`** — required for TOC (0 for H1, 1 for H2)

---

## Editing Existing Documents

**Follow all 3 steps in order.**

### Step 1: Unpack
```bash
python scripts/office/unpack.py document.docx unpacked/
```

### Step 2: Edit XML

Edit files in `unpacked/word/`. Use the Edit tool for string replacement.

**Use "Claude" as the author** for tracked changes and comments.

**Smart quotes for new content:**
| Entity | Character |
|--------|-----------|
| `&#x2018;` | ' (left single) |
| `&#x2019;` | ' (right single / apostrophe) |
| `&#x201C;` | " (left double) |
| `&#x201D;` | " (right double) |

**Adding comments:**
```bash
python scripts/comment.py unpacked/ 0 "Comment text with &amp; and &#x2019;"
python scripts/comment.py unpacked/ 1 "Reply text" --parent 0
```
Then add markers to document.xml (output shows exactly what to add).

### Step 3: Pack
```bash
python scripts/office/pack.py unpacked/ output.docx --original document.docx
```

---

## XML Reference

### Tracked Changes

**Insertion:**
```xml
<w:ins w:id="1" w:author="Claude" w:date="2025-01-01T00:00:00Z">
  <w:r><w:t>inserted text</w:t></w:r>
</w:ins>
```

**Deletion:**
```xml
<w:del w:id="2" w:author="Claude" w:date="2025-01-01T00:00:00Z">
  <w:r><w:delText>deleted text</w:delText></w:r>
</w:del>
```

**Minimal edits — only mark what changes:**
```xml
<w:r><w:t>The term is </w:t></w:r>
<w:del w:id="1" w:author="Claude" w:date="...">
  <w:r><w:delText>30</w:delText></w:r>
</w:del>
<w:ins w:id="2" w:author="Claude" w:date="...">
  <w:r><w:t>60</w:t></w:r>
</w:ins>
<w:r><w:t> days.</w:t></w:r>
```

**Deleting entire paragraphs** — also mark the paragraph mark:
```xml
<w:p>
  <w:pPr>
    <w:rPr><w:del w:id="1" w:author="Claude" w:date="..."/></w:rPr>
  </w:pPr>
  <w:del w:id="2" w:author="Claude" w:date="...">
    <w:r><w:delText>Entire paragraph content...</w:delText></w:r>
  </w:del>
</w:p>
```

### Comments

After running `comment.py`, add markers to document.xml:
```xml
<!-- Markers are direct children of w:p, never inside w:r -->
<w:commentRangeStart w:id="0"/>
<w:r><w:t>commented text</w:t></w:r>
<w:commentRangeEnd w:id="0"/>
<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="0"/></w:r>
```

---

## Dependencies

- **pandoc**: Text extraction
- **docx**: `npm install -g docx` (new documents)
- **LibreOffice**: PDF conversion and accept_changes.py (auto-configured via `scripts/office/soffice.py`)
- **Poppler**: `pdftoppm` for images
