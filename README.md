# AAS QuickCard

A Chrome extension that transforms Asset Administration Shell (AAS) data into human-friendly equipment cards.

## Features

- **Read from Page** - Extract AAS JSON from any web page
- **Upload AASX** - Load AASX packages (supports both JSON and XML formats)
- **Paste JSON** - Paste AAS JSON directly
- **Demo Mode** - Try with sample data

### Role-Based Views

Switch between different user roles to see relevant information:

| Role | Visible Content |
|------|-----------------|
| **Operator** | Safety docs, manuals |
| **Maintenance** | All docs + service contacts |
| **Quality** | Certificates |
| **Procurement** | Ordering info + contacts |

### Additional Features

- ⭐ Pin frequently accessed assets to favorites
- 📱 Generate QR labels for asset identification
- 📋 Copy support ticket text for quick reporting
- 🔍 Search and filter documents

## Installation

### From Source

1. Clone this repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Open Chrome and go to `chrome://extensions`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `dist` folder

### From Chrome Web Store

Coming soon.

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch mode for development
npm run dev

# Type check
npm run lint

# Validate manifest
npm run validate-manifest

# Check for remote hosted code (Chrome Web Store compliance)
npm run check-rhc

# Create ZIP for Chrome Web Store submission
npm run pack
```

## Supported Formats

- **AASX packages** - ZIP-based packages with XML or JSON AAS data
- **AAS JSON** - Direct JSON format (admin-shell.io spec)
- **AAS XML** - XML format (admin-shell.io/aas/1/0 namespace)

## Privacy

AAS QuickCard processes all data locally in your browser. No data is sent to external servers. See [Privacy Policy](docs/PRIVACY.md).

## Permissions

- `sidePanel` - Display the QuickCard interface
- `storage` - Save favorites and settings locally
- `scripting` - Read AAS JSON from web pages
- `activeTab` - Temporary tab access when you click the extension

## License

MIT
