const fs = require('fs');
const cssPath = 'client/src/components/VariableEditor.css';
let css = fs.readFileSync(cssPath, 'utf8');

css = css.replace('.empty-state-action {\n    display: inline-flex;\n    align-items: center;\n    gap: 10px;', '.empty-state-action {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    gap: 8px;');

fs.writeFileSync(cssPath, css);
