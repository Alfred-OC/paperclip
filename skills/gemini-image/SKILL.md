---
name: gemini-image
description: Generate high-quality images using Google's Gemini image models (Nano Banana) and Imagen 3. Use for Instagram content, illustrations, and any image creation task. API key is pre-loaded.
allowed-tools: Bash, Python
---

# Gemini Image Generation

Multiple models available via the Gemini API. Choose based on quality vs cost tradeoff.

## Credentials

```python
import os
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
```

## Model Selection

| Model | ID | Best for | Cost (1K) |
|-------|----|----------|-----------|
| **Nano Banana 2** ⭐ | `gemini-3.1-flash-image-preview` | Default — speed + quality | $0.067 |
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | Studio-quality, 4K, complex prompts | $0.134 |
| **Nano Banana** | `gemini-2.5-flash-image` | Fast, cheap, simple tasks | $0.039 |
| **Imagen 3** | `imagen-3.0-generate-002` | Photorealism, product shots | varies |

**Default: Nano Banana 2** — best balance of speed and visual fidelity.

## Generate an Image (Nano Banana 2 — recommended)

```python
import os, uuid, base64
from pathlib import Path
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

OUTPUT_DIR = Path("/workspace/projects/instagram/generated")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="Generate an image of: a vibrant flat-lay of tropical fruits on marble, natural light, professional photography",
    config=types.GenerateContentConfig(
        response_modalities=["image"],
    ),
)

# Extract and save image
filename = f"{uuid.uuid4().hex}.png"
output_path = OUTPUT_DIR / filename
for part in response.candidates[0].content.parts:
    if part.inline_data:
        image_bytes = base64.b64decode(part.inline_data.data)
        output_path.write_bytes(image_bytes)
        break

print(f"Saved: {output_path}")
```

## Generate with Imagen 3 (alternative — best for photorealism)

```python
from google.genai import types

response = client.models.generate_images(
    model="imagen-3.0-generate-002",
    prompt="your prompt here",
    config=types.GenerateImagesConfig(
        number_of_images=1,
        aspect_ratio="1:1",   # 1:1, 9:16, 4:5, 16:9
    ),
)
filename = f"{uuid.uuid4().hex}.png"
output_path = OUTPUT_DIR / filename
response.generated_images[0].image.save(str(output_path))
```

## Full Workflow: Generate → Preview → Post to Instagram

Always preview with `send_image` before posting — let the user approve first.

```python
import os, uuid, base64
from pathlib import Path
from google import genai
from google.genai import types
from instagrapi import Client

OUTPUT_DIR = Path("/workspace/projects/instagram/generated")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SESSION_FILE = "/workspace/instagram-session/session.json"

# 1. Generate image
gc = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
response = gc.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="Generate an image of: your detailed prompt here",
    config=types.GenerateContentConfig(response_modalities=["image"]),
)
filename = f"{uuid.uuid4().hex}.png"
image_path = OUTPUT_DIR / filename
for part in response.candidates[0].content.parts:
    if part.inline_data:
        image_path.write_bytes(base64.b64decode(part.inline_data.data))
        break

# 2. Send preview to user via WhatsApp for approval
# Use the send_image MCP tool with the host path:
# host_path = str(image_path).replace('/workspace/projects/', '/Users/alfredopenclaw/projects/')
# Then call send_image(imagePath=host_path, caption="Ready to post this? Reply yes or no")
# Wait for user reply before proceeding to step 3.

# 3. Post to Instagram (only after user approves)
cl = Client()
cl.delay_range = [1, 3]
if os.path.exists(SESSION_FILE):
    cl.load_settings(SESSION_FILE)
cl.login_by_sessionid(os.environ["INSTAGRAM_SESSION_ID"])
cl.dump_settings(SESSION_FILE)

media = cl.photo_upload(path=image_path, caption="Caption here\n\n#hashtag1 #hashtag2")
print(f"Posted: https://www.instagram.com/p/{media.code}/")
```

## Text Overlay (deterministic — use for any image with text)

AI image models cannot reliably render text (they predict pixel patterns, not characters). Always
generate the background **without any text in the prompt**, then overlay text with Pillow. This is
100% accurate and deterministic.

### Available Fonts

Fonts live at `/usr/share/fonts/truetype/nanoclaw/`. Load by path with Pillow.

| File | Style | Best for |
|------|-------|----------|
| `Poppins-Bold.ttf` | Geometric bold | Main quote text, headlines |
| `Poppins-SemiBold.ttf` | Geometric medium | Subheadings, shorter captions |
| `Poppins-Regular.ttf` | Geometric regular | Body copy, attribution |
| `BebasNeue-Regular.ttf` | Condensed display (all-caps) | Dramatic single-sentence quotes |

### `overlay_text()` — multi-line text with semi-transparent band

```python
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

FONT_DIR = Path("/usr/share/fonts/truetype/nanoclaw")

def overlay_text(
    image_path: Path,
    text: str,
    font_name: str = "Poppins-Bold.ttf",
    font_size: int = 72,
    position: str = "center",        # "top" | "center" | "bottom"
    text_color: tuple = (255, 255, 255),
    band_color: tuple = (0, 0, 0),
    band_opacity: int = 140,          # 0 = transparent, 255 = opaque
    band_padding: int = 40,
    shadow_offset: int = 3,
    max_text_width_ratio: float = 0.85,
    output_path: Path = None,
) -> Path:
    """
    Overlay `text` on the image with a semi-transparent band and drop shadow.
    Returns the path to the saved output image.
    """
    img = Image.open(image_path).convert("RGBA")
    W, H = img.size

    # Auto-size font down until text fits within max_text_width_ratio
    max_w = int(W * max_text_width_ratio)
    while font_size >= 18:
        font = ImageFont.truetype(str(FONT_DIR / font_name), font_size)
        # Measure bounding box for full text block
        dummy = Image.new("RGBA", (1, 1))
        d = ImageDraw.Draw(dummy)
        bbox = d.multiline_textbbox((0, 0), text, font=font, align="center")
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        if text_w <= max_w:
            break
        font_size -= 4

    band_h = text_h + band_padding * 2

    # Position band vertically
    if position == "top":
        band_y = int(H * 0.08)
    elif position == "bottom":
        band_y = H - band_h - int(H * 0.08)
    else:  # center
        band_y = (H - band_h) // 2

    # Draw semi-transparent band
    band = Image.new("RGBA", (W, band_h), (*band_color, band_opacity))
    img.paste(band, (0, band_y), mask=band)

    draw = ImageDraw.Draw(img)
    text_x = W // 2
    text_y = band_y + band_padding

    # Drop shadow (drawn first)
    draw.multiline_text(
        (text_x + shadow_offset, text_y + shadow_offset),
        text, font=font, fill=(0, 0, 0, 160), align="center", anchor="ma",
    )
    # Main text
    draw.multiline_text(
        (text_x, text_y),
        text, font=font, fill=(*text_color, 255), align="center", anchor="ma",
    )

    if output_path is None:
        output_path = image_path.with_suffix("").with_name(image_path.stem + "_overlay.png")

    img.convert("RGB").save(str(output_path))
    return output_path
```

### `add_caption_bar()` — single-line attribution bar

```python
def add_caption_bar(
    image_path: Path,
    text: str,
    font_name: str = "Poppins-Regular.ttf",
    font_size: int = 36,
    text_color: tuple = (220, 220, 220),
    bar_color: tuple = (0, 0, 0),
    bar_opacity: int = 100,
    padding: int = 18,
    output_path: Path = None,
) -> Path:
    """Thin single-line bar at the bottom for @username or attribution. Keep text short."""
    img = Image.open(image_path).convert("RGBA")
    W, H = img.size

    font = ImageFont.truetype(str(FONT_DIR / font_name), font_size)
    dummy = Image.new("RGBA", (1, 1))
    bbox = ImageDraw.Draw(dummy).textbbox((0, 0), text, font=font)
    bar_h = (bbox[3] - bbox[1]) + padding * 2

    bar = Image.new("RGBA", (W, bar_h), (*bar_color, bar_opacity))
    bar_y = H - bar_h
    img.paste(bar, (0, bar_y), mask=bar)

    draw = ImageDraw.Draw(img)
    draw.text((W // 2, bar_y + padding), text, font=font, fill=(*text_color, 255), anchor="ma")

    if output_path is None:
        stem = image_path.stem.replace("_overlay", "")
        output_path = image_path.with_name(stem + "_final.png")

    img.convert("RGB").save(str(output_path))
    return output_path
```

### Complete workflow: background → overlay → preview → post

**Rule: NEVER put text content in the AI generation prompt.** Describe background aesthetics only.

```python
import os, uuid, base64
from pathlib import Path
from google import genai
from google.genai import types
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = Path("/workspace/projects/instagram/generated")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
FONT_DIR = Path("/usr/share/fonts/truetype/nanoclaw")

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# 1. Generate a clean background — NO text in prompt
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="Generate an image of: dark moody gradient background, deep navy and gold tones, subtle bokeh, cinematic atmosphere, portrait 4:5",
    config=types.GenerateContentConfig(response_modalities=["image"]),
)
bg_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_bg.png"
for part in response.candidates[0].content.parts:
    if part.inline_data:
        bg_path.write_bytes(base64.b64decode(part.inline_data.data))
        break

# 2. Overlay the quote text
overlay_path = overlay_text(
    image_path=bg_path,
    text="Done is better\nthan perfect.",
    font_name="Poppins-Bold.ttf",
    font_size=80,
    position="center",
    band_opacity=150,
)

# 3. Optional: add @username bar at bottom
final_path = add_caption_bar(overlay_path, "@youraccount")

# 4. Preview via WhatsApp — WAIT for approval before posting
# host_path = str(final_path).replace('/workspace/projects/', '/Users/alfredopenclaw/projects/')
# Call send_image(imagePath=host_path, caption="Ready to post this? Reply yes or no")

# 5. Post via instagram-graph skill's post_photo() (only after user approves)
# The Instagram `caption` (text below image in the app) is for hashtags, NOT the quote.
# post_photo(str(final_path), "Consistency is everything.\n\n#mindset #motivation #growth")
```

## Prompt Tips

- Be very specific: lighting, mood, style, composition, camera angle
- Include: "professional photography", "soft natural light", "shallow depth of field"
- For portraits: "editorial style", "magazine quality", "natural skin tones"
- For products: "white studio background", "product photography", "commercial"
- Nano Banana Pro handles complex multi-element scenes and detailed backgrounds well
- Use 4K resolution with Pro for hero shots worth extra cost; 1K for drafts
- **For posts with text**: describe background aesthetics ONLY — no text content in prompt. Use `overlay_text()` to add text after generation
