/**
 * Automatically converts any standard Google Sheet HTML published link (/pubhtml) 
 * or sharing/edit link (/edit) to its published CSV equivalent (/pub?output=csv or /export?format=csv).
 * 
 * @param {string} url - The Google Sheet URL input
 * @returns {string} - The normalized CSV export/publish URL
 */
export function normalizeGoogleSheetCsvUrl(url) {
  if (!url || typeof url !== 'string') return url;
  
  let trimmed = url.trim();
  
  // 1. If it's a published HTML URL, e.g., /pubhtml or /pub?output=html
  if (trimmed.includes('/pubhtml')) {
    return trimmed.replace('/pubhtml', '/pub?output=csv');
  }
  
  if (trimmed.includes('/pub?') && (trimmed.includes('output=html') || !trimmed.includes('output=csv'))) {
    if (trimmed.includes('output=html')) {
      return trimmed.replace('output=html', 'output=csv');
    }
    return trimmed + (trimmed.endsWith('&') ? '' : '&') + 'output=csv';
  }
  
  // 2. If it's a standard edit/sharing URL, e.g., /edit#gid=1234 or /edit?usp=sharing
  if (trimmed.includes('/edit')) {
    // Extract gid if present
    const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : null;
    
    // Replace everything from /edit onwards with /export?format=csv
    const baseUrl = trimmed.split('/edit')[0];
    if (gid) {
      return `${baseUrl}/export?format=csv&gid=${gid}`;
    }
    return `${baseUrl}/export?format=csv`;
  }
  
  return trimmed;
}
