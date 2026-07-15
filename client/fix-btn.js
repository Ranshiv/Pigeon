const fs = require('fs');
const cssFile = 'client/src/components/VariableEditor.css';
let css = fs.readFileSync(cssFile, 'utf8');

const regex = /\.empty-state-action \{[\s\S]*?\.empty-state-action:hover svg \{[\s\S]*?\}/;

const newCss = `.empty-state-action {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--var-text-primary);
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    width: 200px;
    margin: 16px auto 0;
    position: relative;
}

.empty-state-action svg {
    position: absolute;
    left: 16px;
    opacity: 0.7;
}

.empty-state-action:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
}`;

css = css.replace(regex, newCss);
fs.writeFileSync(cssFile, css);
