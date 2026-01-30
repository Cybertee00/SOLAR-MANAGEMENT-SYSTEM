/**
 * Setup Company Logo
 * Copies SIE_logo.png to Smart Innovations Energy's logos folder
 */

const fs = require('fs');
const path = require('path');

const { ensureCompanyDirs, getCompanySubDir } = require('../utils/organizationStorage');

const SMART_INNOVATIONS_ENERGY_SLUG = 'smart-innovations-energy';

async function setupCompanyLogo() {
  try {
    console.log('🚀 Setting up company logo for Smart Innovations Energy...\n');

    // Ensure company directories exist (including logos folder)
    await ensureCompanyDirs(SMART_INNOVATIONS_ENERGY_SLUG);
    console.log(`✅ Created directories for: Smart Innovations Energy (${SMART_INNOVATIONS_ENERGY_SLUG})\n`);

    // Paths
    const sourceLogo = path.join(__dirname, '..', '..', 'client', 'src', 'assets', 'SIE_logo.png');
    const logosDir = getCompanySubDir(SMART_INNOVATIONS_ENERGY_SLUG, 'logos');
    const destLogo = path.join(logosDir, 'logo.png');

    // Check if source exists
    if (!fs.existsSync(sourceLogo)) {
      console.error(`❌ Source logo not found: ${sourceLogo}`);
      process.exit(1);
    }

    // Copy logo
    if (fs.existsSync(destLogo)) {
      console.log(`⚠️  Logo already exists, overwriting: ${destLogo}`);
    }

    fs.copyFileSync(sourceLogo, destLogo);
    console.log(`✅ Copied logo to: ${destLogo}`);
    console.log(`\n📁 Logo location: uploads/companies/${SMART_INNOVATIONS_ENERGY_SLUG}/logos/logo.png`);
    console.log(`\n✅ Company logo setup completed!`);

  } catch (error) {
    console.error('❌ Error setting up company logo:', error);
    process.exit(1);
  }
}

setupCompanyLogo();
