// cli/lintFormatter.js
const chalk = require('chalk');

/**
 * Format lint results for different output formats
 */

function formatLintOutput(lintResult, format) {
    switch (format) {
        case 'json':
            return JSON.stringify(lintResult, null, 2);
        case 'table':
            return formatAsTable(lintResult.findings);
        case 'stylish':
        default:
            return formatAsStylish(lintResult.findings);
    }
}

function formatAsStylish(findings) {
    if (findings.length === 0) {
        return chalk.green('✨ No issues found!');
    }

    let output = '';

    // Group findings by source if available
    const groupedFindings = groupBySource(findings);

    Object.entries(groupedFindings).forEach(([source, sourceFindings]) => {
        if (source !== 'unknown') {
            output += chalk.underline(`\n${source}\n`);
        }

        sourceFindings.forEach(finding => {
            const icon = getSeverityIcon(finding.severity);
            const color = getSeverityColor(finding.severity);
            const position = finding.range ?
                ` ${chalk.gray(`(${finding.range.start.line}:${finding.range.start.character})`)}` : '';

            output += `  ${icon} ${color(finding.message)}${position}\n`;

            if (finding.path && finding.path.length > 0) {
                output += `    ${chalk.gray(`Path: ${finding.path.join(' > ')}`)} \n`;
            }

            if (finding.id) {
                output += `    ${chalk.gray(`Rule: ${finding.id}`)}\n`;
            }

            if (finding.docsUrl) {
                output += `    ${chalk.gray(`Docs: ${finding.docsUrl}`)}\n`;
            }

            output += '\n';
        });
    });

    return output;
}

function formatAsTable(findings) {
    if (findings.length === 0) {
        return chalk.green('✨ No issues found!');
    }

    const headers = ['Severity', 'Rule', 'Message', 'Path', 'Line'];
    const rows = findings.map(finding => [
        getSeverityText(finding.severity),
        finding.id || 'unknown',
        finding.message || 'No message',
        finding.path ? finding.path.join(' > ') : '',
        finding.range ? finding.range.start.line.toString() : ''
    ]);

    return formatTable(headers, rows);
}

function formatTable(headers, rows) {
    // Calculate column widths
    const columnWidths = headers.map((header, index) => {
        const maxRowWidth = Math.max(...rows.map(row => (row[index] || '').length));
        return Math.max(header.length, maxRowWidth);
    });

    // Format header
    let output = '';
    const headerRow = headers.map((header, index) =>
        header.padEnd(columnWidths[index])
    ).join(' | ');

    output += chalk.bold(headerRow) + '\n';
    output += columnWidths.map(width => '-'.repeat(width)).join('-|-') + '\n';

    // Format rows
    rows.forEach(row => {
        const formattedRow = row.map((cell, index) =>
            (cell || '').padEnd(columnWidths[index])
        ).join(' | ');
        output += formattedRow + '\n';
    });

    return output;
}

function groupBySource(findings) {
    const grouped = {};

    findings.forEach(finding => {
        const source = finding.source || 'unknown';
        if (!grouped[source]) {
            grouped[source] = [];
        }
        grouped[source].push(finding);
    });

    return grouped;
}

function getSeverityIcon(severity) {
    // Handle both numeric (Spectral) and string severity values
    switch (severity) {
        case 0:
        case 'error': return '❌';
        case 1:
        case 'warn': return '⚠️';
        case 2:
        case 'info': return 'ℹ️';
        case 3:
        case 'hint': return '💡';
        default: return '•';
    }
}

function getSeverityColor(severity) {
    // Handle both numeric (Spectral) and string severity values
    switch (severity) {
        case 0:
        case 'error': return chalk.red;
        case 1:
        case 'warn': return chalk.yellow;
        case 2:
        case 'info': return chalk.blue;
        case 3:
        case 'hint': return chalk.gray;
        default: return chalk.white;
    }
}

function getSeverityText(severity) {
    // Handle both numeric (Spectral) and string severity values
    switch (severity) {
        case 0:
        case 'error': return chalk.red('ERROR');
        case 1:
        case 'warn': return chalk.yellow('WARN');
        case 2:
        case 'info': return chalk.blue('INFO');
        case 3:
        case 'hint': return chalk.gray('HINT');
        default: return chalk.white(String(severity).toUpperCase());
    }
}

module.exports = {
    formatLintOutput
};
