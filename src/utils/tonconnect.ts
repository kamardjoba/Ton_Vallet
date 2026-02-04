/**
 * TON Connect utilities for DApp connections
 * Implements TON Connect protocol for wallet-to-DApp communication
 */

export interface TONConnectRequest {
  version: string;
  requestId: string;
  request: string; // URL-encoded JSON
}

export interface TONConnectManifest {
  url: string;
  name: string;
  iconUrl?: string;
  termsOfUseUrl?: string;
  privacyPolicyUrl?: string;
}

export interface TONConnectSession {
  requestId: string;
  manifest: TONConnectManifest;
  connectedAt: number;
  walletAddress: string;
  walletPublicKey: string;
}

/**
 * Parses TON Connect URL from QR code
 * Format: tc://?v=2&id=<request_id>&r=<encoded_request>
 * or: tonconnect://?v=2&id=<request_id>&r=<encoded_request>
 */
export function parseTONConnectURL(url: string): TONConnectRequest | null {
  try {
    // Clean up URL - remove newlines and extra whitespace
    const cleanedUrl = url.trim().replace(/\s+/g, '').replace(/\n/g, '');
    
    let queryString = '';
    let protocol = '';
    
    // Handle tc:// and tonconnect:// protocols (they don't have a host)
    if (cleanedUrl.startsWith('tc://')) {
      protocol = 'tc://';
      // Extract query string after tc://
      const match = cleanedUrl.match(/^tc:\/\/(.*)$/);
      if (match) {
        queryString = match[1].startsWith('?') ? match[1].substring(1) : match[1];
      }
    } else if (cleanedUrl.startsWith('tonconnect://')) {
      protocol = 'tonconnect://';
      const match = cleanedUrl.match(/^tonconnect:\/\/(.*)$/);
      if (match) {
        queryString = match[1].startsWith('?') ? match[1].substring(1) : match[1];
      }
    } else if (cleanedUrl.startsWith('https://') || cleanedUrl.startsWith('http://')) {
      // For HTTP/HTTPS URLs, use standard URL parsing
      try {
        const parsedUrl = new URL(cleanedUrl);
        const version = parsedUrl.searchParams.get('v') || parsedUrl.searchParams.get('version') || '2';
        const requestId = parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('requestId');
        let request = parsedUrl.searchParams.get('r') || parsedUrl.searchParams.get('request');

        if (!requestId || !request) {
          return null;
        }

        // Decode request parameter
        try {
          let decoded = request;
          for (let i = 0; i < 3; i++) {
            try {
              const testDecode = decodeURIComponent(decoded);
              if (testDecode !== decoded) {
                decoded = testDecode;
              } else {
                break;
              }
            } catch {
              break;
            }
          }
          request = decoded;
        } catch (decodeError) {
          console.warn('Error decoding request parameter, using as-is:', decodeError);
        }

        return {
          version,
          requestId,
          request,
        };
      } catch (urlError) {
        console.error('Error parsing HTTP URL:', urlError);
        return null;
      }
    } else {
      // Try to detect if it's a TON Connect URL without protocol
      if (cleanedUrl.includes('v=2') && cleanedUrl.includes('id=') && cleanedUrl.includes('r=')) {
        queryString = cleanedUrl.includes('?') ? cleanedUrl.split('?')[1] : cleanedUrl;
      } else {
        return null;
      }
    }

    // Parse query string manually for tc:// and tonconnect://
    if (!queryString) {
      return null;
    }

    const params = new URLSearchParams(queryString);
    const version = params.get('v') || params.get('version') || '2';
    const requestId = params.get('id') || params.get('requestId');
    let request = params.get('r') || params.get('request');

    if (!requestId || !request) {
      console.warn('Missing TON Connect parameters:', { requestId, hasRequest: !!request });
      return null;
    }

    // The request parameter might be URL-encoded multiple times
    // Try to decode it
    try {
      // Try decoding multiple times in case of double encoding
      let decoded = request;
      for (let i = 0; i < 3; i++) {
        try {
          const testDecode = decodeURIComponent(decoded);
          if (testDecode !== decoded) {
            decoded = testDecode;
          } else {
            break;
          }
        } catch {
          break;
        }
      }
      request = decoded;
    } catch (decodeError) {
      console.warn('Error decoding request parameter, using as-is:', decodeError);
    }

    console.log('Parsed TON Connect URL:', {
      protocol,
      version,
      requestId,
      requestLength: request.length,
      requestPreview: request.substring(0, 100) + '...',
    });

    return {
      version,
      requestId,
      request,
    };
  } catch (error) {
    console.error('Error parsing TON Connect URL:', error);
    console.error('Original URL:', url);
    return null;
  }
}

/**
 * Decodes TON Connect request
 * Request is a URL-encoded JSON string
 */
export function decodeTONConnectRequest(encodedRequest: string): any {
  try {
    console.log('Decoding TON Connect request, length:', encodedRequest.length);
    console.log('Request preview:', encodedRequest.substring(0, 200) + '...');
    
    // The request might already be decoded or might need decoding
    let decoded: string = encodedRequest;
    
    // Try to decode multiple times in case of multiple encoding
    for (let i = 0; i < 5; i++) {
      try {
        const testDecode = decodeURIComponent(decoded);
        // If decoding didn't change anything, we're done
        if (testDecode === decoded) {
          break;
        }
        decoded = testDecode;
        console.log(`Decoded iteration ${i + 1}, length:`, decoded.length);
      } catch (decodeError) {
        // If decoding fails, use current value
        console.log(`Decoding iteration ${i + 1} failed, using current value`);
        break;
      }
    }
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(decoded);
      console.log('Successfully parsed JSON request');
      return parsed;
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the string
      // Sometimes the request might be wrapped in quotes or have extra characters
      const jsonMatch = decoded.match(/\{.*\}/s);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('Successfully parsed JSON from extracted match');
          return parsed;
        } catch {
          // Continue to error
        }
      }
      
      console.error('Failed to parse as JSON:', parseError);
      console.error('Decoded string:', decoded.substring(0, 500));
      throw parseError;
    }
  } catch (error) {
    console.error('Error decoding TON Connect request:', error);
    console.error('Original encoded request length:', encodedRequest.length);
    return null;
  }
}

/**
 * Fetches DApp manifest from manifestUrl
 */
export async function fetchDAppManifest(manifestUrl: string): Promise<TONConnectManifest | null> {
  try {
    const response = await fetch(manifestUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status}`);
    }

    const manifest = await response.json();
    
    // Validate manifest structure
    if (!manifest.url || !manifest.name) {
      throw new Error('Invalid manifest structure');
    }

    return {
      url: manifest.url,
      name: manifest.name,
      iconUrl: manifest.iconUrl,
      termsOfUseUrl: manifest.termsOfUseUrl,
      privacyPolicyUrl: manifest.privacyPolicyUrl,
    };
  } catch (error) {
    console.error('Error fetching DApp manifest:', error);
    return null;
  }
}

/**
 * Creates TON Connect response with wallet information
 * According to TON Connect protocol v2 specification
 */
export function createTONConnectResponse(
  requestId: string,
  walletAddress: string,
  walletPublicKey: string
): string {
  const response = {
    version: '2',
    request_id: requestId,
    payload: {
      items: [
        {
          name: 'ton_addr',
          address: walletAddress,
          network: 'mainnet',
          publicKey: walletPublicKey,
          walletStateInit: '', // Can be added if needed
        },
      ],
    },
  };

  return JSON.stringify(response);
}

/**
 * Creates TON Connect response URL with encoded response
 * Format: <callbackUrl>?result=<encoded_response>
 */
export function createTONConnectResponseURL(
  callbackUrl: string,
  response: string
): string {
  // URL-encode the response
  const encodedResponse = encodeURIComponent(response);
  
  // Build URL with result parameter
  const separator = callbackUrl.includes('?') ? '&' : '?';
  return `${callbackUrl}${separator}result=${encodedResponse}`;
}

/**
 * Sends TON Connect response back to DApp
 * In Telegram Mini App, we can't use direct fetch due to CORS restrictions.
 * Instead, we use Telegram WebApp API to open the callback URL with response parameters.
 * 
 * According to TON Connect protocol:
 * - Response should be sent to the callback URL specified in the request
 * - Response format: GET request with `result` query parameter containing URL-encoded JSON response
 * - dApp will process the response and establish the connection
 */
export async function sendTONConnectResponse(
  responseUrl: string,
  response: string
): Promise<boolean> {
  try {
    console.log('Sending TON Connect response:', {
      url: responseUrl,
      responseLength: response.length,
      responsePreview: response.substring(0, 200) + '...',
    });

    // Create the callback URL with encoded response
    const callbackUrl = createTONConnectResponseURL(responseUrl, response);
    
    console.log('TON Connect callback URL:', {
      originalUrl: responseUrl,
      callbackUrl: callbackUrl.substring(0, 300) + '...',
      responseLength: response.length,
    });

    // In Telegram Mini App, we need to use openLink to send the response
    // because direct fetch is blocked by CORS
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      try {
        // Open the callback URL - this will navigate to dApp with the response
        // The dApp should handle the response from query parameters and establish connection
        window.Telegram.WebApp.openLink(callbackUrl, { try_instant_view: false });
        
        console.log('✅ Opened TON Connect callback URL via Telegram WebApp');
        // Return true - we've opened the link, dApp will process it
        // The dApp will receive the response and establish the connection
        return true;
      } catch (openError) {
        console.error('Failed to open link via Telegram WebApp:', openError);
        return false;
      }
    } else {
      // Fallback for non-Telegram environments (development/testing)
      console.warn('Telegram WebApp not available, trying fallback methods');
      
      try {
        // Try to create a hidden iframe to send the response
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.src = callbackUrl;
        document.body.appendChild(iframe);
        
        // Remove iframe after a delay
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 3000);
        
        console.log('✅ Sent TON Connect response via iframe (fallback)');
        return true;
      } catch (iframeError) {
        console.error('Iframe method failed:', iframeError);
        
        // Last resort: try window.open (will open in new tab/window)
        try {
          window.open(callbackUrl, '_blank');
          console.log('✅ Opened TON Connect callback URL in new window (last resort)');
          return true;
        } catch (windowError) {
          console.error('All methods failed:', windowError);
          return false;
        }
      }
    }
  } catch (error) {
    console.error('Error sending TON Connect response:', error);
    return false;
  }
}

/**
 * Stores TON Connect session in localStorage
 */
export function saveTONConnectSession(session: TONConnectSession): void {
  try {
    const sessions = getTONConnectSessions();
    sessions[session.requestId] = session;
    localStorage.setItem('tonconnect_sessions', JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving TON Connect session:', error);
  }
}

/**
 * Retrieves all TON Connect sessions from localStorage
 */
export function getTONConnectSessions(): { [requestId: string]: TONConnectSession } {
  try {
    const stored = localStorage.getItem('tonconnect_sessions');
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error retrieving TON Connect sessions:', error);
    return {};
  }
}

/**
 * Removes a TON Connect session
 */
export function removeTONConnectSession(requestId: string): void {
  try {
    const sessions = getTONConnectSessions();
    delete sessions[requestId];
    localStorage.setItem('tonconnect_sessions', JSON.stringify(sessions));
  } catch (error) {
    console.error('Error removing TON Connect session:', error);
  }
}

/**
 * Gets connected DApps list
 */
export function getConnectedDApps(): TONConnectSession[] {
  const sessions = getTONConnectSessions();
  return Object.values(sessions);
}
