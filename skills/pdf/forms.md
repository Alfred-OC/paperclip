# PDF Form Filling

**CRITICAL: You MUST complete these steps in order. Do not skip ahead to writing code.**

First check if the PDF has fillable form fields. The approach differs based on field type.

---

# Fillable Fields

If the PDF has interactive form fields:

1. **Extract field info** — get field IDs, types, and coordinates:
   ```bash
   python scripts/extract_form_field_info.py <file.pdf> field_info.json
   ```

   Field info format:
   ```json
   [
     { "field_id": "last_name", "page": 1, "rect": [left, bottom, right, top], "type": "text" },
     { "field_id": "Checkbox12", "page": 1, "type": "checkbox", "checked_value": "/On", "unchecked_value": "/Off" },
     { "field_id": "radio_group_1", "page": 1, "type": "radio_group",
       "radio_options": [{ "value": "/Option1", "rect": [...] }] },
     { "field_id": "dropdown1", "page": 1, "type": "choice",
       "choice_options": [{ "value": "opt1", "text": "Option 1" }] }
   ]
   ```

2. **Convert PDF to images** for visual analysis:
   ```bash
   python scripts/convert_pdf_to_images.py <file.pdf> images/
   ```

3. **Create `field_values.json`** mapping field IDs to values:
   ```json
   [
     { "field_id": "last_name", "description": "Last name", "page": 1, "value": "Simpson" },
     { "field_id": "Checkbox12", "description": "Is 18+", "page": 1, "value": "/On" }
   ]
   ```

4. **Fill the form**:
   ```bash
   python scripts/fill_fillable_fields.py <input.pdf> field_values.json <output.pdf>
   ```

---

# Non-Fillable Fields (Text Annotations)

## Step 1: Try Structure Extraction (Preferred)

```bash
python scripts/extract_form_structure.py <input.pdf> form_structure.json
```

This extracts labels, lines, and checkbox coordinates. If it finds meaningful labels → use **Approach A**. If PDF is scanned/image-based → use **Approach B**.

## Approach A: Structure-Based Coordinates

Use coordinates from `form_structure.json`. Create `fields.json` with `pdf_width`/`pdf_height`:

```json
{
  "pages": [{ "page_number": 1, "pdf_width": 612, "pdf_height": 792 }],
  "form_fields": [
    {
      "page_number": 1,
      "description": "Last name entry field",
      "field_label": "Last Name",
      "label_bounding_box": [43, 63, 87, 73],
      "entry_bounding_box": [92, 63, 260, 79],
      "entry_text": { "text": "Smith", "font_size": 10 }
    },
    {
      "page_number": 1,
      "description": "US Citizen Yes checkbox",
      "field_label": "Yes",
      "label_bounding_box": [260, 200, 280, 210],
      "entry_bounding_box": [285, 197, 292, 205],
      "entry_text": { "text": "X" }
    }
  ]
}
```

**Coordinate system**: y=0 is at TOP of page, y increases downward.

Field coordinate rules:
- Text field: entry x0 = label x1 + 5, entry top = label top
- Checkboxes: use coordinates directly from `form_structure.json`

## Approach B: Visual Estimation (Fallback)

When the PDF is scanned/image-based.

1. Convert PDF to images:
   ```bash
   python scripts/convert_pdf_to_images.py <input.pdf> images/
   ```

2. Estimate field positions from images

3. Refine with zoom crops using ImageMagick:
   ```bash
   magick page_1.png -crop 300x80+50+120 +repage crops/name_field.png
   ```

4. Create `fields.json` with `image_width`/`image_height` (uses image pixel coordinates):
   ```json
   {
     "pages": [{ "page_number": 1, "image_width": 1700, "image_height": 2200 }],
     "form_fields": [...]
   }
   ```

## Step 2: Validate Bounding Boxes

```bash
python scripts/check_bounding_boxes.py fields.json
```

Fix any intersecting boxes or boxes too small for font size.

## Step 3: Fill

```bash
python scripts/fill_pdf_form_with_annotations.py <input.pdf> fields.json <output.pdf>
```

## Step 4: Verify

```bash
python scripts/convert_pdf_to_images.py <output.pdf> verify_images/
```

Check text placement. If mispositioned: verify coordinate system matches (`pdf_width` vs `image_width`).
