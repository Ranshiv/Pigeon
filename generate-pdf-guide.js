#!/usr/bin/env node

/**
 * Generate PDF from OpenAPI Linting Guide
 * Uses md-to-pdf for high-quality PDF generation
 */

const { mdToPdf } = require('md-to-pdf');
const fs = require('fs');
const path = require('path');

async function generatePDF() {
    try {
        console.log('📄 Generating PDF from OpenAPI Linting Guide...');

        const inputFile = path.join(__dirname, 'OPENAPI_LINTING_GUIDE.md');
        const outputFile = path.join(__dirname, 'OPENAPI_LINTING_GUIDE.pdf');

        // Check if markdown file exists
        if (!fs.existsSync(inputFile)) {
            throw new Error('Markdown file not found: ' + inputFile);
        }

        // PDF generation options
        const options = {
            pdf_options: {
                format: 'A4',
                margin: {
                    top: '20mm',
                    right: '20mm',
                    bottom: '20mm',
                    left: '20mm'
                },
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: `
          <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
            <span>Pigeon OpenAPI Linting Guide</span>
          </div>
        `,
                footerTemplate: `
          <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `
            },
            stylesheet: [
                'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css',
                'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github.min.css'
            ],
            css: `
        .markdown-body {
          box-sizing: border-box;
          min-width: 200px;
          max-width: 980px;
          margin: 0 auto;
          padding: 45px;
          font-size: 12px;
          line-height: 1.6;
        }
        
        /* Custom styling for better PDF output */
        h1 {
          color: #0366d6;
          border-bottom: 2px solid #0366d6;
          padding-bottom: 10px;
          page-break-before: always;
        }
        
        h1:first-child {
          page-break-before: auto;
        }
        
        h2 {
          color: #24292e;
          border-bottom: 1px solid #eaecef;
          padding-bottom: 8px;
        }
        
        code {
          background-color: #f6f8fa;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 11px;
        }
        
        pre {
          background-color: #f6f8fa;
          border-radius: 6px;
          padding: 16px;
          overflow-x: auto;
          font-size: 10px;
          line-height: 1.45;
        }
        
        table {
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 11px;
        }
        
        table th,
        table td {
          border: 1px solid #d0d7de;
          padding: 8px 12px;
          text-align: left;
        }
        
        table th {
          background-color: #f6f8fa;
          font-weight: 600;
        }
        
        .toc {
          background-color: #f8f9fa;
          border: 1px solid #e1e4e8;
          border-radius: 6px;
          padding: 20px;
          margin: 20px 0;
        }
        
        blockquote {
          border-left: 4px solid #dfe2e5;
          padding-left: 16px;
          color: #6a737d;
          margin: 16px 0;
        }
        
        /* Badge styling */
        img[alt*="badge"] {
          display: inline-block;
          margin: 2px;
        }
        
        /* Prevent breaking inside code blocks and tables */
        pre, table {
          page-break-inside: avoid;
        }
        
        /* Better list spacing */
        ul, ol {
          margin: 16px 0;
          padding-left: 32px;
        }
        
        li {
          margin: 4px 0;
        }
        
        /* Emoji support */
        .emoji {
          font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
        }
      `,
            body_class: 'markdown-body',
            highlight_style: 'github',
            document_title: 'Pigeon OpenAPI Linting Guide'
        };

        console.log('🔄 Converting markdown to PDF...');

        // Generate PDF
        const pdf = await mdToPdf({ path: inputFile }, options);

        if (pdf) {
            // Write PDF to file
            fs.writeFileSync(outputFile, pdf.content);

            console.log('✅ PDF generated successfully!');
            console.log(`📁 Output file: ${outputFile}`);
            console.log(`📊 File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);

            // Also create a copy with timestamp for versioning
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const versionedFile = path.join(__dirname, `OPENAPI_LINTING_GUIDE_${timestamp}.pdf`);
            fs.writeFileSync(versionedFile, pdf.content);
            console.log(`📋 Versioned copy: ${versionedFile}`);

        } else {
            throw new Error('PDF generation failed - no content returned');
        }

    } catch (error) {
        console.error('❌ Error generating PDF:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    generatePDF();
}

module.exports = { generatePDF };
