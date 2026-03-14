---
name: beehiiv
description: Manage a Beehiiv newsletter — create and publish posts, manage subscribers, check analytics, and automate the editorial calendar. Use for anything related to the newsletter operation.
allowed-tools: Bash
---

# Beehiiv Newsletter Management

Interact with Beehiiv via their REST API. Credentials are pre-loaded from environment variables.

## Credentials

```bash
BEEHIIV_API_KEY        # Bearer token for API auth
BEEHIIV_PUBLICATION_ID # e.g. pub_xxxxxxxx
```

## Base URL

```
https://api.beehiiv.com/v2
```

## Create & Publish a Post

```bash
# Create a draft post
curl -s -X POST "https://api.beehiiv.com/v2/publications/$BEEHIIV_PUBLICATION_ID/posts" \
  -H "Authorization: Bearer $BEEHIIV_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Your Subject Line",
    "content": {
      "free": {
        "html": "<p>Your HTML content here</p>"
      }
    },
    "status": "draft",
    "send_at": null
  }'

# Publish immediately
curl -s -X PATCH "https://api.beehiiv.com/v2/publications/$BEEHIIV_PUBLICATION_ID/posts/{POST_ID}" \
  -H "Authorization: Bearer $BEEHIIV_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "confirmed"}'
```

## List Recent Posts

```bash
curl -s "https://api.beehiiv.com/v2/publications/$BEEHIIV_PUBLICATION_ID/posts?limit=10" \
  -H "Authorization: Bearer $BEEHIIV_API_KEY" | python3 -m json.tool
```

## Get Subscriber Stats

```bash
curl -s "https://api.beehiiv.com/v2/publications/$BEEHIIV_PUBLICATION_ID/subscriptions?limit=1" \
  -H "Authorization: Bearer $BEEHIIV_API_KEY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Total subscribers:', d.get('total_results'))
"
```

## Get Publication Analytics

```bash
curl -s "https://api.beehiiv.com/v2/publications/$BEEHIIV_PUBLICATION_ID" \
  -H "Authorization: Bearer $BEEHIIV_API_KEY" | python3 -m json.tool
```

## Tips

- Always check `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID` are set before making calls
- Draft first, review, then publish — don't publish directly unless explicitly asked
- Beehiiv supports full HTML in post content — use clean, email-safe HTML
- For scheduled sends, set `send_at` to an ISO 8601 timestamp
