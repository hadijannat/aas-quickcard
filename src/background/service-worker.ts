import type { ExtensionMessage, AasSnapshot } from '../shared/types';

// Current snapshot state (in-memory for the session)
let currentSnapshot: AasSnapshot | null = null;

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Set up side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Handle messages from side panel and content scripts
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): Promise<void> {
  switch (message.type) {
    case 'EXTRACT_FROM_PAGE':
      await handleExtractFromPage(sendResponse);
      break;

    case 'EXTRACTION_RESULT':
      currentSnapshot = message.payload as AasSnapshot;
      sendResponse({ success: true });
      break;

    case 'GET_CURRENT_SNAPSHOT':
      sendResponse({ snapshot: currentSnapshot });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
}

async function handleExtractFromPage(sendResponse: (response: unknown) => void): Promise<void> {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      sendResponse({ error: 'No active tab found' });
      return;
    }

    // Inject and execute the extractor script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractAasFromPage,
    });

    const result = results[0]?.result;

    if (result?.error) {
      sendResponse({ error: result.error });
      return;
    }

    sendResponse({
      success: true,
      rawJson: result?.rawJson,
      url: tab.url,
    });
  } catch (error) {
    sendResponse({
      error: error instanceof Error ? error.message : 'Extraction failed'
    });
  }
}

// This function is injected into the page to extract AAS JSON
function extractAasFromPage(): { rawJson?: string; error?: string } {
  try {
    const bodyText = document.body.innerText;

    // Try to find JSON in the page
    // First, check if the entire body is JSON
    try {
      JSON.parse(bodyText);
      return { rawJson: bodyText };
    } catch {
      // Not pure JSON, try to find JSON blocks
    }

    // Look for JSON in <pre> or <code> tags
    const preElements = document.querySelectorAll('pre, code');
    for (const el of preElements) {
      const text = el.textContent?.trim();
      if (text) {
        try {
          JSON.parse(text);
          return { rawJson: text };
        } catch {
          // Not valid JSON, continue
        }
      }
    }

    // Try to find JSON-like content with regex
    const jsonPattern = /\{[\s\S]*"(?:assetAdministrationShells|submodels|assets|conceptDescriptions)"[\s\S]*\}/;
    const match = bodyText.match(jsonPattern);
    if (match) {
      try {
        JSON.parse(match[0]);
        return { rawJson: match[0] };
      } catch {
        // Not valid JSON
      }
    }

    return { error: 'No AAS JSON found on this page' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to extract from page'
    };
  }
}
