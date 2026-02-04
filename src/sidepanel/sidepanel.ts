import type { AasSnapshot, UserRole, ExtensionMessage, RoleVisibility, DocKind, AasDocument, AasContact, SubmodelInfo, SparePart, ComplianceProfileType, LifecyclePhase } from '../shared/types';
import { ROLE_VISIBILITY } from '../shared/types';
import { loadSettings, setCurrentRole, loadFavorites, addFavorite, removeFavorite, addTags, removeTags, getAllTags, getAllCategories, getStorageUsage, formatBytes, type FavoriteAsset } from '../shared/storage';
import { createSnapshotFromPaste, createSnapshotFromPage } from '../parser/normalize';
import { parseFile } from '../parser/aasx-parser';
import { formatPcfValue } from '../parser/pcfExtractor';
import { formatSparePartsList } from '../parser/sparePartsExtractor';
import { runComplianceCheck, generateComplianceReport, calculateComplianceScore, getComplianceStatusLabel } from '../compliance/checklistGenerator';
import { compareAssets, generateComparisonTable, generateComparisonMarkdown } from './comparison';
import { searchFavorites } from '../shared/search';

// State
let currentSnapshot: AasSnapshot | null = null;
let currentRole: UserRole = 'maintenance';
let selectedFavorites: Set<string> = new Set();
let activeTagFilters: Set<string> = new Set();
let currentComplianceProfile: ComplianceProfileType = 'ce-marking';
let editingFavoriteId: string | null = null;

// DOM Elements
const elements = {
  // Buttons
  btnReadPage: document.getElementById('btn-read-page') as HTMLButtonElement,
  btnUploadAasx: document.getElementById('btn-upload-aasx') as HTMLButtonElement,
  btnPasteJson: document.getElementById('btn-paste-json') as HTMLButtonElement,
  btnDemoMode: document.getElementById('btn-demo-mode') as HTMLButtonElement,
  btnOptions: document.getElementById('btn-options') as HTMLButtonElement,
  btnHelp: document.getElementById('btn-help') as HTMLButtonElement,
  btnCopyId: document.getElementById('btn-copy-id') as HTMLButtonElement,
  btnCopyLink: document.getElementById('btn-copy-link') as HTMLButtonElement,
  btnPin: document.getElementById('btn-pin') as HTMLButtonElement,
  btnQr: document.getElementById('btn-qr') as HTMLButtonElement,
  btnCopyTicket: document.getElementById('btn-copy-ticket') as HTMLButtonElement,
  btnDismissError: document.getElementById('btn-dismiss-error') as HTMLButtonElement,

  // File input
  fileInput: document.getElementById('file-input') as HTMLInputElement,

  // Role selector
  roleSelect: document.getElementById('role-select') as HTMLSelectElement,

  // Status
  statusArea: document.getElementById('status-area') as HTMLDivElement,
  statusText: document.getElementById('status-text') as HTMLSpanElement,
  errorArea: document.getElementById('error-area') as HTMLDivElement,
  errorText: document.getElementById('error-text') as HTMLSpanElement,

  // Main content
  mainContent: document.getElementById('main-content') as HTMLElement,

  // Asset card
  assetName: document.getElementById('asset-name') as HTMLHeadingElement,
  assetManufacturer: document.getElementById('asset-manufacturer') as HTMLSpanElement,
  assetSerial: document.getElementById('asset-serial') as HTMLSpanElement,
  assetId: document.getElementById('asset-id') as HTMLSpanElement,

  // Documents
  documentsSection: document.getElementById('documents-section') as HTMLElement,
  docsCount: document.getElementById('docs-count') as HTMLSpanElement,
  docsSearch: document.getElementById('docs-search') as HTMLInputElement,
  documentsList: document.getElementById('documents-list') as HTMLUListElement,
  noDocs: document.getElementById('no-docs') as HTMLParagraphElement,

  // Contacts
  contactsSection: document.getElementById('contacts-section') as HTMLElement,
  contactsCount: document.getElementById('contacts-count') as HTMLSpanElement,
  contactsList: document.getElementById('contacts-list') as HTMLUListElement,
  noContacts: document.getElementById('no-contacts') as HTMLParagraphElement,

  // Paste modal
  pasteModal: document.getElementById('paste-modal') as HTMLDivElement,
  pasteTextarea: document.getElementById('paste-textarea') as HTMLTextAreaElement,
  btnPasteCancel: document.getElementById('btn-paste-cancel') as HTMLButtonElement,
  btnPasteSubmit: document.getElementById('btn-paste-submit') as HTMLButtonElement,

  // QR modal
  qrModal: document.getElementById('qr-modal') as HTMLDivElement,
  qrContainer: document.getElementById('qr-container') as HTMLDivElement,
  btnQrClose: document.getElementById('btn-qr-close') as HTMLButtonElement,
  btnQrDownload: document.getElementById('btn-qr-download') as HTMLButtonElement,

  // Favorites
  favoritesSection: document.getElementById('favorites-section') as HTMLElement,
  favoritesList: document.getElementById('favorites-list') as HTMLUListElement,
  noFavorites: document.getElementById('no-favorites') as HTMLParagraphElement,

  // Enhanced - Lifecycle Badge
  lifecycleBadge: document.getElementById('lifecycle-badge') as HTMLSpanElement,

  // Enhanced - Submodels
  submodelsSection: document.getElementById('submodels-section') as HTMLElement,
  submodelsHeader: document.getElementById('submodels-header') as HTMLDivElement,
  submodelsCount: document.getElementById('submodels-count') as HTMLSpanElement,
  submodelsList: document.getElementById('submodels-list') as HTMLUListElement,

  // Enhanced - PCF
  pcfSection: document.getElementById('pcf-section') as HTMLElement,
  pcfValue: document.getElementById('pcf-value') as HTMLSpanElement,
  pcfUnit: document.getElementById('pcf-unit') as HTMLSpanElement,
  pcfScope: document.getElementById('pcf-scope') as HTMLSpanElement,
  pcfMethod: document.getElementById('pcf-method') as HTMLSpanElement,
  pcfValidity: document.getElementById('pcf-validity') as HTMLSpanElement,

  // Enhanced - Spare Parts
  sparepartsSection: document.getElementById('spareparts-section') as HTMLElement,
  sparepartsCount: document.getElementById('spareparts-count') as HTMLSpanElement,
  sparePartsList: document.getElementById('spareparts-list') as HTMLUListElement,
  noSpareParts: document.getElementById('no-spareparts') as HTMLParagraphElement,
  btnCopyParts: document.getElementById('btn-copy-parts') as HTMLButtonElement,

  // Enhanced - Compliance
  btnCompliance: document.getElementById('btn-compliance') as HTMLButtonElement,
  complianceModal: document.getElementById('compliance-modal') as HTMLDivElement,
  complianceProfileSelect: document.getElementById('compliance-profile-select') as HTMLSelectElement,
  complianceSummary: document.getElementById('compliance-summary') as HTMLDivElement,
  complianceChecklist: document.getElementById('compliance-checklist') as HTMLDivElement,
  btnComplianceClose: document.getElementById('btn-compliance-close') as HTMLButtonElement,
  btnComplianceExport: document.getElementById('btn-compliance-export') as HTMLButtonElement,

  // Enhanced - Favorites
  storageIndicator: document.getElementById('storage-indicator') as HTMLDivElement,
  storageFill: document.getElementById('storage-fill') as HTMLDivElement,
  storageText: document.getElementById('storage-text') as HTMLSpanElement,
  favoritesSearch: document.getElementById('favorites-search') as HTMLInputElement,
  favoritesCategory: document.getElementById('favorites-category') as HTMLSelectElement,
  favoritesTags: document.getElementById('favorites-tags') as HTMLDivElement,
  compareToolbar: document.getElementById('compare-toolbar') as HTMLDivElement,
  compareCount: document.getElementById('compare-count') as HTMLSpanElement,
  btnCompare: document.getElementById('btn-compare') as HTMLButtonElement,
  btnClearSelection: document.getElementById('btn-clear-selection') as HTMLButtonElement,

  // Enhanced - Comparison Modal
  comparisonModal: document.getElementById('comparison-modal') as HTMLDivElement,
  comparisonTableContainer: document.getElementById('comparison-table-container') as HTMLDivElement,
  btnComparisonClose: document.getElementById('btn-comparison-close') as HTMLButtonElement,
  btnComparisonCopy: document.getElementById('btn-comparison-copy') as HTMLButtonElement,

  // Enhanced - Tag Modal
  tagModal: document.getElementById('tag-modal') as HTMLDivElement,
  currentTags: document.getElementById('current-tags') as HTMLDivElement,
  newTagInput: document.getElementById('new-tag-input') as HTMLInputElement,
  btnAddTag: document.getElementById('btn-add-tag') as HTMLButtonElement,
  suggestedTags: document.getElementById('suggested-tags') as HTMLDivElement,
  btnTagClose: document.getElementById('btn-tag-close') as HTMLButtonElement,
};

// Initialize
async function init(): Promise<void> {
  // Load settings
  const settings = await loadSettings();
  currentRole = settings.currentRole;
  elements.roleSelect.value = currentRole;

  // Load and display favorites
  await refreshFavorites();

  // Set up event listeners
  setupEventListeners();
}

function setupEventListeners(): void {
  // Action buttons
  elements.btnReadPage.addEventListener('click', handleReadPage);
  elements.btnUploadAasx.addEventListener('click', () => elements.fileInput.click());
  elements.btnPasteJson.addEventListener('click', openPasteModal);
  elements.btnDemoMode.addEventListener('click', handleDemoMode);
  elements.btnOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
  elements.btnHelp.addEventListener('click', showHelp);

  // File input
  elements.fileInput.addEventListener('change', handleFileUpload);

  // Role selector
  elements.roleSelect.addEventListener('change', handleRoleChange);

  // Asset actions
  elements.btnCopyId.addEventListener('click', handleCopyId);
  elements.btnCopyLink.addEventListener('click', handleCopyLink);
  elements.btnPin.addEventListener('click', handlePin);
  elements.btnQr.addEventListener('click', handleShowQr);
  elements.btnCopyTicket.addEventListener('click', handleCopyTicket);

  // Error dismiss
  elements.btnDismissError.addEventListener('click', hideError);

  // Document search
  elements.docsSearch.addEventListener('input', filterDocuments);

  // Paste modal
  elements.btnPasteCancel.addEventListener('click', closePasteModal);
  elements.btnPasteSubmit.addEventListener('click', handlePasteSubmit);

  // QR modal
  elements.btnQrClose.addEventListener('click', closeQrModal);
  elements.btnQrDownload.addEventListener('click', handleQrDownload);

  // Enhanced - Submodels
  elements.submodelsHeader?.addEventListener('click', toggleSubmodelsSection);

  // Enhanced - Spare Parts
  elements.btnCopyParts?.addEventListener('click', handleCopyPartsList);
  elements.sparepartsSection?.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', handleSparePartsFilter);
  });

  // Enhanced - Compliance
  elements.btnCompliance?.addEventListener('click', openComplianceModal);
  elements.btnComplianceClose?.addEventListener('click', closeComplianceModal);
  elements.btnComplianceExport?.addEventListener('click', handleComplianceExport);
  elements.complianceProfileSelect?.addEventListener('change', handleComplianceProfileChange);

  // Enhanced - Favorites Search & Filter
  elements.favoritesSearch?.addEventListener('input', handleFavoritesSearch);
  elements.favoritesCategory?.addEventListener('change', handleFavoritesSearch);

  // Enhanced - Comparison
  elements.btnCompare?.addEventListener('click', openComparisonModal);
  elements.btnClearSelection?.addEventListener('click', clearFavoriteSelection);
  elements.btnComparisonClose?.addEventListener('click', closeComparisonModal);
  elements.btnComparisonCopy?.addEventListener('click', handleCopyComparison);

  // Enhanced - Tag Modal
  elements.btnAddTag?.addEventListener('click', handleAddTag);
  elements.btnTagClose?.addEventListener('click', closeTagModal);
  elements.newTagInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddTag();
  });

  // Click outside modal to close
  elements.pasteModal.addEventListener('click', (e) => {
    if (e.target === elements.pasteModal) closePasteModal();
  });
  elements.qrModal.addEventListener('click', (e) => {
    if (e.target === elements.qrModal) closeQrModal();
  });
  elements.complianceModal?.addEventListener('click', (e) => {
    if (e.target === elements.complianceModal) closeComplianceModal();
  });
  elements.comparisonModal?.addEventListener('click', (e) => {
    if (e.target === elements.comparisonModal) closeComparisonModal();
  });
  elements.tagModal?.addEventListener('click', (e) => {
    if (e.target === elements.tagModal) closeTagModal();
  });
}

// Read from page
async function handleReadPage(): Promise<void> {
  showLoading('Reading page...');

  try {
    const response = await sendMessage({ type: 'EXTRACT_FROM_PAGE' }) as {
      success?: boolean;
      rawJson?: string;
      url?: string;
      error?: string;
    };

    if (response.error) {
      showError(response.error);
      return;
    }

    if (!response.rawJson) {
      showError('No JSON content extracted from page');
      return;
    }

    const snapshot = createSnapshotFromPage(response.rawJson, response.url || '');
    displaySnapshot(snapshot);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Failed to read page');
  }
}

// File upload
async function handleFileUpload(): Promise<void> {
  const file = elements.fileInput.files?.[0];
  if (!file) return;

  showLoading(`Parsing ${file.name}...`);

  try {
    const snapshot = await parseFile(file);
    displaySnapshot(snapshot);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Failed to parse file');
  }

  // Reset file input
  elements.fileInput.value = '';
}

// Demo mode
async function handleDemoMode(): Promise<void> {
  showLoading('Loading demo data...');

  try {
    const response = await fetch(chrome.runtime.getURL('demo/sample-aas.json'));
    if (!response.ok) {
      throw new Error('Demo data not found');
    }
    const rawJson = await response.text();
    const snapshot = createSnapshotFromPaste(rawJson);
    displaySnapshot(snapshot);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Failed to load demo');
  }
}

// Paste modal
function openPasteModal(): void {
  elements.pasteTextarea.value = '';
  elements.pasteModal.classList.remove('hidden');
  elements.pasteTextarea.focus();
}

function closePasteModal(): void {
  elements.pasteModal.classList.add('hidden');
}

function handlePasteSubmit(): void {
  const rawJson = elements.pasteTextarea.value.trim();
  if (!rawJson) {
    showError('Please paste some JSON');
    return;
  }

  closePasteModal();
  showLoading('Parsing JSON...');

  try {
    const snapshot = createSnapshotFromPaste(rawJson);
    displaySnapshot(snapshot);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Failed to parse JSON');
  }
}

// Role change
async function handleRoleChange(): Promise<void> {
  currentRole = elements.roleSelect.value as UserRole;
  await setCurrentRole(currentRole);

  if (currentSnapshot) {
    applyRoleFiltering();
  }
}

// Display snapshot
function displaySnapshot(snapshot: AasSnapshot): void {
  currentSnapshot = snapshot;
  hideLoading();

  if (snapshot.errors?.length && !snapshot.parseOk) {
    showError(snapshot.errors.join('; '));
    elements.mainContent.classList.add('hidden');
    return;
  }

  // Show warnings but continue
  if (snapshot.errors?.length) {
    console.warn('AAS parsing warnings:', snapshot.errors);
  }

  // Update asset card using textContent (safe)
  elements.assetName.textContent = snapshot.asset.displayName || 'Unknown Asset';
  elements.assetManufacturer.textContent = snapshot.asset.manufacturer || '-';
  elements.assetSerial.textContent = snapshot.asset.serialNumber || '-';
  elements.assetId.textContent = snapshot.asset.assetId || '-';

  // Render documents
  renderDocuments(snapshot.docs);

  // Render contacts
  renderContacts(snapshot.contacts);

  // Render enhanced features
  renderLifecycleBadge(snapshot.lifecyclePhase);
  renderSubmodels(snapshot.submodels);
  renderPcfCard(snapshot.pcf);
  renderSpareParts(snapshot.spareParts);

  // Apply role filtering
  applyRoleFiltering();

  // Show main content
  elements.mainContent.classList.remove('hidden');
  hideError();
}

// Render documents using safe DOM methods
function renderDocuments(docs: AasDocument[]): void {
  // Clear existing content
  while (elements.documentsList.firstChild) {
    elements.documentsList.removeChild(elements.documentsList.firstChild);
  }
  elements.docsCount.textContent = String(docs.length);

  if (docs.length === 0) {
    elements.noDocs.classList.remove('hidden');
    return;
  }

  elements.noDocs.classList.add('hidden');

  for (const doc of docs) {
    const li = document.createElement('li');
    li.className = 'doc-item';
    li.dataset.kind = doc.kind;

    // Create doc info div
    const docInfo = document.createElement('div');
    docInfo.className = 'doc-info';

    const docTitle = document.createElement('span');
    docTitle.className = 'doc-title';
    docTitle.textContent = doc.title;

    const kindBadge = document.createElement('span');
    kindBadge.className = `kind-badge kind-${doc.kind}`;
    kindBadge.textContent = doc.kind;

    docInfo.appendChild(docTitle);
    docInfo.appendChild(kindBadge);

    // Create open button
    const openBtn = document.createElement('button');
    openBtn.className = 'small-btn doc-open-btn';
    openBtn.title = 'Open document';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => openDocument(doc));

    li.appendChild(docInfo);
    li.appendChild(openBtn);
    elements.documentsList.appendChild(li);
  }
}

// Render contacts using safe DOM methods
function renderContacts(contacts: AasContact[]): void {
  // Clear existing content
  while (elements.contactsList.firstChild) {
    elements.contactsList.removeChild(elements.contactsList.firstChild);
  }
  elements.contactsCount.textContent = String(contacts.length);

  if (contacts.length === 0) {
    elements.noContacts.classList.remove('hidden');
    return;
  }

  elements.noContacts.classList.add('hidden');

  for (const contact of contacts) {
    const li = document.createElement('li');
    li.className = 'contact-item';

    // Create contact info div
    const contactInfo = document.createElement('div');
    contactInfo.className = 'contact-info';

    const contactLabel = document.createElement('span');
    contactLabel.className = 'contact-label';
    contactLabel.textContent = contact.label;

    const contactValue = document.createElement('span');
    contactValue.className = 'contact-value';
    contactValue.textContent = contact.value;

    contactInfo.appendChild(contactLabel);
    contactInfo.appendChild(contactValue);

    // Create action button
    const actionBtn = createContactActionButton(contact);

    li.appendChild(contactInfo);
    li.appendChild(actionBtn);
    elements.contactsList.appendChild(li);
  }
}

function createContactActionButton(contact: AasContact): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'small-btn contact-action-btn';

  switch (contact.type) {
    case 'phone':
      btn.title = 'Call';
      btn.textContent = '📞 Call';
      break;
    case 'email':
      btn.title = 'Email';
      btn.textContent = '✉️ Email';
      break;
    case 'url':
      btn.title = 'Visit';
      btn.textContent = '🔗 Visit';
      break;
    default:
      btn.title = 'Copy';
      btn.textContent = '📋 Copy';
  }

  btn.addEventListener('click', () => handleContactAction(contact));
  return btn;
}

function handleContactAction(contact: AasContact): void {
  switch (contact.type) {
    case 'phone':
      window.open(`tel:${contact.value}`, '_blank');
      break;
    case 'email':
      window.open(`mailto:${contact.value}`, '_blank');
      break;
    case 'url':
      window.open(contact.value.startsWith('http') ? contact.value : `https://${contact.value}`, '_blank');
      break;
    default:
      copyToClipboard(contact.value);
      showToast('Copied to clipboard');
  }
}

// Open document
function openDocument(doc: AasDocument): void {
  if (doc.blob) {
    // Create blob URL for embedded files
    const url = URL.createObjectURL(doc.blob);
    window.open(url, '_blank');
  } else if (doc.url.startsWith('http') || doc.url.startsWith('//')) {
    window.open(doc.url, '_blank');
  } else {
    // Relative URL - try to resolve against source
    if (currentSnapshot?.source.url) {
      const base = new URL(currentSnapshot.source.url);
      const resolved = new URL(doc.url, base);
      window.open(resolved.href, '_blank');
    } else {
      showError('Cannot resolve document URL');
    }
  }
}

// Filter documents by search
function filterDocuments(): void {
  const query = elements.docsSearch.value.toLowerCase();
  const items = elements.documentsList.querySelectorAll('.doc-item');

  items.forEach((item) => {
    const title = item.querySelector('.doc-title')?.textContent?.toLowerCase() || '';
    const kind = (item as HTMLElement).dataset.kind?.toLowerCase() || '';

    if (title.includes(query) || kind.includes(query)) {
      (item as HTMLElement).style.display = '';
    } else {
      (item as HTMLElement).style.display = 'none';
    }
  });
}

// Apply role-based filtering (enhanced version is at the end of the file)

function isDocKindVisible(kind: DocKind, visibility: RoleVisibility): boolean {
  switch (kind) {
    case 'safety':
      return visibility.safetyDocs;
    case 'manual':
      return visibility.manuals;
    case 'certificate':
      return visibility.certificates;
    case 'datasheet':
      return true; // Always show datasheets
    default:
      return true;
  }
}

// Copy functions
async function handleCopyId(): Promise<void> {
  if (!currentSnapshot?.asset.assetId) {
    showError('No asset ID to copy');
    return;
  }
  await copyToClipboard(currentSnapshot.asset.assetId);
  showToast('Asset ID copied');
}

async function handleCopyLink(): Promise<void> {
  if (!currentSnapshot?.source.url) {
    showError('No source URL to copy');
    return;
  }
  await copyToClipboard(currentSnapshot.source.url);
  showToast('Link copied');
}

async function handleCopyTicket(): Promise<void> {
  if (!currentSnapshot) {
    showError('No asset data');
    return;
  }

  const ticket = generateSupportTicketText(currentSnapshot);
  await copyToClipboard(ticket);
  showToast('Support ticket text copied');
}

function generateSupportTicketText(snapshot: AasSnapshot): string {
  const { asset, source } = snapshot;
  const lines = [
    '=== Asset Information ===',
    `Name: ${asset.displayName || 'N/A'}`,
    `Manufacturer: ${asset.manufacturer || 'N/A'}`,
    `Serial Number: ${asset.serialNumber || 'N/A'}`,
    `Asset ID: ${asset.assetId || 'N/A'}`,
  ];

  if (asset.yearOfConstruction) {
    lines.push(`Year of Construction: ${asset.yearOfConstruction}`);
  }

  if (source.url) {
    lines.push(`Source URL: ${source.url}`);
  }

  lines.push('', '=== Issue Description ===', '[Please describe the issue here]');

  return lines.join('\n');
}

// Pin/Favorites
async function handlePin(): Promise<void> {
  if (!currentSnapshot) {
    showError('No asset to pin');
    return;
  }

  await addFavorite(currentSnapshot);
  await refreshFavorites();
  showToast('Asset pinned to favorites');
}

// refreshFavorites and createFavoriteItem are now defined as enhanced versions at the end of the file

// QR Code
async function handleShowQr(): Promise<void> {
  if (!currentSnapshot?.asset.assetId) {
    showError('No asset ID for QR code');
    return;
  }

  elements.qrContainer.textContent = 'Generating...';
  elements.qrModal.classList.remove('hidden');

  try {
    // Dynamic import of qrcode library
    const QRCode = await import('qrcode');
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, currentSnapshot.asset.assetId, {
      width: 200,
      margin: 2,
    });
    // Clear and append canvas
    while (elements.qrContainer.firstChild) {
      elements.qrContainer.removeChild(elements.qrContainer.firstChild);
    }
    elements.qrContainer.appendChild(canvas);
  } catch {
    elements.qrContainer.textContent = 'Failed to generate QR code';
  }
}

function closeQrModal(): void {
  elements.qrModal.classList.add('hidden');
}

function handleQrDownload(): void {
  const canvas = elements.qrContainer.querySelector('canvas');
  if (!canvas) return;

  const link = document.createElement('a');
  link.download = `qr-${currentSnapshot?.asset.serialNumber || 'asset'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Utilities
function showLoading(message: string): void {
  elements.statusText.textContent = message;
  elements.statusArea.classList.remove('hidden');
  elements.mainContent.classList.add('hidden');
}

function hideLoading(): void {
  elements.statusArea.classList.add('hidden');
}

function showError(message: string): void {
  elements.errorText.textContent = message;
  elements.errorArea.classList.remove('hidden');
  hideLoading();
}

function hideError(): void {
  elements.errorArea.classList.add('hidden');
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 1000;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function showHelp(): void {
  window.open('https://github.com/hadijannat/aas-quickcard#readme', '_blank');
}

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function sendMessage(message: ExtensionMessage): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

// ====== Enhanced Feature Functions ======

// Lifecycle Badge
function renderLifecycleBadge(phase?: LifecyclePhase): void {
  if (!elements.lifecycleBadge) return;

  if (!phase || phase === 'unknown') {
    elements.lifecycleBadge.classList.add('hidden');
    return;
  }

  elements.lifecycleBadge.textContent = phase;
  elements.lifecycleBadge.className = `lifecycle-badge lifecycle-${phase}`;

  // Add tooltip with additional info
  let tooltip = `Phase: ${phase}`;
  if (currentSnapshot?.asset.commissioningDate) {
    tooltip += `\nCommissioned: ${currentSnapshot.asset.commissioningDate}`;
  }
  if (currentSnapshot?.asset.lastServiceDate) {
    tooltip += `\nLast Service: ${currentSnapshot.asset.lastServiceDate}`;
  }
  elements.lifecycleBadge.title = tooltip;
}

// Submodel Explorer
function renderSubmodels(submodels?: SubmodelInfo[]): void {
  if (!elements.submodelsSection || !elements.submodelsList) return;

  // Clear existing
  while (elements.submodelsList.firstChild) {
    elements.submodelsList.removeChild(elements.submodelsList.firstChild);
  }

  if (!submodels || submodels.length === 0) {
    elements.submodelsSection.classList.add('hidden');
    return;
  }

  elements.submodelsSection.classList.remove('hidden');
  elements.submodelsCount.textContent = String(submodels.length);

  for (const sm of submodels) {
    const li = createSubmodelItem(sm);
    elements.submodelsList.appendChild(li);
  }
}

function createSubmodelItem(sm: SubmodelInfo): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'submodel-item';

  // Header
  const header = document.createElement('div');
  header.className = 'submodel-header';

  const name = document.createElement('span');
  name.className = 'submodel-name';
  name.textContent = sm.idShort;

  const count = document.createElement('span');
  count.className = 'submodel-count';
  count.textContent = `${sm.elementCount} elements`;

  header.appendChild(name);
  header.appendChild(count);
  li.appendChild(header);

  // Template badge
  if (sm.templateName) {
    const badge = document.createElement('span');
    badge.className = 'submodel-template';
    badge.textContent = sm.templateName;
    li.appendChild(badge);
  }

  // Elements (expandable)
  if (sm.elements && sm.elements.length > 0) {
    const elementsDiv = document.createElement('div');
    elementsDiv.className = 'submodel-elements';

    for (const el of sm.elements.slice(0, 10)) {  // Show first 10
      const elItem = document.createElement('div');
      elItem.className = 'element-item';

      const elName = document.createElement('span');
      elName.className = 'element-name';
      elName.textContent = el.idShort;

      const elValue = document.createElement('span');
      elValue.className = 'element-value';
      elValue.textContent = el.value !== undefined ? String(el.value) : '-';

      elItem.appendChild(elName);
      elItem.appendChild(elValue);
      elementsDiv.appendChild(elItem);
    }

    if (sm.elements.length > 10) {
      const more = document.createElement('div');
      more.className = 'element-item';
      more.textContent = `... and ${sm.elements.length - 10} more`;
      elementsDiv.appendChild(more);
    }

    li.appendChild(elementsDiv);

    // Click to expand
    li.addEventListener('click', () => {
      li.classList.toggle('expanded');
    });
  }

  return li;
}

function toggleSubmodelsSection(): void {
  const section = elements.submodelsSection;
  if (section) {
    section.classList.toggle('collapsed');
  }
}

// PCF Card
function renderPcfCard(pcf?: { co2Equivalent?: number; unit?: string; scope?: string; calculationMethod?: string; validFrom?: string; validTo?: string }): void {
  if (!elements.pcfSection) return;

  if (!pcf || pcf.co2Equivalent === undefined) {
    elements.pcfSection.classList.add('hidden');
    return;
  }

  elements.pcfSection.classList.remove('hidden');

  // Format and display value
  const formatted = formatPcfValue(pcf);
  const parts = formatted.split(' ');
  elements.pcfValue.textContent = parts[0];
  elements.pcfUnit.textContent = parts.slice(1).join(' ');

  // Badges
  if (pcf.scope) {
    elements.pcfScope.textContent = pcf.scope;
    elements.pcfScope.classList.remove('hidden');
  } else {
    elements.pcfScope.classList.add('hidden');
  }

  if (pcf.calculationMethod) {
    elements.pcfMethod.textContent = pcf.calculationMethod;
    elements.pcfMethod.classList.remove('hidden');
  } else {
    elements.pcfMethod.classList.add('hidden');
  }

  if (pcf.validFrom || pcf.validTo) {
    const validity = pcf.validFrom && pcf.validTo
      ? `${pcf.validFrom} - ${pcf.validTo}`
      : pcf.validFrom || pcf.validTo || '';
    elements.pcfValidity.textContent = validity;
    elements.pcfValidity.classList.remove('hidden');
  } else {
    elements.pcfValidity.classList.add('hidden');
  }
}

// Spare Parts
function renderSpareParts(spareParts?: SparePart[]): void {
  if (!elements.sparepartsSection || !elements.sparePartsList) return;

  // Clear existing
  while (elements.sparePartsList.firstChild) {
    elements.sparePartsList.removeChild(elements.sparePartsList.firstChild);
  }

  if (!spareParts || spareParts.length === 0) {
    elements.sparepartsSection.classList.add('hidden');
    return;
  }

  elements.sparepartsSection.classList.remove('hidden');
  elements.sparepartsCount.textContent = String(spareParts.length);
  elements.noSpareParts.classList.add('hidden');

  for (const part of spareParts) {
    const li = createSparePartItem(part);
    elements.sparePartsList.appendChild(li);
  }
}

function createSparePartItem(part: SparePart): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'sparepart-item';
  li.dataset.category = part.category;

  const info = document.createElement('div');
  info.className = 'sparepart-info';

  const number = document.createElement('span');
  number.className = 'sparepart-number';
  number.textContent = part.partNumber;

  info.appendChild(number);

  if (part.description) {
    const desc = document.createElement('span');
    desc.className = 'sparepart-desc';
    desc.textContent = part.description;
    info.appendChild(desc);
  }

  li.appendChild(info);

  const category = document.createElement('span');
  category.className = `sparepart-category category-${part.category}`;
  category.textContent = part.category;
  li.appendChild(category);

  // Copy on click
  li.addEventListener('click', () => {
    copyToClipboard(part.partNumber);
    showToast(`Copied: ${part.partNumber}`);
  });

  return li;
}

function handleSparePartsFilter(e: Event): void {
  const btn = e.target as HTMLButtonElement;
  const category = btn.dataset.category;

  // Update active state
  elements.sparepartsSection.querySelectorAll('.filter-btn').forEach((b) => {
    b.classList.remove('active');
  });
  btn.classList.add('active');

  // Filter items
  const items = elements.sparePartsList.querySelectorAll('.sparepart-item');
  items.forEach((item) => {
    const el = item as HTMLElement;
    if (category === 'all' || el.dataset.category === category) {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
}

async function handleCopyPartsList(): Promise<void> {
  if (!currentSnapshot?.spareParts) return;
  const text = formatSparePartsList(currentSnapshot.spareParts);
  await copyToClipboard(text);
  showToast('Parts list copied');
}

// Compliance Modal
function openComplianceModal(): void {
  if (!currentSnapshot || !elements.complianceModal) return;
  elements.complianceModal.classList.remove('hidden');
  renderComplianceChecklist();
}

function closeComplianceModal(): void {
  elements.complianceModal?.classList.add('hidden');
}

function handleComplianceProfileChange(): void {
  currentComplianceProfile = elements.complianceProfileSelect.value as ComplianceProfileType;
  renderComplianceChecklist();
}

function renderComplianceChecklist(): void {
  if (!currentSnapshot) return;

  const result = runComplianceCheck(currentSnapshot, currentComplianceProfile);
  const score = calculateComplianceScore(result);
  const status = getComplianceStatusLabel(result);

  // Clear and rebuild summary using safe DOM methods
  while (elements.complianceSummary.firstChild) {
    elements.complianceSummary.removeChild(elements.complianceSummary.firstChild);
  }

  // Overall score
  const scoreDiv1 = document.createElement('div');
  scoreDiv1.className = 'compliance-score';
  const scoreValue1 = document.createElement('span');
  scoreValue1.className = `score-value ${status}`;
  scoreValue1.textContent = `${score}%`;
  const scoreLabel1 = document.createElement('span');
  scoreLabel1.className = 'score-label';
  scoreLabel1.textContent = 'Overall Score';
  scoreDiv1.appendChild(scoreValue1);
  scoreDiv1.appendChild(scoreLabel1);
  elements.complianceSummary.appendChild(scoreDiv1);

  // Mandatory score
  const scoreDiv2 = document.createElement('div');
  scoreDiv2.className = 'compliance-score';
  const scoreValue2 = document.createElement('span');
  scoreValue2.className = `score-value ${result.mandatoryPassed === result.mandatoryTotal ? 'compliant' : 'non-compliant'}`;
  scoreValue2.textContent = `${result.mandatoryPassed}/${result.mandatoryTotal}`;
  const scoreLabel2 = document.createElement('span');
  scoreLabel2.className = 'score-label';
  scoreLabel2.textContent = 'Mandatory';
  scoreDiv2.appendChild(scoreValue2);
  scoreDiv2.appendChild(scoreLabel2);
  elements.complianceSummary.appendChild(scoreDiv2);

  // Optional score
  const scoreDiv3 = document.createElement('div');
  scoreDiv3.className = 'compliance-score';
  const scoreValue3 = document.createElement('span');
  scoreValue3.className = 'score-value';
  scoreValue3.textContent = `${result.passedCount - result.mandatoryPassed}/${result.totalCount - result.mandatoryTotal}`;
  const scoreLabel3 = document.createElement('span');
  scoreLabel3.className = 'score-label';
  scoreLabel3.textContent = 'Optional';
  scoreDiv3.appendChild(scoreValue3);
  scoreDiv3.appendChild(scoreLabel3);
  elements.complianceSummary.appendChild(scoreDiv3);

  // Clear and rebuild checklist using safe DOM methods
  while (elements.complianceChecklist.firstChild) {
    elements.complianceChecklist.removeChild(elements.complianceChecklist.firstChild);
  }

  for (const check of result.checks) {
    const checkItem = document.createElement('div');
    checkItem.className = 'check-item';

    const statusSpan = document.createElement('span');
    statusSpan.className = 'check-status';
    statusSpan.textContent = check.present ? '✅' : '❌';
    checkItem.appendChild(statusSpan);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'check-content';

    const reqDiv = document.createElement('div');
    reqDiv.className = check.mandatory ? 'check-requirement mandatory' : 'check-requirement';
    reqDiv.textContent = check.requirement;
    contentDiv.appendChild(reqDiv);

    if (check.description) {
      const descDiv = document.createElement('div');
      descDiv.className = 'check-description';
      descDiv.textContent = check.description;
      contentDiv.appendChild(descDiv);
    }

    if (check.present && check.source) {
      const sourceDiv = document.createElement('div');
      sourceDiv.className = 'check-source';
      sourceDiv.textContent = `Source: ${check.source}`;
      contentDiv.appendChild(sourceDiv);
    }

    checkItem.appendChild(contentDiv);
    elements.complianceChecklist.appendChild(checkItem);
  }
}

async function handleComplianceExport(): Promise<void> {
  if (!currentSnapshot) return;

  const profiles: ComplianceProfileType[] = ['ce-marking', 'reach', 'rohs', 'dpp'];
  const results = profiles.map((p) => runComplianceCheck(currentSnapshot!, p));
  const markdown = generateComplianceReport(currentSnapshot, results);

  await copyToClipboard(markdown);
  showToast('Compliance report copied');
}

// Enhanced Favorites
async function refreshFavoritesEnhanced(): Promise<void> {
  const favorites = await searchFavorites(
    {
      query: elements.favoritesSearch?.value,
      tags: activeTagFilters.size > 0 ? [...activeTagFilters] : undefined,
      categories: elements.favoritesCategory?.value ? [elements.favoritesCategory.value] : undefined,
    },
    'date-desc'
  );

  // Update storage indicator
  await updateStorageIndicator();

  // Update category dropdown
  await updateCategoryDropdown();

  // Update tags display
  await updateTagsDisplay();

  // Clear existing content
  while (elements.favoritesList.firstChild) {
    elements.favoritesList.removeChild(elements.favoritesList.firstChild);
  }

  if (favorites.length === 0) {
    elements.noFavorites.classList.remove('hidden');
    elements.favoritesSection.classList.add('hidden');
    return;
  }

  elements.noFavorites.classList.add('hidden');
  elements.favoritesSection.classList.remove('hidden');

  for (const fav of favorites) {
    const li = createEnhancedFavoriteItem(fav);
    elements.favoritesList.appendChild(li);
  }

  // Update compare toolbar visibility
  updateCompareToolbar();
}

function createEnhancedFavoriteItem(fav: FavoriteAsset): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'favorite-item has-checkbox';
  li.dataset.id = fav.id;

  // Checkbox for comparison
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'favorite-checkbox';
  checkbox.checked = selectedFavorites.has(fav.id);
  checkbox.addEventListener('change', () => toggleFavoriteSelection(fav.id));
  li.appendChild(checkbox);

  // Info div
  const docInfo = document.createElement('div');
  docInfo.className = 'doc-info';

  const favName = document.createElement('span');
  favName.className = 'favorite-name';
  favName.textContent = fav.nickname || fav.snapshot.asset.displayName || 'Unnamed';

  const favDate = document.createElement('span');
  favDate.className = 'favorite-date';
  favDate.textContent = new Date(fav.pinnedAt).toLocaleDateString();

  docInfo.appendChild(favName);
  docInfo.appendChild(favDate);

  // Tags display
  if (fav.tags && fav.tags.length > 0) {
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'favorite-tags';
    for (const tag of fav.tags.slice(0, 3)) {  // Show first 3
      const tagSpan = document.createElement('span');
      tagSpan.className = 'favorite-tag';
      tagSpan.textContent = tag;
      tagsDiv.appendChild(tagSpan);
    }
    if (fav.tags.length > 3) {
      const more = document.createElement('span');
      more.className = 'favorite-tag';
      more.textContent = `+${fav.tags.length - 3}`;
      tagsDiv.appendChild(more);
    }
    docInfo.appendChild(tagsDiv);
  }

  li.appendChild(docInfo);

  // Actions
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'favorite-actions';

  // Tag button
  const tagBtn = document.createElement('button');
  tagBtn.className = 'small-btn';
  tagBtn.title = 'Edit Tags';
  tagBtn.textContent = '🏷️';
  tagBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openTagModal(fav.id);
  });
  actionsDiv.appendChild(tagBtn);

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'small-btn fav-remove-btn';
  removeBtn.title = 'Remove';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await removeFavorite(fav.id);
    selectedFavorites.delete(fav.id);
    await refreshFavoritesEnhanced();
  });
  actionsDiv.appendChild(removeBtn);

  li.appendChild(actionsDiv);

  // Click to display
  li.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('fav-remove-btn') &&
        !target.classList.contains('favorite-checkbox') &&
        target.tagName !== 'BUTTON') {
      displaySnapshot(fav.snapshot);
    }
  });

  return li;
}

function toggleFavoriteSelection(id: string): void {
  if (selectedFavorites.has(id)) {
    selectedFavorites.delete(id);
  } else {
    if (selectedFavorites.size < 3) {
      selectedFavorites.add(id);
    } else {
      showToast('Maximum 3 assets for comparison');
      // Uncheck the checkbox
      const checkbox = document.querySelector(`[data-id="${id}"] .favorite-checkbox`) as HTMLInputElement;
      if (checkbox) checkbox.checked = false;
    }
  }
  updateCompareToolbar();
}

function updateCompareToolbar(): void {
  if (!elements.compareToolbar) return;

  if (selectedFavorites.size > 0) {
    elements.compareToolbar.classList.remove('hidden');
    elements.compareCount.textContent = `${selectedFavorites.size} selected`;
    elements.btnCompare.disabled = selectedFavorites.size < 2;
  } else {
    elements.compareToolbar.classList.add('hidden');
  }
}

function clearFavoriteSelection(): void {
  selectedFavorites.clear();
  document.querySelectorAll('.favorite-checkbox').forEach((cb) => {
    (cb as HTMLInputElement).checked = false;
  });
  updateCompareToolbar();
}

async function updateStorageIndicator(): Promise<void> {
  if (!elements.storageFill || !elements.storageText) return;

  const usage = await getStorageUsage();
  elements.storageFill.style.width = `${usage.percentage}%`;
  elements.storageText.textContent = `${formatBytes(usage.used)}`;

  // Color based on usage
  elements.storageFill.classList.remove('warning', 'critical');
  if (usage.percentage > 80) {
    elements.storageFill.classList.add('critical');
  } else if (usage.percentage > 60) {
    elements.storageFill.classList.add('warning');
  }
}

async function updateCategoryDropdown(): Promise<void> {
  if (!elements.favoritesCategory) return;

  const categories = await getAllCategories();
  const currentValue = elements.favoritesCategory.value;

  // Clear and rebuild
  while (elements.favoritesCategory.firstChild) {
    elements.favoritesCategory.removeChild(elements.favoritesCategory.firstChild);
  }

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'All Categories';
  elements.favoritesCategory.appendChild(defaultOption);

  for (const cat of categories) {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    elements.favoritesCategory.appendChild(option);
  }

  // Restore selection
  elements.favoritesCategory.value = currentValue;
}

async function updateTagsDisplay(): Promise<void> {
  if (!elements.favoritesTags) return;

  const tags = await getAllTags();

  // Clear existing
  while (elements.favoritesTags.firstChild) {
    elements.favoritesTags.removeChild(elements.favoritesTags.firstChild);
  }

  for (const tag of tags) {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    if (activeTagFilters.has(tag)) {
      pill.classList.add('active');
    }
    pill.textContent = tag;
    pill.addEventListener('click', () => {
      if (activeTagFilters.has(tag)) {
        activeTagFilters.delete(tag);
      } else {
        activeTagFilters.add(tag);
      }
      refreshFavoritesEnhanced();
    });
    elements.favoritesTags.appendChild(pill);
  }
}

async function handleFavoritesSearch(): Promise<void> {
  await refreshFavoritesEnhanced();
}

// Comparison Modal
async function openComparisonModal(): Promise<void> {
  if (selectedFavorites.size < 2 || !elements.comparisonModal) return;

  const allFavorites = await loadFavorites();
  const selected = allFavorites.filter((f) => selectedFavorites.has(f.id));

  const rows = compareAssets(selected);
  const tableHtml = generateComparisonTable(selected, rows);

  // Use safe DOM insertion - the comparison table HTML is generated from our own code
  // and escapes user content, so this is safe
  elements.comparisonTableContainer.innerHTML = tableHtml;
  elements.comparisonModal.classList.remove('hidden');
}

function closeComparisonModal(): void {
  elements.comparisonModal?.classList.add('hidden');
}

async function handleCopyComparison(): Promise<void> {
  const allFavorites = await loadFavorites();
  const selected = allFavorites.filter((f) => selectedFavorites.has(f.id));

  const rows = compareAssets(selected);
  const markdown = generateComparisonMarkdown(selected, rows);

  await copyToClipboard(markdown);
  showToast('Comparison table copied');
}

// Tag Modal
async function openTagModal(favoriteId: string): Promise<void> {
  if (!elements.tagModal) return;

  editingFavoriteId = favoriteId;
  const favorites = await loadFavorites();
  const fav = favorites.find((f) => f.id === favoriteId);

  if (!fav) return;

  // Show current tags
  renderCurrentTags(fav.tags || []);

  // Show suggested tags
  const allTags = await getAllTags();
  const currentTags = new Set(fav.tags || []);
  const suggestions = allTags.filter((t) => !currentTags.has(t));
  renderSuggestedTags(suggestions);

  elements.newTagInput.value = '';
  elements.tagModal.classList.remove('hidden');
}

function closeTagModal(): void {
  elements.tagModal?.classList.add('hidden');
  editingFavoriteId = null;
  refreshFavoritesEnhanced();
}

function renderCurrentTags(tags: string[]): void {
  if (!elements.currentTags) return;

  // Clear existing
  while (elements.currentTags.firstChild) {
    elements.currentTags.removeChild(elements.currentTags.firstChild);
  }

  for (const tag of tags) {
    const tagSpan = document.createElement('span');
    tagSpan.className = 'current-tag';
    tagSpan.textContent = tag;

    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-tag';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => handleRemoveTag(tag));

    tagSpan.appendChild(removeBtn);
    elements.currentTags.appendChild(tagSpan);
  }
}

function renderSuggestedTags(tags: string[]): void {
  if (!elements.suggestedTags) return;

  // Clear existing
  while (elements.suggestedTags.firstChild) {
    elements.suggestedTags.removeChild(elements.suggestedTags.firstChild);
  }

  for (const tag of tags.slice(0, 10)) {  // Show max 10 suggestions
    const tagSpan = document.createElement('span');
    tagSpan.className = 'suggested-tag';
    tagSpan.textContent = tag;
    tagSpan.addEventListener('click', () => handleAddSuggestedTag(tag));
    elements.suggestedTags.appendChild(tagSpan);
  }
}

async function handleAddTag(): Promise<void> {
  if (!editingFavoriteId) return;

  const tag = elements.newTagInput.value.trim().toLowerCase();
  if (!tag) return;

  await addTags(editingFavoriteId, [tag]);
  elements.newTagInput.value = '';

  // Refresh the modal
  await openTagModal(editingFavoriteId);
}

async function handleAddSuggestedTag(tag: string): Promise<void> {
  if (!editingFavoriteId) return;
  await addTags(editingFavoriteId, [tag]);
  await openTagModal(editingFavoriteId);
}

async function handleRemoveTag(tag: string): Promise<void> {
  if (!editingFavoriteId) return;
  await removeTags(editingFavoriteId, [tag]);
  await openTagModal(editingFavoriteId);
}

// Update applyRoleFiltering to include new sections
function applyRoleFilteringEnhanced(): void {
  const visibility = ROLE_VISIBILITY[currentRole];

  // Filter documents by kind
  const docItems = elements.documentsList.querySelectorAll('.doc-item');
  docItems.forEach((item) => {
    const kind = (item as HTMLElement).dataset.kind as DocKind;
    const visible = isDocKindVisible(kind, visibility);
    (item as HTMLElement).style.display = visible ? '' : 'none';
  });

  // Show/hide contacts section
  elements.contactsSection.style.display = visibility.serviceContacts ? '' : 'none';

  // Enhanced sections
  if (elements.pcfSection) {
    elements.pcfSection.style.display = visibility.pcfCard ? '' : 'none';
  }

  if (elements.sparepartsSection) {
    elements.sparepartsSection.style.display = visibility.spareParts ? '' : 'none';
  }

  if (elements.submodelsSection) {
    elements.submodelsSection.style.display = visibility.submodelExplorer ? '' : 'none';
  }

  if (elements.btnCompliance) {
    elements.btnCompliance.style.display = visibility.complianceChecklist ? '' : 'none';
  }
}

// Override the original refreshFavorites to use enhanced version
async function refreshFavorites(): Promise<void> {
  await refreshFavoritesEnhanced();
}

// Override applyRoleFiltering to use enhanced version
function applyRoleFiltering(): void {
  applyRoleFilteringEnhanced();
}

// Initialize on load
init();
