# Privacy Policy for AAS QuickCard

**Last Updated:** February 4, 2026

## Overview

AAS QuickCard is a Chrome extension that displays Asset Administration Shell (AAS) data in a human-readable format. This privacy policy explains how the extension handles user data.

## Data Collection

**AAS QuickCard does not collect, transmit, or share any personal data.**

All data processing occurs entirely within your browser. No information is sent to external servers.

## Data Storage

The extension stores the following data locally on your device using Chrome's built-in storage API:

| Data Type | Purpose | Storage Location |
|-----------|---------|------------------|
| User preferences | Remember your selected role and display settings | Chrome local storage |
| Pinned assets | Save favorite assets for quick access | Chrome local storage |
| Tags and notes | Organize your saved assets | Chrome local storage |

This data:
- Never leaves your device
- Is not transmitted to any external servers
- Is not shared with third parties
- Can be deleted by removing the extension

## Permissions Explained

### sidePanel
Displays the extension interface in Chrome's side panel.

### storage
Saves your preferences and pinned assets locally on your device.

### scripting
Extracts AAS data from web pages when you click "Read this page". Only activates when you explicitly request it.

### activeTab
Accesses the current page to extract AAS data. Only used when you click "Read this page".

## Data Processing

When you use AAS QuickCard:

1. **File Upload:** AASX/JSON files are parsed entirely in your browser. Files are not uploaded anywhere.

2. **Page Reading:** When you click "Read this page", the extension reads the current tab's content to find AAS JSON data. This data is processed locally.

3. **Demo Mode:** Sample data is bundled with the extension. No network requests are made.

## Third-Party Services

AAS QuickCard does not use any third-party analytics, tracking, or data collection services.

## Children's Privacy

This extension does not knowingly collect any information from children under 13 years of age.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date above.

## Contact

For questions about this privacy policy or the extension:
- GitHub Issues: https://github.com/hadijannat/aas-quickcard/issues

## Your Rights

You can:
- View all stored data via Chrome's developer tools
- Delete all data by removing the extension
- Clear specific data through the extension's options page

---

*This extension is open source. You can review the complete source code at https://github.com/hadijannat/aas-quickcard*
