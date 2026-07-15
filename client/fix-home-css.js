const fs = require('fs');
let css = fs.readFileSync('C:/Users/ransh/OneDrive/Desktop/Pigeon/client/src/components/Home.css', 'utf8');

// Scope all generic classes to .dashboard-container to prevent global CSS collisions
css = css.replace(/\.dashboard-section/g, '.dashboard-container .dashboard-section');
css = css.replace(/\.section-header/g, '.dashboard-container .section-header');
css = css.replace(/\.view-all-btn/g, '.dashboard-container .view-all-btn');
css = css.replace(/\.stats-grid/g, '.dashboard-container .stats-grid');
css = css.replace(/\.stat-card/g, '.dashboard-container .stat-card');
css = css.replace(/\.stat-icon/g, '.dashboard-container .stat-icon');
css = css.replace(/\.stat-info/g, '.dashboard-container .stat-info');
css = css.replace(/\.stat-value/g, '.dashboard-container .stat-value');
css = css.replace(/\.stat-label/g, '.dashboard-container .stat-label');
css = css.replace(/\.activity-list/g, '.dashboard-container .activity-list');
css = css.replace(/\.activity-item/g, '.dashboard-container .activity-item');
css = css.replace(/\.activity-icon/g, '.dashboard-container .activity-icon');
css = css.replace(/\.activity-content/g, '.dashboard-container .activity-content');
css = css.replace(/\.activity-header/g, '.dashboard-container .activity-header');
css = css.replace(/\.activity-message/g, '.dashboard-container .activity-message');
css = css.replace(/\.workspaces-list/g, '.dashboard-container .workspaces-list');
css = css.replace(/\.workspace-card/g, '.dashboard-container .workspace-card');
css = css.replace(/\.workspace-icon/g, '.dashboard-container .workspace-icon');
css = css.replace(/\.workspace-info/g, '.dashboard-container .workspace-info');
css = css.replace(/\.view-arrow/g, '.dashboard-container .view-arrow');
css = css.replace(/\.collections-grid/g, '.dashboard-container .collections-grid');
css = css.replace(/\.collection-card/g, '.dashboard-container .collection-card');
css = css.replace(/\.collection-meta/g, '.dashboard-container .collection-meta');
css = css.replace(/\.quick-links/g, '.dashboard-container .quick-links');
css = css.replace(/\.quick-link/g, '.dashboard-container .quick-link');
css = css.replace(/\.quick-link-icon/g, '.dashboard-container .quick-link-icon');
css = css.replace(/\.quick-link-content/g, '.dashboard-container .quick-link-content');
css = css.replace(/\.loading/g, '.dashboard-container .loading');
css = css.replace(/\.empty-state/g, '.dashboard-container .empty-state');
css = css.replace(/\.empty-state-btn/g, '.dashboard-container .empty-state-btn');

// Also explicitly set flex-direction column on dashboard-section to fix workspaces squish
css = css.replace('.dashboard-container .dashboard-section {\n    background: var(--surface);', '.dashboard-container .dashboard-section {\n    display: flex;\n    flex-direction: column;\n    background: var(--surface);');

// Make sure buttons don't inherit weird global backgrounds
css = css.replace('.welcome-section .quick-action-btn {\n    display: inline-flex;', '.welcome-section .quick-action-btn {\n    display: inline-flex;\n    background-color: var(--glass-bg) !important;\n    color: var(--text-color) !important;');
css = css.replace('.welcome-section .quick-action-btn.primary {\n    background: var(--accent);', '.welcome-section .quick-action-btn.primary {\n    background-color: var(--accent) !important;\n    color: #ffffff !important;');

// Fix double scopes if any
css = css.replace(/\.dashboard-container \.dashboard-container/g, '.dashboard-container');

fs.writeFileSync('C:/Users/ransh/OneDrive/Desktop/Pigeon/client/src/components/Home.css', css);
console.log('CSS scoped and patched.');
