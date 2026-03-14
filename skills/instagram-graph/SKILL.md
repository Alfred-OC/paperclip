---
name: instagram-graph
description: Manage Instagram via the official Meta Graph API. Post photos/reels, read comments, reply, check insights/analytics. Use this instead of instagrapi — it is rate-limit safe and officially supported. Credentials are pre-loaded.
allowed-tools: Bash, Python
---

# Instagram Graph API

Official Meta API — no bot detection, no IP blocks, 200 posts/day limit.

## Why this instead of instagrapi

instagrapi reverse-engineers Instagram's private mobile API and gets blocked because
server traffic looks nothing like a real phone. The Graph API is an officially sanctioned
developer integration — Meta expects automated posting from it.

## Credentials (pre-loaded)

```python
import os
TOKEN   = os.environ["INSTAGRAM_GRAPH_TOKEN"]   # Long-lived Page access token
IG_ID   = os.environ["INSTAGRAM_BUSINESS_ID"]   # Instagram Business Account ID
BASE    = "https://graph.facebook.com/v21.0"
```

## Setup status

Requires a Facebook Page linked to the Instagram Business account.
Check if credentials are available:

```bash
python3 -c "
import os
token = os.environ.get('INSTAGRAM_GRAPH_TOKEN', '')
ig_id = os.environ.get('INSTAGRAM_BUSINESS_ID', '')
print('Graph API ready:', bool(token and ig_id))
print('Token:', token[:20] + '...' if token else 'NOT SET')
print('IG ID:', ig_id or 'NOT SET')
"
```

If not set, tell the user the Facebook Page + token setup is still needed.

## Post a Photo

The Graph API requires a **publicly accessible image URL** for feed posts.
Use `upload_to_imgbb()` to host the image first.

```python
import os, requests
from pathlib import Path

BASE  = "https://graph.facebook.com/v21.0"
TOKEN = os.environ["INSTAGRAM_GRAPH_TOKEN"]
IG_ID = os.environ["INSTAGRAM_BUSINESS_ID"]

def upload_to_imgbb(image_path: str) -> str:
    """Upload a local image to imgBB and return its public URL."""
    api_key = os.environ["IMGBB_API_KEY"]
    with open(image_path, "rb") as f:
        resp = requests.post(
            "https://api.imgbb.com/1/upload",
            params={"key": api_key},
            files={"image": f},
            timeout=30,
        )
    resp.raise_for_status()
    return resp.json()["data"]["url"]

def post_photo(image_path: str, caption: str) -> str:
    """Post a photo to Instagram. Returns the media ID."""
    # 1. Host the image publicly
    image_url = upload_to_imgbb(image_path)

    # 2. Create media container
    r = requests.post(
        f"{BASE}/{IG_ID}/media",
        params={
            "image_url": image_url,
            "caption": caption,
            "access_token": TOKEN,
        },
        timeout=30,
    )
    r.raise_for_status()
    container_id = r.json()["id"]

    # 3. Publish
    r = requests.post(
        f"{BASE}/{IG_ID}/media_publish",
        params={"creation_id": container_id, "access_token": TOKEN},
        timeout=30,
    )
    r.raise_for_status()
    media_id = r.json()["id"]
    print(f"Posted: https://www.instagram.com/p/{media_id}/")
    return media_id
```

## Post a Reel (video)

Reels use a resumable upload — no public URL needed, binary is uploaded directly.

```python
import os, requests, time

def post_reel(video_path: str, caption: str, cover_image_path: str = None) -> str:
    # 1. Initialize upload
    r = requests.post(
        f"{BASE}/{IG_ID}/media",
        params={
            "media_type": "REELS",
            "caption": caption,
            "access_token": TOKEN,
        },
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    container_id = data["id"]
    upload_url = data.get("video_upload_url") or data.get("uri")

    # 2. Upload binary
    with open(video_path, "rb") as f:
        requests.post(upload_url, data=f, headers={"Content-Type": "video/mp4"}, timeout=120)

    # 3. Wait for processing
    time.sleep(15)

    # 4. Publish
    r = requests.post(
        f"{BASE}/{IG_ID}/media_publish",
        params={"creation_id": container_id, "access_token": TOKEN},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["id"]
```

## Get Account Insights

```python
import os, requests

def get_insights(period: str = "day") -> dict:
    """period: 'day', 'week', 'month', 'lifetime'"""
    r = requests.get(
        f"{BASE}/{IG_ID}/insights",
        params={
            "metric": "reach,impressions,profile_views,follower_count",
            "period": period,
            "access_token": TOKEN,
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()

def get_profile() -> dict:
    r = requests.get(
        f"{BASE}/{IG_ID}",
        params={
            "fields": "followers_count,media_count,biography,website,name,username",
            "access_token": TOKEN,
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()
```

## Read & Reply to Comments

```python
def get_recent_media(limit: int = 10) -> list:
    r = requests.get(
        f"{BASE}/{IG_ID}/media",
        params={
            "fields": "id,caption,like_count,comments_count,timestamp,permalink",
            "limit": limit,
            "access_token": TOKEN,
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("data", [])

def get_comments(media_id: str) -> list:
    r = requests.get(
        f"{BASE}/{media_id}/comments",
        params={"fields": "id,text,username,timestamp", "access_token": TOKEN},
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("data", [])

def reply_to_comment(comment_id: str, message: str) -> str:
    r = requests.post(
        f"{BASE}/{comment_id}/replies",
        params={"message": message, "access_token": TOKEN},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["id"]
```

## Full Autonomous Workflow (Nano Banana 2 → imgBB → Instagram)

```python
import os, uuid, base64
from pathlib import Path
from google import genai
from google.genai import types

OUTPUT_DIR = Path("/workspace/projects/instagram/generated")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. Generate image
gc = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
response = gc.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="Generate an image of: your detailed prompt",
    config=types.GenerateContentConfig(response_modalities=["image"]),
)
filename = f"{uuid.uuid4().hex}.png"
image_path = OUTPUT_DIR / filename
for part in response.candidates[0].content.parts:
    if part.inline_data:
        image_path.write_bytes(base64.b64decode(part.inline_data.data))
        break

# 2. Preview via WhatsApp (use send_image MCP tool — wait for approval before posting)

# 3. Post via Graph API
post_photo(str(image_path), "Your caption here\n\n#hashtag1 #hashtag2")
```

## Token Expiry

Long-lived Page access tokens are valid for **60 days** and must be refreshed:

```bash
# Refresh a long-lived token (run before expiry)
curl -s "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=OLD_TOKEN"
```

Tell the user to update INSTAGRAM_GRAPH_TOKEN in BWS when the token is refreshed.

## Rate Limits

- **Content publishing**: 200 posts/day per account
- **API calls**: 200 calls/hour per access token
- No IP restrictions — all requests are authenticated by token
