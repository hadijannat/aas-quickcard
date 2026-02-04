import type { UserSettings, FieldMapping, UserRole } from '../shared/types';
import { loadSettings, saveSettings, DEFAULT_FIELD_MAPPINGS, DEFAULT_SETTINGS } from '../shared/storage';

// DOM Elements
const elements = {
  defaultRole: document.getElementById('default-role') as HTMLSelectElement,
  mapDisplayName: document.getElementById('map-displayName') as HTMLInputElement,
  mapManufacturer: document.getElementById('map-manufacturer') as HTMLInputElement,
  mapSerialNumber: document.getElementById('map-serialNumber') as HTMLInputElement,
  mapProductDesignation: document.getElementById('map-productDesignation') as HTMLInputElement,
  mapAssetId: document.getElementById('map-assetId') as HTMLInputElement,
  btnReset: document.getElementById('btn-reset') as HTMLButtonElement,
  btnSave: document.getElementById('btn-save') as HTMLButtonElement,
  status: document.getElementById('status') as HTMLDivElement,
};

// Initialize
async function init(): Promise<void> {
  // Load current settings
  const settings = await loadSettings();
  populateForm(settings);

  // Set up event listeners
  elements.btnSave.addEventListener('click', handleSave);
  elements.btnReset.addEventListener('click', handleReset);
}

// Populate form with settings
function populateForm(settings: UserSettings): void {
  elements.defaultRole.value = settings.currentRole;

  const mappings = settings.fieldMappings;
  elements.mapDisplayName.value = mappings.displayName.join(', ');
  elements.mapManufacturer.value = mappings.manufacturer.join(', ');
  elements.mapSerialNumber.value = mappings.serialNumber.join(', ');
  elements.mapProductDesignation.value = mappings.productDesignation.join(', ');
  elements.mapAssetId.value = mappings.assetId.join(', ');
}

// Parse comma-separated input to array
function parseMapping(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Collect form data into settings object
function collectSettings(): UserSettings {
  const fieldMappings: FieldMapping = {
    displayName: parseMapping(elements.mapDisplayName.value),
    manufacturer: parseMapping(elements.mapManufacturer.value),
    serialNumber: parseMapping(elements.mapSerialNumber.value),
    productDesignation: parseMapping(elements.mapProductDesignation.value),
    assetId: parseMapping(elements.mapAssetId.value),
  };

  // Use defaults if empty
  if (fieldMappings.displayName.length === 0) {
    fieldMappings.displayName = DEFAULT_FIELD_MAPPINGS.displayName;
  }
  if (fieldMappings.manufacturer.length === 0) {
    fieldMappings.manufacturer = DEFAULT_FIELD_MAPPINGS.manufacturer;
  }
  if (fieldMappings.serialNumber.length === 0) {
    fieldMappings.serialNumber = DEFAULT_FIELD_MAPPINGS.serialNumber;
  }
  if (fieldMappings.productDesignation.length === 0) {
    fieldMappings.productDesignation = DEFAULT_FIELD_MAPPINGS.productDesignation;
  }
  if (fieldMappings.assetId.length === 0) {
    fieldMappings.assetId = DEFAULT_FIELD_MAPPINGS.assetId;
  }

  return {
    currentRole: elements.defaultRole.value as UserRole,
    fieldMappings,
  };
}

// Save settings
async function handleSave(): Promise<void> {
  try {
    const settings = collectSettings();
    await saveSettings(settings);
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showStatus(
      `Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    );
  }
}

// Reset to defaults
async function handleReset(): Promise<void> {
  populateForm(DEFAULT_SETTINGS);
  await saveSettings(DEFAULT_SETTINGS);
  showStatus('Settings reset to defaults.', 'success');
}

// Show status message
function showStatus(message: string, type: 'success' | 'error'): void {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.classList.remove('hidden');

  // Auto-hide after 3 seconds
  setTimeout(() => {
    elements.status.classList.add('hidden');
  }, 3000);
}

// Initialize on load
init();
