const fs = require('fs');
let css = fs.readFileSync('C:/Users/ransh/OneDrive/Desktop/Pigeon/client/src/components/Home.css', 'utf8');

css = css.replace('.welcome-section .quick-action-btn.primary:hover { background: var(--accent-hover); border-color: transparent; }', '.welcome-section .quick-action-btn.primary:hover { background-color: var(--accent-hover) !important; border-color: transparent; }');

fs.writeFileSync('C:/Users/ransh/OneDrive/Desktop/Pigeon/client/src/components/Home.css', css);
console.log('Hover fixed.');
