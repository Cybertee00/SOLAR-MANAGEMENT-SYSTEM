/**
 * Company Colors Utility
 * Loads and applies organization branding colors to the UI
 */

import { getCurrentOrganizationBranding } from '../api/api';

// Default colors (fallback)
const DEFAULT_PRIMARY = '#1A73E8';
const DEFAULT_SECONDARY = '#7b809a';

/**
 * Apply company colors to CSS variables
 * @param {string} primaryColor - Primary color hex code
 * @param {string} secondaryColor - Secondary color hex code
 */
export function applyCompanyColors(primaryColor, secondaryColor) {
  const root = document.documentElement;
  
  if (primaryColor) {
    root.style.setProperty('--md-primary', primaryColor);
    root.style.setProperty('--md-primary-focus', primaryColor);
    root.style.setProperty('--md-info', primaryColor);
  } else {
    root.style.setProperty('--md-primary', DEFAULT_PRIMARY);
    root.style.setProperty('--md-primary-focus', DEFAULT_PRIMARY);
    root.style.setProperty('--md-info', DEFAULT_PRIMARY);
  }
  
  if (secondaryColor) {
    root.style.setProperty('--md-secondary', secondaryColor);
  } else {
    root.style.setProperty('--md-secondary', DEFAULT_SECONDARY);
  }
}

/**
 * Reset colors to defaults
 */
export function resetCompanyColors() {
  applyCompanyColors(DEFAULT_PRIMARY, DEFAULT_SECONDARY);
}

/**
 * Load and apply company colors from API
 * @returns {Promise<{primaryColor: string, secondaryColor: string}|null>}
 */
export async function loadAndApplyCompanyColors() {
  try {
    const response = await getCurrentOrganizationBranding();
    const branding = response.data;
    
    if (branding && (branding.primary_color || branding.secondary_color)) {
      const primaryColor = branding.primary_color || DEFAULT_PRIMARY;
      const secondaryColor = branding.secondary_color || DEFAULT_SECONDARY;
      
      applyCompanyColors(primaryColor, secondaryColor);
      
      return {
        primaryColor,
        secondaryColor
      };
    } else {
      // No branding found, use defaults
      resetCompanyColors();
      return null;
    }
  } catch (error) {
    console.error('Error loading company colors:', error);
    // On error, use defaults
    resetCompanyColors();
    return null;
  }
}
