# Permission Justification

This document explains why AAS QuickCard requests each Chrome extension permission. All permissions follow the principle of least privilege.

## Permissions Declared

| Permission | Why Needed |
|------------|-----------|
| `sidePanel` | Core UI - displays asset cards |
| `storage` | Saves favorites and settings locally |
| `scripting` | Extracts AAS JSON from web pages |
| `activeTab` | Accesses current tab when user clicks |

---

## Detailed Justification

### `sidePanel`

**Purpose:** Display the main user interface as a side panel.

**Code References:**
- `src/background/service-worker.ts:6` - Opens side panel on icon click
- `src/background/service-worker.ts:11` - Sets panel behavior

**Justification:** The side panel is the primary interface for viewing asset cards. Without this permission, the extension would have no UI.

---

### `storage`

**Purpose:** Persist user data locally (favorites, settings, field mappings).

**Code References:**
- `src/shared/storage.ts` - All storage operations
- Uses `chrome.storage.local` exclusively (10MB limit)

**Justification:** Users need to save favorited assets and customize settings. All data stays on-device; nothing is transmitted externally.

**Data Stored:**
- Pinned asset snapshots (trimmed for storage efficiency)
- User role preference
- Custom field mappings
- Tags and categories

---

### `scripting`

**Purpose:** Extract AAS JSON data from web pages when user requests it.

**Code References:**
- `src/background/service-worker.ts:45-48` - Injects extraction function

**Justification:** Many AAS servers expose JSON directly at URLs. The "Read from Page" feature needs to inject a content script to parse this data. This is only triggered by explicit user action (clicking "Read from Page").

**Security Notes:**
- Script injection only runs on the active tab
- Only extracts text content (JSON parsing)
- No modifications to page content
- User-initiated only

---

### `activeTab`

**Purpose:** Access the current tab's URL and content when user interacts.

**Code References:**
- `src/background/service-worker.ts:37` - Queries active tab for extraction

**Justification:** When extracting AAS data from a page, the extension needs to know which tab is active. This permission grants access only when the user explicitly interacts with the extension.

**Privacy Notes:**
- No background tab monitoring
- Access granted only during user interaction
- URL used only to display source in asset cards

---

## Host Permissions

**None declared.** AAS QuickCard does not request access to any specific hosts.

---

## What We DON'T Request

| Permission | Why Not Needed |
|------------|---------------|
| `tabs` | `activeTab` is sufficient |
| `webRequest` | No network interception needed |
| `<all_urls>` | No broad host access needed |
| `downloads` | Users copy/paste, no downloads |
| `history` | No browsing history access |
| `cookies` | No cookie access needed |

---

## Compliance Notes

- All code is bundled locally (no remote hosted code)
- CSP: `script-src 'self'` strictly enforced
- No dynamic code execution (eval or Function constructor)
- No external script loading

For CWS compliance verification, run:
```bash
npm run check-rhc
npm run validate-manifest
```
