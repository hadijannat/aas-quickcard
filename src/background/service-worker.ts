import type { ExtensionMessage } from '../shared/types';

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
  const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB limit

  try {
    // FIRST: Check <pre> and <code> elements - most likely to have JSON
    // and avoids processing large page bodies unnecessarily
    const preElements = document.querySelectorAll('pre, code');
    for (const el of preElements) {
      const text = el.textContent?.trim();
      if (text && text.length > 10) {  // Skip tiny elements
        try {
          JSON.parse(text);
          return { rawJson: text };
        } catch {
          // Not valid JSON, continue
        }
      }
    }

    // Now try the full body
    const bodyText = document.body.innerText;

    // Check size limit before processing
    if (bodyText.length > MAX_BODY_SIZE) {
      return {
        error: `Page content too large (${(bodyText.length / 1024 / 1024).toFixed(1)}MB). Maximum supported size is 5MB.`
      };
    }

    // Try to find JSON in the page
    // Check if the entire body is JSON
    try {
      JSON.parse(bodyText);
      return { rawJson: bodyText };
    } catch {
      // Not pure JSON, try to find JSON blocks
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
