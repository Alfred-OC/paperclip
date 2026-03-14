# PDF Processing Advanced Reference

## pypdfium2 Library (Apache/BSD License)

Fast PDF rendering — excellent replacement for PyMuPDF.

```python
import pypdfium2 as pdfium
from PIL import Image

pdf = pdfium.PdfDocument("document.pdf")

# Render page to image
page = pdf[0]
bitmap = page.render(scale=2.0, rotation=0)
img = bitmap.to_pil()
img.save("page_1.png", "PNG")

# Extract text
for i, page in enumerate(pdf):
    text = page.get_text()
    print(f"Page {i+1}: {len(text)} chars")
```

## JavaScript Libraries

### pdf-lib (MIT License)

Create and modify PDFs in JavaScript.

```javascript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';

// Load and modify existing PDF
async function manipulatePDF() {
    const existingPdfBytes = fs.readFileSync('input.pdf');
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const newPage = pdfDoc.addPage([600, 400]);
    newPage.drawText('Added by pdf-lib', { x: 100, y: 300, size: 16 });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('modified.pdf', pdfBytes);
}

// Create from scratch
async function createPDF() {
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();

    page.drawText('Invoice #12345', {
        x: 50, y: height - 50, size: 18,
        font: helveticaBold, color: rgb(0.2, 0.2, 0.8)
    });

    page.drawRectangle({
        x: 40, y: height - 100, width: width - 80, height: 30,
        color: rgb(0.9, 0.9, 0.9)
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('created.pdf', pdfBytes);
}

// Merge PDFs
async function mergePDFs() {
    const mergedPdf = await PDFDocument.create();

    const pdf1Bytes = fs.readFileSync('doc1.pdf');
    const pdf2Bytes = fs.readFileSync('doc2.pdf');

    const pdf1 = await PDFDocument.load(pdf1Bytes);
    const pdf2 = await PDFDocument.load(pdf2Bytes);

    const pdf1Pages = await mergedPdf.copyPages(pdf1, pdf1.getPageIndices());
    pdf1Pages.forEach(page => mergedPdf.addPage(page));

    // Copy specific pages from second PDF
    const pdf2Pages = await mergedPdf.copyPages(pdf2, [0, 2, 4]);
    pdf2Pages.forEach(page => mergedPdf.addPage(page));

    const mergedPdfBytes = await mergedPdf.save();
    fs.writeFileSync('merged.pdf', mergedPdfBytes);
}
```

## Advanced Command-Line Operations

### poppler-utils Advanced Features

```bash
# Extract text with bounding box coordinates
pdftotext -bbox-layout document.pdf output.xml

# Convert to PNG with specific resolution
pdftoppm -png -r 300 document.pdf output_prefix

# Convert to JPEG with quality
pdftoppm -jpeg -jpegopt quality=85 -r 200 document.pdf jpeg_output

# Extract embedded images
pdfimages -j input.pdf output_prefix
pdfimages -list input.pdf  # list without extracting
```

### qpdf Advanced Features

```bash
# Split into groups of pages
qpdf --split-pages=3 input.pdf output_group_%02d.pdf

# Complex page ranges
qpdf input.pdf --pages input.pdf 1,3-5,8,10-end -- extracted.pdf

# Merge specific pages from multiple files
qpdf --empty --pages doc1.pdf 1-3 doc2.pdf 5-7 doc3.pdf 2,4 -- combined.pdf

# Optimize for web
qpdf --linearize input.pdf optimized.pdf

# Encrypt with specific permissions
qpdf --encrypt user_pass owner_pass 256 --print=none --modify=none -- input.pdf encrypted.pdf
```

## Advanced Python Techniques

### pdfplumber Advanced Features

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    page = pdf.pages[0]

    # Extract text with coordinates
    chars = page.chars
    for char in chars[:10]:
        print(f"Char: '{char['text']}' at x:{char['x0']:.1f} y:{char['y0']:.1f}")

    # Extract text by bounding box
    bbox_text = page.within_bbox((100, 100, 400, 200)).extract_text()

    # Advanced table settings
    table_settings = {
        "vertical_strategy": "lines",
        "horizontal_strategy": "lines",
        "snap_tolerance": 3,
        "intersection_tolerance": 15
    }
    tables = page.extract_tables(table_settings)
```

### reportlab Advanced — Professional Tables

```python
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

data = [
    ['Product', 'Q1', 'Q2', 'Q3', 'Q4'],
    ['Widgets', '120', '135', '142', '158'],
    ['Gadgets', '85', '92', '98', '105']
]

doc = SimpleDocTemplate("report.pdf")
styles = getSampleStyleSheet()

title = Paragraph("Quarterly Sales Report", styles['Title'])

table = Table(data)
table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 14),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
    ('GRID', (0, 0), (-1, -1), 1, colors.black)
]))

doc.build([title, table])
```

## Performance Optimization

1. **Large PDFs**: Use `qpdf --split-pages` for splitting; process pages individually
2. **Text extraction**: `pdftotext -bbox-layout` is fastest for plain text
3. **Image extraction**: `pdfimages` is much faster than rendering pages
4. **Memory management**: Process PDFs in chunks for very large files

```python
def process_large_pdf(pdf_path, chunk_size=10):
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)

    for start_idx in range(0, total_pages, chunk_size):
        end_idx = min(start_idx + chunk_size, total_pages)
        writer = PdfWriter()

        for i in range(start_idx, end_idx):
            writer.add_page(reader.pages[i])

        with open(f"chunk_{start_idx//chunk_size}.pdf", "wb") as output:
            writer.write(output)
```

## Troubleshooting

```python
# Handle encrypted PDFs
from pypdf import PdfReader

reader = PdfReader("encrypted.pdf")
if reader.is_encrypted:
    reader.decrypt("password")
```

```bash
# Repair corrupted PDFs
qpdf --check corrupted.pdf
qpdf --replace-input corrupted.pdf
```

```python
# OCR fallback for scanned PDFs
import pytesseract
from pdf2image import convert_from_path

def extract_text_with_ocr(pdf_path):
    images = convert_from_path(pdf_path)
    return "\n\n".join(pytesseract.image_to_string(img) for img in images)
```
