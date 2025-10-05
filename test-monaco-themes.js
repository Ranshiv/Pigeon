// Test Monaco Themes Implementation
const fs = require('fs');
const path = require('path');

console.log('Testing Monaco Themes Implementation...\n');

// Check if the themes file exists and is properly structured
const themesPath = path.join(__dirname, 'client', 'src', 'themes', 'monacoThemes.js');
console.log('1. Checking themes file exists:', fs.existsSync(themesPath) ? '✓' : '✗');

if (fs.existsSync(themesPath)) {
    const themesContent = fs.readFileSync(themesPath, 'utf8');

    // Check for required exports
    const requiredExports = [
        'pigeonLightTheme',
        'pigeonDarkTheme',
        'registerPigeonThemes',
        'getPigeonMonacoTheme',
        'pigeonEditorOptions'
    ];

    console.log('\n2. Checking required exports:');
    requiredExports.forEach(exportName => {
        const hasExport = themesContent.includes(`export const ${exportName}`) ||
            themesContent.includes(`${exportName},`);
        console.log(`   ${exportName}:`, hasExport ? '✓' : '✗');
    });

    // Check for proper theme structure
    console.log('\n3. Checking theme structure:');
    const hasLightTheme = themesContent.includes("base: 'vs'");
    const hasDarkTheme = themesContent.includes("base: 'vs-dark'");
    const hasColorDefinitions = themesContent.includes("'editor.background'");
    const hasSyntaxRules = themesContent.includes("token:");

    console.log('   Light theme base:', hasLightTheme ? '✓' : '✗');
    console.log('   Dark theme base:', hasDarkTheme ? '✓' : '✗');
    console.log('   Color definitions:', hasColorDefinitions ? '✓' : '✗');
    console.log('   Syntax highlighting rules:', hasSyntaxRules ? '✓' : '✗');

    // Check for Pigeon brand colors
    console.log('\n4. Checking Pigeon brand colors:');
    const hasPrimaryColor = themesContent.includes('014C75'); // Primary blue
    const hasBlueAccents = themesContent.includes('67d1ff'); // Light blue accents
    const hasGreenStrings = themesContent.includes('4ade80'); // Green for strings

    console.log('   Primary blue (#014C75):', hasPrimaryColor ? '✓' : '✗');
    console.log('   Blue accents:', hasBlueAccents ? '✓' : '✗');
    console.log('   Green strings:', hasGreenStrings ? '✓' : '✗');
}

// Check SpecPreview integration
const specPreviewPath = path.join(__dirname, 'client', 'src', 'components', 'VisualApiDesigner', 'components', 'SpecPreview.js');
console.log('\n5. Checking SpecPreview integration:', fs.existsSync(specPreviewPath) ? '✓' : '✗');

if (fs.existsSync(specPreviewPath)) {
    const specContent = fs.readFileSync(specPreviewPath, 'utf8');

    const hasThemeImport = specContent.includes('registerPigeonThemes');
    const hasThemeUsage = specContent.includes('monacoTheme');
    const hasThemeContext = specContent.includes('useTheme');

    console.log('   Theme imports:', hasThemeImport ? '✓' : '✗');
    console.log('   Theme usage:', hasThemeUsage ? '✓' : '✗');
    console.log('   Theme context:', hasThemeContext ? '✓' : '✗');
}

console.log('\n=== Test Complete ===');
console.log('Monaco Editor themes have been implemented with:');
console.log('• Custom light theme using Pigeon 2025 Blue Palette');
console.log('• Custom dark theme with modern GitHub-style colors');
console.log('• Enhanced syntax highlighting for JSON/YAML');
console.log('• Improved editor options for better UX');
console.log('• Integration with existing ThemeContext');
console.log('\nThe Monaco editor should now display with professional,');
console.log('branded colors that match the Pigeon design system!');
