# AAS QuickCard - Claude Code Guidelines

## Project Overview

AAS QuickCard is a Chrome extension published on the [Chrome Web Store](https://chromewebstore.google.com/detail/aas-quickcard/ihfcmhcfpmklfgfhipfdbgdpnchcmmim) (ID: `ihfcmhcfpmklfgfhipfdbgdpnchcmmim`) for displaying Asset Administration Shell (AAS) data in a human-friendly format. It extracts asset information from AASX files, JSON APIs, and web pages, presenting it in a role-filtered side panel.

## Tech Stack

- **TypeScript** - Primary language
- **Vite** - Build tool
- **Chrome Extension Manifest V3** - Extension platform
- **JSZip** - AASX file parsing (bundled)
- **QRCode** - QR code generation (bundled)

## Project Structure

```
src/
├── parser/                 # Data extraction modules
│   ├── aasx-parser.ts     # AASX file parsing
│   ├── heuristics.ts      # Field extraction logic
│   ├── normalize.ts       # Unified snapshot creation
│   ├── submodelRecognizer.ts  # IDTA template matching
│   ├── pcfExtractor.ts    # Carbon footprint extraction
│   └── sparePartsExtractor.ts # Spare parts extraction
├── compliance/            # Regulatory compliance
│   ├── complianceProfiles.ts  # CE, REACH, RoHS, DPP profiles
│   └── checklistGenerator.ts  # Compliance checking
├── shared/                # Shared utilities
│   ├── types.ts           # TypeScript type definitions
│   ├── storage.ts         # Chrome storage wrapper
│   └── search.ts          # Favorites search/filter
├── sidepanel/             # Main UI
│   ├── sidepanel.html     # UI structure
│   ├── sidepanel.ts       # UI logic
│   ├── sidepanel.css      # Styles
│   └── comparison.ts      # Asset comparison
├── options/               # Settings page
├── content/               # Content script for page reading
└── background/            # Service worker
```

## Key Commands

```bash
npm run dev          # Development build with watch
npm run build        # Production build
npm run check-rhc    # Check for remote hosted code (CWS compliance)
npm run validate-manifest  # Validate manifest.json
```

## Chrome Web Store Compliance

**Critical**: This extension must not use remote hosted code.

- All JavaScript bundled locally
- No CDN imports or external scripts
- No dynamic code execution
- Permissions limited to: `sidePanel`, `storage`, `scripting`, `activeTab`

Run `npm run check-rhc` before any release.

## Architecture Decisions

### Type System
- All types defined in `src/shared/types.ts`
- Use strict TypeScript - no `any` types
- Extended types: `AasSnapshot`, `FavoriteAsset`, `RoleVisibility`

### Data Flow
1. Input: AASX file / JSON paste / Page extraction
2. Parse: `normalize.ts` orchestrates all extractors
3. Enrich: Submodels, PCF, spare parts, lifecycle phase
4. Display: Role-filtered rendering in sidepanel
5. Store: Chrome local storage for favorites

### Role-Based Visibility
Four roles with different visibility:
- **Operator**: Safety docs, manuals, PCF
- **Maintenance**: + Service contacts, spare parts
- **Quality**: + Certificates, compliance checklist
- **Procurement**: + Ordering info, spare parts

### DOM Security
- Use `textContent` for text, not `innerHTML`
- Create elements with `document.createElement()`
- Escape user content in comparison tables

## IDTA Submodel Templates

The extension recognizes standard IDTA submodel templates:
- IDTA-02006: Digital Nameplate
- IDTA-02004: Handover Documentation
- IDTA-02023: Carbon Footprint (PCF)
- IDTA-02002: Technical Data
- And others via semantic ID or idShort patterns

## Testing

### Manual Testing Checklist
1. Load extension: `chrome://extensions` → Load unpacked → select `dist/`
2. Test Demo Mode button
3. Upload an AASX file
4. Verify role switching filters content
5. Pin an asset, add tags, search favorites
6. Run compliance check
7. Compare 2-3 pinned assets

### Validation
```bash
npm run build && npm run check-rhc && npm run validate-manifest
```

## Common Patterns

### Adding a New Extractor
1. Create `src/parser/newExtractor.ts`
2. Add types to `src/shared/types.ts`
3. Import and call in `src/parser/normalize.ts`
4. Add UI in sidepanel files
5. Update `RoleVisibility` if needed

### Adding a Compliance Profile
1. Add profile definition in `src/compliance/complianceProfiles.ts`
2. Add to `ComplianceProfileType` union in types
3. Add option to profile select in HTML

## Gotchas

- AASX files are ZIP archives - use JSZip
- AAS JSON has many format variations - heuristics handle this
- Chrome storage has 10MB limit - monitor usage
- Semantic IDs can be strings or objects with `keys` array
