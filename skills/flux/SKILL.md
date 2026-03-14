---
name: flux
description: Generate images using FLUX.1-schnell running locally on the Mac Mini M4 Pro GPU. Free compute — use for any image creation task including Instagram content, illustrations, product shots, and creative visuals.
allowed-tools: Bash
---

# FLUX Image Generation

Generate high-quality images using FLUX.1-schnell via the local GPU API.

## API

`POST http://host.docker.internal:7861/generate`

```json
{
  "prompt": "your detailed image description",
  "steps": 4,
  "width": 1024,
  "height": 1024,
  "seed": 42
}
```

Response:
```json
{
  "path": "/Users/alfredopenclaw/projects/instagram/generated/abc123.png",
  "container_path": "/workspace/projects/instagram/generated/abc123.png",
  "filename": "abc123.png"
}
```

## Usage from Bash

```bash
RESULT=$(curl -s -X POST http://host.docker.internal:7861/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a vibrant flat-lay of tropical fruits on a marble surface, natural light, Instagram style",
    "steps": 4,
    "width": 1024,
    "height": 1024
  }')

IMAGE_PATH=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['container_path'])")
echo "Image saved to: $IMAGE_PATH"
```

## Usage from Python

```python
import requests, json

resp = requests.post("http://host.docker.internal:7861/generate", json={
    "prompt": "minimalist product shot of a coffee cup, soft morning light, lifestyle photography",
    "steps": 4,
    "width": 1024,
    "height": 1024,
})
result = resp.json()
image_path = result["container_path"]  # accessible inside container
```

## Tips

- **steps**: 4 is ideal for schnell (fast, good quality). Use 8 for more detail.
- **Instagram formats**: use 1024×1024 for square, 1080×1350 is portrait (use 832×1040 for similar ratio)
- **Prompts**: Be specific about lighting, style, mood. Include "professional photography", "natural light", "high quality" for polished results.
- The API is free — it runs on the Mac Mini's M4 Pro Neural Engine. No rate limits.
- Generated images land in `/workspace/projects/instagram/generated/` — pass this path directly to the instagram skill.
