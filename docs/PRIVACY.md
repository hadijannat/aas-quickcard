# Privacy Policy for AAS QuickCard

**Last Updated:** February 2026

## Overview

AAS QuickCard is a Chrome extension that helps you view Asset Administration Shell (AAS) data in a user-friendly format. This privacy policy explains how we handle your data.

## Data Collection

### What We Collect

**We do not collect any personal data.**

AAS QuickCard operates entirely locally in your browser. We do not:
- Send any data to external servers
- Track your browsing activity
- Store any analytics or telemetry
- Use cookies or tracking pixels

### Data Stored Locally

The extension stores the following data locally on your device using Chrome's storage API:

1. **Favorites**: When you pin an asset, its information is saved locally so you can access it later.
2. **Settings**: Your preferences (default role, custom field mappings) are saved locally.

This data never leaves your device.

## Permissions

The extension requests the following permissions:

- **sidePanel**: Required to display the QuickCard interface in Chrome's side panel.
- **storage**: Required to save your favorites and settings locally.
- **scripting**: Required to read AAS JSON from web pages when you click "Read this page".
- **activeTab**: Grants temporary access to the current tab only when you click the extension. This is the most privacy-respecting way to access page content.

## Data Sources

When you use AAS QuickCard, the extension processes data from:

1. **Web pages**: When you click "Read this page", the extension reads the visible content of the current tab to find AAS JSON.
2. **Uploaded files**: When you upload an AASX file, it is processed entirely in your browser.
3. **Pasted JSON**: When you paste JSON, it is processed entirely in your browser.

None of this data is sent to any external servers.

## Third-Party Services

AAS QuickCard does not use any third-party services, analytics, or tracking.

## Document Links

When you click to open a document from the Documents list, the extension opens the URL in a new tab. These URLs come from the AAS data you're viewing and may point to external websites. We have no control over these external sites and their privacy practices.

## Children's Privacy

This extension does not knowingly collect any personal information from children.

## Changes to This Policy

We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

## Open Source

AAS QuickCard is open source. You can review the complete source code to verify our privacy practices.
