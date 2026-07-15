const fs = require('fs');
let css = fs.readFileSync('C:/Users/ransh/OneDrive/Desktop/Pigeon/client/src/components/Home.css', 'utf8');

css = css.replace('.dashboard-container .empty-state {\n    display: flex;', '.dashboard-container .empty-state {\n    display: flex;\n    width: 100%;\n    box-sizing: border-box;\n    justify-content: center;');

fs.writeFileSync('C:/Users/ransh/OneDrive/Desktop/Pigeon/client/src/components/Home.css', css);
console.log('Empty state width fixed.');
