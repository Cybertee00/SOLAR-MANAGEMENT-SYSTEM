/**
 * Company Display Name Utilities
 * Generates display names for companies based on their names
 */

/**
 * Generate company abbreviation from company name
 * Examples:
 *   "Smart Innovations Energy" -> "SIE"
 *   "Acme Solar Solutions" -> "ASS"
 *   "Green Energy Corp" -> "GEC"
 * 
 * @param {string} companyName - Full company name
 * @returns {string} Company abbreviation (uppercase, max 5 chars)
 */
function getCompanyAbbreviation(companyName) {
  if (!companyName) return '';
  
  const words = companyName.trim().split(/\s+/);
  
  if (words.length === 1) {
    // Single word: take first 3 characters
    return companyName.substring(0, 3).toUpperCase();
  }
  
  // Multiple words: take first letter of each word, max 5 chars
  const abbreviation = words
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 5);
  
  return abbreviation;
}

/**
 * Generate company display name in format: "{ABBREVIATION} O&M System"
 * Examples:
 *   "Smart Innovations Energy" -> "SIE O&M System"
 *   "Acme Solar Solutions" -> "ASS O&M System"
 * 
 * @param {string} companyName - Full company name
 * @returns {string} Display name in format "{ABBREVIATION} O&M System"
 */
function getCompanyDisplayName(companyName) {
  if (!companyName) return 'O&M System';
  
  const abbreviation = getCompanyAbbreviation(companyName);
  return `${abbreviation} O&M System`;
}

module.exports = {
  getCompanyAbbreviation,
  getCompanyDisplayName
};
