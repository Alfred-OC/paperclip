---
name: google-workspace
description: Access Gmail, Google Drive, Calendar, Docs, and Sheets. Use when the user wants to read or send emails, manage calendar events, create or edit Google Docs/Sheets, upload files to Drive, or export documents.
---

# Google Workspace (`gws` CLI)

Unified CLI for all Google Workspace APIs — Drive, Docs, Sheets, Gmail, Calendar, and more.

**Required env vars** (injected automatically from Bitwarden):
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

---

## Auth Setup (run once per container session)

Before any `gws` command, write a credentials file from the Bitwarden env vars.
The `gws` CLI reads this file via Google's auth library, which **auto-refreshes
the access token** whenever it expires — no manual token management needed.

```bash
mkdir -p ~/.config/gws
python3 -c "
import json, os
creds = {
    'type': 'authorized_user',
    'client_id': os.environ['GOOGLE_CLIENT_ID'],
    'client_secret': os.environ['GOOGLE_CLIENT_SECRET'],
    'refresh_token': os.environ['GOOGLE_REFRESH_TOKEN'],
    'token_uri': 'https://oauth2.googleapis.com/token',
}
json.dump(creds, open(os.path.expanduser('~/.config/gws/credentials.json'), 'w'))
"
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=~/.config/gws/credentials.json
```

All subsequent `gws` commands in the same session will use this file automatically,
and the library silently refreshes the token when it expires.

---

## CLI Syntax

```bash
gws <service> <resource> [sub-resource] <method> [flags]
```

**Output**: JSON by default (parseable). Add `--format table` for human-readable output.

**Inspect any command** before running it:
```bash
gws schema <service>.<resource>.<method>   # see required params and types
gws <service> --help                       # browse resources and methods
```

**Pagination** (for large result sets):
```bash
--page-all              # auto-paginate, outputs NDJSON
--page-limit <N>        # max pages (default 10)
```

---

## Drive

```bash
# List files
gws drive files list --params '{"pageSize": 20}'
gws drive files list --params '{"pageSize": 20, "q": "name contains '\''report'\''"}'

# Search files
gws drive files list --params '{"q": "mimeType = '\''application/pdf'\'' and trashed = false"}'

# Get file metadata
gws drive files get --params '{"fileId": "FILE_ID", "fields": "id,name,mimeType,webViewLink"}'

# Upload a file
gws drive files +upload --upload /path/to/file.pdf --json '{"name": "Report.pdf"}'

# Download a file
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' -o /tmp/output.pdf

# Export Google Doc/Sheet/Slide
gws drive files export --params '{"fileId": "DOC_ID", "mimeType": "application/pdf"}' -o /tmp/out.pdf
gws drive files export --params '{"fileId": "SHEET_ID", "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}' -o /tmp/out.xlsx
gws drive files export --params '{"fileId": "SLIDE_ID", "mimeType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"}' -o /tmp/out.pptx

# Share a file
gws drive permissions create \
  --params '{"fileId": "FILE_ID", "fields": "id"}' \
  --json '{"type": "user", "role": "reader", "emailAddress": "user@example.com"}'

# Create a folder
gws drive files create --json '{"name": "My Folder", "mimeType": "application/vnd.google-apps.folder"}'
```

---

## Docs

```bash
# Create a blank document
gws docs documents create --json '{"title": "My Document"}'

# Read a document (returns full JSON structure)
gws docs documents get --params '{"documentId": "DOC_ID"}'

# Apply updates (insert text, formatting, etc.)
# First, inspect the batchUpdate schema:
gws schema docs.documents.batchUpdate

# Append text using the helper
gws docs documents +write --params '{"documentId": "DOC_ID"}' --json '{"text": "New paragraph text."}'
```

---

## Sheets

```bash
# Create a spreadsheet
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget"}}'

# Read values from a range
gws sheets spreadsheets values get \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1:D20"}'

# Write values to a range
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1", "valueInputOption": "RAW"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95], ["Bob", 87]]}'

# Append rows
gws sheets spreadsheets values +append \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1"}' \
  --json '{"values": [["Carol", 92]]}'

# Read using the helper
gws sheets spreadsheets +read \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1:C10"}'

# Batch update (add sheets, format cells, etc.)
gws schema sheets.spreadsheets.batchUpdate   # inspect first
```

---

## Gmail

```bash
# Show unread inbox summary
gws gmail users messages +triage

# List recent messages
gws gmail users messages list --params '{"userId": "me", "maxResults": 20}'

# Search messages
gws gmail users messages list --params '{"userId": "me", "q": "from:boss@example.com is:unread"}'

# Read a message
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID", "format": "full"}'

# Send an email
gws gmail users messages +send \
  --params '{"userId": "me"}' \
  --json '{"to": "user@example.com", "subject": "Hello", "body": "Message text."}'

# Reply to a message
gws gmail users threads get --params '{"userId": "me", "id": "THREAD_ID"}'

# Archive a message
gws gmail users messages modify \
  --params '{"userId": "me", "id": "MSG_ID"}' \
  --json '{"removeLabelIds": ["INBOX"]}'

# Trash a message
gws gmail users messages trash --params '{"userId": "me", "id": "MSG_ID"}'
```

---

## Calendar

```bash
# Show upcoming events across all calendars
gws calendar events +agenda

# List upcoming events
gws calendar events list \
  --params '{"calendarId": "primary", "timeMin": "2026-01-01T00:00:00Z", "maxResults": 20, "singleEvents": true, "orderBy": "startTime"}'

# Create an event
gws calendar events insert \
  --params '{"calendarId": "primary"}' \
  --json '{
    "summary": "Team Meeting",
    "start": {"dateTime": "2026-03-15T10:00:00", "timeZone": "America/New_York"},
    "end":   {"dateTime": "2026-03-15T11:00:00", "timeZone": "America/New_York"}
  }'

# Quick add from natural language
gws calendar events quickAdd \
  --params '{"calendarId": "primary", "text": "Lunch with Alice tomorrow at noon"}'

# Update an event
gws calendar events patch \
  --params '{"calendarId": "primary", "eventId": "EVENT_ID"}' \
  --json '{"summary": "Updated Title"}'

# Delete an event
gws calendar events delete --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'

# Check free/busy
gws calendar freebusy query \
  --json '{
    "timeMin": "2026-03-10T00:00:00Z",
    "timeMax": "2026-03-11T00:00:00Z",
    "items": [{"id": "primary"}]
  }'
```

---

## Typical Workflows

### Create a report doc and share it
```bash
# Auth (do this once per session before any gws command)
mkdir -p ~/.config/gws && python3 -c "import json,os; json.dump({'type':'authorized_user','client_id':os.environ['GOOGLE_CLIENT_ID'],'client_secret':os.environ['GOOGLE_CLIENT_SECRET'],'refresh_token':os.environ['GOOGLE_REFRESH_TOKEN'],'token_uri':'https://oauth2.googleapis.com/token'},open(os.path.expanduser('~/.config/gws/credentials.json'),'w'))" && export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=~/.config/gws/credentials.json

DOC_ID=$(gws docs documents create --json '{"title": "Q1 Report"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['documentId'])")
gws docs documents +write --params "{\"documentId\": \"$DOC_ID\"}" --json '{"text": "Executive Summary\n\nKey findings..."}'
gws drive permissions create --params "{\"fileId\": \"$DOC_ID\", \"fields\": \"id\"}" --json '{"type": "user", "role": "reader", "emailAddress": "user@example.com"}'
echo "https://docs.google.com/document/d/$DOC_ID/edit"
```

### Upload a file and get the Drive link
```bash
FILE_ID=$(gws drive files +upload --upload /tmp/report.pdf --json '{"name": "Report.pdf"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "https://drive.google.com/file/d/$FILE_ID/view"
```

### Triage unread email and reply
```bash
gws gmail users messages +triage
# Read specific message
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID", "format": "full"}'
# Reply
gws gmail users messages +send --params '{"userId": "me"}' --json '{"to": "sender@example.com", "subject": "Re: Subject", "body": "Thanks for your message."}'
```
