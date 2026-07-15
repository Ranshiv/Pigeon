const fs = require('fs');
let css = fs.readFileSync('client/src/components/performanceTesting/PerformanceTestsPage.css', 'utf8');

// Header and Page Background
css = css.replace('padding: 24px;', "padding: 32px 48px;\n    font-family: 'Inter', -apple-system, sans-serif;");
css = css.replace('align-items: flex-start;\n    justify-content: space-between;', 'justify-content: space-between;\n    align-items: center;');
css = css.replace('margin-bottom: 20px;\n    padding-bottom: 20px;\n    border-bottom: 1px solid var(--border-color);', 'margin-bottom: 40px;');
css = css.replace('align-items: center;\n    gap: 12px;\n    min-width: 0;', 'flex-direction: column;\n    gap: 4px;\n    align-items: flex-start;');
css = css.replace(/font-size: 1\.6rem;\n    font-weight: 700;/g, 'font-size: 2rem;\n    font-weight: 600;');
css = css.replace(/font-size: 0\.95rem;\n    line-height: 1\.4;/g, 'font-size: 0.9rem;\n    font-weight: 400;');

// Grid
css = css.replace('grid-template-columns: 340px 1fr;', 'grid-template-columns: 300px 1fr;');

// Remove Panels
css = css.replace(/background: var\(--surface-elevated, var\(--card-bg\)\);\n    border: 1px solid var\(--border-color\);\n    border-radius: 14px;\n    padding: 16px;\n    box-shadow: 0 1px 3px rgba\(0, 0, 0, 0\.18\);/g, 'background: transparent;\n    border: none;\n    padding: 0;');

// Panel Titles
css = css.replace(/font-weight: 600;\n    font-size: 1\.125rem;\n    margin-bottom: 16px;/g, 'font-weight: 600;\n    font-size: 0.85rem;\n    text-transform: uppercase;\n    letter-spacing: 0.05em;\n    margin-bottom: 20px;');

// List Items (Sidebar)
css = css.replace(/padding: 12px;\n    border-radius: 12px;\n    border: 1px solid var\(--border-color\);\n    background: var\(--surface-sunken, var\(--background-color\)\);/g, 'padding: 14px 16px;\n    border-radius: 8px;\n    border: 1px solid transparent;\n    background: transparent;');
css = css.replace(/transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;/g, 'transition: background 0.15s ease;');
css = css.replace(/transform: translateY\(-1px\);\n    border-color: var\(--primary-color\);\n    background: var\(--hover-bg\);/g, 'background: color-mix(in srgb, var(--text-color) 4%, transparent);');
css = css.replace(/border-color: var\(--primary-color\);\n    background: var\(--hover-bg\);/g, 'background: color-mix(in srgb, var(--text-color) 8%, transparent);');
css = css.replace(/font-weight: 700;/g, 'font-weight: 500;');

// Run Rows
css = css.replace(/padding: 12px 14px;\n    border-radius: 12px;\n    border: 1px solid var\(--border-color\);\n    background: var\(--surface-sunken, var\(--background-color\)\);/g, 'padding: 12px 16px;\n    border-radius: 8px;\n    border: 1px solid color-mix(in srgb, var(--border-color) 40%, transparent);\n    background: color-mix(in srgb, var(--card-bg) 40%, transparent);');
css = css.replace(/transition: border-color 0\.2s ease, background 0\.2s ease;/g, 'transition: border-color 0.2s ease, background 0.2s ease;');
css = css.replace(/transform: translateY\(-1px\);\n    background: var\(--hover-bg\);\n    border-color: var\(--primary-color\);\n    box-shadow: var\(--shadow-hover\);/g, 'background: color-mix(in srgb, var(--text-color) 4%, transparent);\n    border-color: color-mix(in srgb, var(--text-color) 12%, transparent);');
css = css.replace(/border-color: var\(--primary-color\);\n    background: var\(--hover-bg\);\n    box-shadow: var\(--shadow-hover\);\n    border-left: 4px solid var\(--primary-color\);/g, 'border-color: var(--primary-color);\n    background: color-mix(in srgb, var(--primary-color) 4%, transparent);');

// Run Details
css = css.replace(/margin-top: 20px;\n    border-top: 1px solid var\(--border-color\);\n    padding-top: 20px;/g, 'margin-top: 32px;');
css = css.replace(/margin: 0 0 16px 0;\n    font-size: 1\.125rem;\n    font-weight: 600;/g, 'margin: 0 0 24px 0;\n    font-size: 1.25rem;\n    font-weight: 500;');

// Compare and Export (Remove boxes)
css = css.replace(/background: var\(--surface-sunken, var\(--background-color\)\);\n    border: 1px solid var\(--border-color\);\n    border-radius: 12px;\n    padding: 14px;/g, 'background: transparent;\n    border: none;\n    padding: 0;');

// KPIs (Make them text-only, no boxes, just thin dividers)
css = css.replace(/grid-template-columns: repeat\(auto-fit, minmax\(150px, 1fr\)\);\n    gap: 16px;\n    margin: 16px 0;/g, 'grid-template-columns: repeat(3, 1fr);\n    gap: 24px;\n    margin: 24px 0 40px;');
css = css.replace(/background: var\(--surface-sunken, var\(--background-color\)\);\n    border: 1px solid var\(--border-color\);\n    border-radius: 12px;\n    padding: 14px;\n    transition: border-color 0\.2s ease, transform 0\.2s ease;/g, 'background: transparent;\n    border: none;\n    border-left: 1px solid color-mix(in srgb, var(--border-color) 60%, transparent);\n    padding-left: 16px;\n    border-radius: 0;');
css = css.replace(/border-color: color-mix\(in srgb, var\(--primary-color\) 45%, var\(--border-color\)\);\n    transform: translateY\(-2px\);/g, ''); // Remove hover
css = css.replace(/font-size: 0\.72rem;\n    text-transform: uppercase;\n    letter-spacing: 0\.05em;\n    font-weight: 600;/g, 'font-size: 0.8rem;\n    font-weight: 400;\n    margin-bottom: 8px;');
css = css.replace(/font-weight: 700;\n    font-size: 1\.5rem;/g, 'font-weight: 500;\n    font-size: 2rem;\n    letter-spacing: -0.03em;\n    margin-top: 0;');

// Chart
css = css.replace(/background: var\(--surface-sunken, var\(--background-color\)\);\n    border: 1px solid var\(--border-color\);\n    border-radius: 12px;\n    padding: 16px;/g, 'background: transparent;\n    border: 1px solid color-mix(in srgb, var(--border-color) 40%, transparent);\n    border-radius: 8px;\n    padding: 24px;');

// Buttons (Vercel style: thin, ghost by default, inverse primary)
css = css.replace(/padding: 10px 18px;\n    border-radius: 10px;\n    border: 1px solid var\(--border-color\);\n    background: var\(--surface-elevated, var\(--card-bg\)\);\n    color: var\(--text-color\);\n    font-size: 0\.875rem;\n    font-weight: 500;\n    cursor: pointer;\n    transition: background 0\.2s ease, border-color 0\.2s ease, transform 0\.15s ease, box-shadow 0\.2s ease;/g, 'padding: 8px 16px;\n    border-radius: 6px;\n    border: 1px solid color-mix(in srgb, var(--border-color) 40%, transparent);\n    background: transparent;\n    color: var(--text-color);\n    font-size: 0.85rem;\n    font-weight: 500;\n    cursor: pointer;\n    transition: background 0.15s ease, color 0.15s ease;');
css = css.replace(/transform: translateY\(-1px\);\n    background: var\(--hover-bg\);\n    border-color: var\(--primary-color\);\n    box-shadow: 0 2px 8px rgba\(0, 0, 0, 0\.08\);/g, 'background: color-mix(in srgb, var(--text-color) 6%, transparent);\n    color: var(--text-color);');
css = css.replace(/background: var\(--primary-color\);\n    border: none;\n    color: #fff;\n    font-weight: 600;/g, 'background: var(--text-color);\n    color: var(--background-color);\n    border: none;\n    font-weight: 500;');
css = css.replace(/background: var\(--primary-hover\);\n    box-shadow: 0 4px 12px rgba\(1, 76, 117, 0\.25\);/g, 'background: color-mix(in srgb, var(--text-color) 80%, transparent);\n    color: var(--background-color);');

// Subsections
css = css.replace(/margin-top: 24px;\n    padding-top: 20px;\n    border-top: 1px solid color-mix\(in srgb, var\(--border-color\) 60%, transparent\);/g, 'margin-top: 40px;');
css = css.replace(/font-size: 0\.95rem;\n    font-weight: 600;\n    margin-bottom: 12px;/g, 'font-size: 1rem;\n    font-weight: 600;\n    margin-bottom: 16px;\n    padding-bottom: 12px;\n    border-bottom: 1px solid color-mix(in srgb, var(--border-color) 40%, transparent);');

fs.writeFileSync('client/src/components/performanceTesting/PerformanceTestsPage.css', css);
