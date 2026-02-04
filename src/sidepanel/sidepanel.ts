import type { AasSnapshot, UserRole, ExtensionMessage, RoleVisibility, DocKind, AasDocument, AasContact } from '../shared/types';
import { ROLE_VISIBILITY } from '../shared/types';
import { loadSettings, setCurrentRole, loadFavorites, addFavorite, removeFavorite, type FavoriteAsset } from '../shared/storage';
import { createSnapshotFromPaste, createSnapshotFromPage } from '../parser/normalize';
import { parseFile } from '../parser/aasx-parser';

// State
let currentSnapshot: AasSnapshot | null = null;
let currentRole: UserRole = 'maintenance';

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

  // Click outside modal to close
  elements.pasteModal.addEventListener('click', (e) => {
    if (e.target === elements.pasteModal) closePasteModal();
  });
  elements.qrModal.addEventListener('click', (e) => {
    if (e.target === elements.qrModal) closeQrModal();
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

// Apply role-based filtering
function applyRoleFiltering(): void {
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
}

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

async function refreshFavorites(): Promise<void> {
  const favorites = await loadFavorites();

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
    const li = createFavoriteItem(fav);
    elements.favoritesList.appendChild(li);
  }
}

function createFavoriteItem(fav: FavoriteAsset): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'favorite-item';

  // Create info div
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

  // Create remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'small-btn fav-remove-btn';
  removeBtn.title = 'Remove';
  removeBtn.textContent = '×';

  li.appendChild(docInfo);
  li.appendChild(removeBtn);

  // Event listeners
  li.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).classList.contains('fav-remove-btn')) {
      displaySnapshot(fav.snapshot);
    }
  });

  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await removeFavorite(fav.id);
    await refreshFavorites();
  });

  return li;
}

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

// Initialize on load
init();
