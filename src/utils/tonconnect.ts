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
    // Handle tc:// and tonconnect:// protocols
    let parsedUrl: URL;
    if (url.startsWith('tc://')) {
      const httpsUrl = url.replace('tc://', 'https://');
      parsedUrl = new URL(httpsUrl);
    } else if (url.startsWith('tonconnect://')) {
      const httpsUrl = url.replace('tonconnect://', 'https://');
      parsedUrl = new URL(httpsUrl);
    } else if (url.startsWith('https://') || url.startsWith('http://')) {
      parsedUrl = new URL(url);
    } else {
      return null;
    }

    const version = parsedUrl.searchParams.get('v') || '2';
    const requestId = parsedUrl.searchParams.get('id');
    const request = parsedUrl.searchParams.get('r');

    if (!requestId || !request) {
      return null;
    }

    return {
      version,
      requestId,
      request: decodeURIComponent(request),
    };
  } catch (error) {
    console.error('Error parsing TON Connect URL:', error);
    return null;
  }
}

/**
 * Decodes TON Connect request
 * Request is a URL-encoded JSON string
 */
export function decodeTONConnectRequest(encodedRequest: string): any {
  try {
    // The request might already be decoded or might need decoding
    let decoded: string;
    try {
      decoded = decodeURIComponent(encodedRequest);
    } catch {
      // If decoding fails, try using as-is
      decoded = encodedRequest;
    }
    
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding TON Connect request:', error);
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
 * Sends TON Connect response back to DApp
 */
export async function sendTONConnectResponse(
  responseUrl: string,
  response: string
): Promise<boolean> {
  try {
    const responseData = {
      result: response,
    };

    const fetchResponse = await fetch(responseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(responseData),
    });

    return fetchResponse.ok;
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
