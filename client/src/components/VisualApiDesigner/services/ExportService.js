/**
 * Export and Sharing Service
 * Provides comprehensive export functionality for visualizations
 */
export class ExportService {
    static exportFormats = {
        PNG: 'png',
        JPG: 'jpg',
        SVG: 'svg',
        PDF: 'pdf',
        HTML: 'html',
        JSON: 'json'
    };

    static exportTypes = {
        VISUALIZATION: 'visualization',
        CHART: 'chart',
        TABLE: 'table',
        REPORT: 'report'
    };

    /**
     * Export visualization to specified format
     */
    static async exportVisualization(element, format, options = {}) {
        try {
            const defaultOptions = {
                filename: `visualization-${Date.now()}`,
                quality: 1.0,
                backgroundColor: '#ffffff',
                scale: 2,
                includeMetadata: true,
                ...options
            };

            switch (format) {
                case this.exportFormats.PNG:
                    return await this.exportToPNG(element, defaultOptions);
                case this.exportFormats.JPG:
                    return await this.exportToJPG(element, defaultOptions);
                case this.exportFormats.SVG:
                    return await this.exportToSVG(element, defaultOptions);
                case this.exportFormats.PDF:
                    return await this.exportToPDF(element, defaultOptions);
                case this.exportFormats.HTML:
                    return await this.exportToHTML(element, defaultOptions);
                case this.exportFormats.JSON:
                    return await this.exportToJSON(element, defaultOptions);
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }

    /**
     * Export visualization to PNG format
     */
    static async exportToPNG(element, options) {
        if (!element) throw new Error('Element is required for PNG export');

        // Use html2canvas for PNG export
        const html2canvas = await this.loadHtml2Canvas();

        const canvas = await html2canvas(element, {
            backgroundColor: options.backgroundColor,
            scale: options.scale,
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                this.downloadBlob(blob, `${options.filename}.png`);
                resolve({
                    format: 'png',
                    blob: blob,
                    size: blob.size,
                    url: URL.createObjectURL(blob)
                });
            }, 'image/png', options.quality);
        });
    }

    /**
     * Export visualization to JPG format
     */
    static async exportToJPG(element, options) {
        if (!element) throw new Error('Element is required for JPG export');

        const html2canvas = await this.loadHtml2Canvas();

        const canvas = await html2canvas(element, {
            backgroundColor: options.backgroundColor,
            scale: options.scale,
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                this.downloadBlob(blob, `${options.filename}.jpg`);
                resolve({
                    format: 'jpg',
                    blob: blob,
                    size: blob.size,
                    url: URL.createObjectURL(blob)
                });
            }, 'image/jpeg', options.quality);
        });
    }

    /**
     * Export visualization to SVG format
     */
    static async exportToSVG(element, options) {
        if (!element) throw new Error('Element is required for SVG export');

        // Clone the element to avoid modifying the original
        const clonedElement = element.cloneNode(true);

        // Get element dimensions
        const rect = element.getBoundingClientRect();
        const width = rect.width * options.scale;
        const height = rect.height * options.scale;

        // Create SVG wrapper
        const svgContent = `
            <svg xmlns="http://www.w3.org/2000/svg" 
                 width="${width}" 
                 height="${height}" 
                 viewBox="0 0 ${width} ${height}">
                <foreignObject width="100%" height="100%">
                    <div xmlns="http://www.w3.org/1999/xhtml">
                        ${clonedElement.outerHTML}
                    </div>
                </foreignObject>
            </svg>
        `;

        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        this.downloadBlob(blob, `${options.filename}.svg`);

        return {
            format: 'svg',
            blob: blob,
            size: blob.size,
            url: URL.createObjectURL(blob),
            content: svgContent
        };
    }

    /**
     * Export visualization to PDF format
     */
    static async exportToPDF(element, options) {
        if (!element) throw new Error('Element is required for PDF export');

        // Load jsPDF library
        const jsPDF = await this.loadJsPDF();

        // Create PDF document
        const pdf = new jsPDF({
            orientation: options.orientation || 'portrait',
            unit: 'mm',
            format: options.format || 'a4'
        });

        // Convert element to canvas first
        const html2canvas = await this.loadHtml2Canvas();
        const canvas = await html2canvas(element, {
            backgroundColor: options.backgroundColor,
            scale: options.scale,
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        // Add canvas to PDF
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // Calculate dimensions to maintain aspect ratio
        const canvasAspectRatio = canvas.width / canvas.height;
        let imgWidth = pdfWidth - 20; // 10mm margin on each side
        let imgHeight = imgWidth / canvasAspectRatio;

        if (imgHeight > pdfHeight - 20) {
            imgHeight = pdfHeight - 20;
            imgWidth = imgHeight * canvasAspectRatio;
        }

        // Add title if provided
        if (options.title) {
            pdf.setFontSize(16);
            pdf.text(options.title, 10, 15);
        }

        // Add image
        pdf.addImage(imgData, 'PNG', 10, options.title ? 25 : 10, imgWidth, imgHeight);

        // Add metadata if requested
        if (options.includeMetadata) {
            pdf.setFontSize(8);
            pdf.text(`Generated on: ${new Date().toLocaleString()}`, 10, pdfHeight - 10);
            pdf.text(`Source: Pigeon API Designer`, 10, pdfHeight - 6);
        }

        // Save PDF
        const pdfBlob = pdf.output('blob');
        this.downloadBlob(pdfBlob, `${options.filename}.pdf`);

        return {
            format: 'pdf',
            blob: pdfBlob,
            size: pdfBlob.size,
            url: URL.createObjectURL(pdfBlob)
        };
    }

    /**
     * Export visualization to HTML format
     */
    static async exportToHTML(element, options) {
        if (!element) throw new Error('Element is required for HTML export');

        // Get all styles from the document
        const styles = this.extractStyles(element);

        // Create standalone HTML
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${options.title || 'Pigeon Visualization'}</title>
                <style>
                    ${styles}
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 20px;
                        background: ${options.backgroundColor};
                    }
                    .export-header {
                        border-bottom: 1px solid #e1e5e9;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .export-footer {
                        margin-top: 20px;
                        padding-top: 10px;
                        border-top: 1px solid #e1e5e9;
                        font-size: 12px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                ${options.includeMetadata ? `
                    <div class="export-header">
                        <h1>${options.title || 'Visualization Export'}</h1>
                        <p>Generated on: ${new Date().toLocaleString()}</p>
                    </div>
                ` : ''}
                
                <div class="visualization-content">
                    ${element.outerHTML}
                </div>
                
                ${options.includeMetadata ? `
                    <div class="export-footer">
                        <p>Exported from Pigeon API Designer</p>
                    </div>
                ` : ''}
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        this.downloadBlob(blob, `${options.filename}.html`);

        return {
            format: 'html',
            blob: blob,
            size: blob.size,
            url: URL.createObjectURL(blob),
            content: htmlContent
        };
    }

    /**
     * Export visualization to JSON format
     */
    static async exportToJSON(element, options) {
        // Extract data from element
        const data = {
            type: options.type || 'visualization',
            title: options.title || 'Pigeon Visualization',
            timestamp: new Date().toISOString(),
            metadata: {
                exportedBy: 'Pigeon API Designer',
                version: '1.0.0',
                format: 'json'
            },
            content: {
                html: element.outerHTML,
                text: element.textContent,
                data: options.data || null
            },
            styles: this.extractStyles(element),
            dimensions: {
                width: element.offsetWidth,
                height: element.offsetHeight
            }
        };

        if (options.includeMetadata) {
            data.metadata.browser = navigator.userAgent;
            data.metadata.url = window.location.href;
        }

        const jsonContent = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        this.downloadBlob(blob, `${options.filename}.json`);

        return {
            format: 'json',
            blob: blob,
            size: blob.size,
            url: URL.createObjectURL(blob),
            content: jsonContent,
            data: data
        };
    }

    /**
     * Extract styles from element and its children
     */
    static extractStyles(element) {
        const styles = [];
        const processedRules = new Set();

        // Get all stylesheets
        Array.from(document.styleSheets).forEach(stylesheet => {
            try {
                Array.from(stylesheet.cssRules || []).forEach(rule => {
                    if (rule.type === CSSRule.STYLE_RULE && !processedRules.has(rule.cssText)) {
                        // Check if rule applies to the element or its children
                        if (element.matches(rule.selectorText) ||
                            element.querySelector(rule.selectorText)) {
                            styles.push(rule.cssText);
                            processedRules.add(rule.cssText);
                        }
                    }
                });
            } catch (e) {
                // Cross-origin stylesheet, skip
            }
        });

        return styles.join('\n');
    }

    /**
     * Load html2canvas library
     */
    static async loadHtml2Canvas() {
        if (window.html2canvas) {
            return window.html2canvas;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => resolve(window.html2canvas);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Load jsPDF library
     */
    static async loadJsPDF() {
        if (window.jsPDF) {
            return window.jsPDF;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => resolve(window.jspdf.jsPDF);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Download blob as file
     */
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Share visualization via Web Share API
     */
    static async shareVisualization(element, options = {}) {
        if (!navigator.share) {
            throw new Error('Web Share API not supported');
        }

        // Convert to image for sharing
        const result = await this.exportToPNG(element, {
            ...options,
            filename: 'pigeon-visualization'
        });

        try {
            await navigator.share({
                title: options.title || 'Pigeon Visualization',
                text: options.description || 'Check out this visualization from Pigeon API Designer',
                files: [new File([result.blob], 'visualization.png', { type: 'image/png' })]
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Copy visualization to clipboard
     */
    static async copyToClipboard(element, format = 'png') {
        if (!navigator.clipboard) {
            throw new Error('Clipboard API not supported');
        }

        switch (format) {
            case 'png':
                const result = await this.exportToPNG(element, { filename: 'temp', scale: 1 });
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': result.blob })
                ]);
                break;

            case 'html':
                await navigator.clipboard.writeText(element.outerHTML);
                break;

            case 'text':
                await navigator.clipboard.writeText(element.textContent);
                break;

            default:
                throw new Error(`Unsupported clipboard format: ${format}`);
        }

        return { success: true, format };
    }

    /**
     * Batch export multiple visualizations
     */
    static async batchExport(elements, format, options = {}) {
        const results = [];

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const elementOptions = {
                ...options,
                filename: `${options.filename || 'visualization'}-${i + 1}`
            };

            try {
                const result = await this.exportVisualization(element, format, elementOptions);
                results.push({ success: true, index: i, result });
            } catch (error) {
                results.push({ success: false, index: i, error: error.message });
            }
        }

        return results;
    }

    /**
     * Create export configuration
     */
    static createExportConfig(options = {}) {
        return {
            format: options.format || this.exportFormats.PNG,
            filename: options.filename || `pigeon-viz-${Date.now()}`,
            quality: options.quality || 1.0,
            scale: options.scale || 2,
            backgroundColor: options.backgroundColor || '#ffffff',
            includeMetadata: options.includeMetadata !== false,
            title: options.title || 'Pigeon Visualization',
            description: options.description || '',
            orientation: options.orientation || 'portrait',
            pdfFormat: options.pdfFormat || 'a4'
        };
    }

    /**
     * Get export history
     */
    static getExportHistory() {
        const history = localStorage.getItem('pigeon-export-history');
        return history ? JSON.parse(history) : [];
    }

    /**
     * Save export to history
     */
    static saveToHistory(exportResult) {
        const history = this.getExportHistory();
        history.unshift({
            ...exportResult,
            timestamp: new Date().toISOString()
        });

        // Keep only last 50 exports
        if (history.length > 50) {
            history.splice(50);
        }

        localStorage.setItem('pigeon-export-history', JSON.stringify(history));
    }

    /**
     * Clear export history
     */
    static clearHistory() {
        localStorage.removeItem('pigeon-export-history');
    }

    /**
     * Export request data to various formats
     */
    static async exportRequest(requestData, format, options = {}) {
        try {
            const { method, url, headers = [], body } = requestData;

            switch (format) {
                case 'postman':
                    return this.exportToPostman(requestData, options);
                case 'curl':
                    return this.exportToCurl(requestData, options);
                case 'openapi':
                    return this.exportToOpenAPI(requestData, options);
                default:
                    throw new Error(`Unsupported request export format: ${format}`);
            }
        } catch (error) {
            console.error('Export request failed:', error);
            throw error;
        }
    }

    /**
     * Export request to Postman collection format
     */
    static exportToPostman(requestData, options = {}) {
        const { method, url, headers = [], body, name = 'API Request' } = requestData;

        const postmanCollection = {
            info: {
                name: options.collectionName || 'Pigeon API Collection',
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
            },
            item: [{
                name: name,
                request: {
                    method: method,
                    url: url,
                    header: headers.map(h => ({
                        key: h.key,
                        value: h.value,
                        enabled: h.enabled !== false
                    })),
                    body: body ? {
                        mode: 'raw',
                        raw: body
                    } : undefined
                }
            }]
        };

        const blob = new Blob([JSON.stringify(postmanCollection, null, 2)], { type: 'application/json' });
        this.downloadBlob(blob, `${options.filename || 'postman-collection'}.json`);
        return postmanCollection;
    }

    /**
     * Export request to cURL command
     */
    static async exportToCurl(requestData, options = {}) {
        try {
            const { method, url, headers = [], body } = requestData;

            let curlCommand = `curl -X ${method} "${url}"`;

            // Add headers
            headers.forEach(header => {
                if (header.enabled !== false && header.key && header.value) {
                    curlCommand += ` \\\n  -H "${header.key}: ${header.value}"`;
                }
            });

            // Add body
            if (body && body.trim()) {
                curlCommand += ` \\\n  -d '${body.replace(/'/g, `'"'"'`)}'`;
            }

            // Copy to clipboard with error handling
            const success = await this.copyTextToClipboard(curlCommand);

            if (success) {
                console.log('cURL command copied to clipboard:', curlCommand);
                this.showNotification('cURL command copied to clipboard!', 'success');
            } else {
                console.error('Failed to copy cURL command to clipboard');
                this.showNotification('Failed to copy to clipboard. Please try again.', 'error');
                // Fallback: show the command in a modal or text area
                this.showCurlCommandModal(curlCommand);
            }

            return curlCommand;
        } catch (error) {
            console.error('Failed to export cURL command:', error);
            this.showNotification('Failed to generate cURL command. Please try again.', 'error');
            throw error;
        }
    }

    /**
     * Export request to OpenAPI specification
     */
    static exportToOpenAPI(requestData, options = {}) {
        const { method, url, headers = [], body } = requestData;

        // Parse URL to extract path and parameters
        const urlObj = new URL(url);
        const path = urlObj.pathname;

        const openApiSpec = {
            openapi: '3.0.0',
            info: {
                title: options.title || 'API Documentation',
                version: options.version || '1.0.0'
            },
            servers: [{
                url: `${urlObj.protocol}//${urlObj.host}`
            }],
            paths: {
                [path]: {
                    [method.toLowerCase()]: {
                        summary: options.summary || `${method} ${path}`,
                        parameters: headers.filter(h => h.enabled !== false).map(h => ({
                            name: h.key,
                            in: 'header',
                            required: false,
                            schema: { type: 'string' }
                        })),
                        requestBody: body ? {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: { type: 'object' }
                                }
                            }
                        } : undefined,
                        responses: {
                            '200': {
                                description: 'Success',
                                content: {
                                    'application/json': {
                                        schema: { type: 'object' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        const blob = new Blob([JSON.stringify(openApiSpec, null, 2)], { type: 'application/json' });
        this.downloadBlob(blob, `${options.filename || 'openapi-spec'}.json`);
        return openApiSpec;
    }

    /**
     * Copy text to clipboard with fallback support
     */
    static async copyTextToClipboard(text) {
        try {
            // Modern approach with navigator.clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }

            // Fallback for older browsers
            return this.fallbackCopyTextToClipboard(text);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            // Try fallback method
            return this.fallbackCopyTextToClipboard(text);
        }
    }

    /**
     * Fallback method for copying text to clipboard
     */
    static fallbackCopyTextToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            return successful;
        } catch (error) {
            console.error('Fallback copy failed:', error);
            return false;
        }
    }

    /**
     * Show notification to user
     */
    static showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `export-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            color: #ffffff;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#f87171' : '#6b7280'};
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: all 0.3s ease;
            transform: translateX(100%);
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Show cURL command in a modal as fallback
     */
    static showCurlCommandModal(curlCommand) {
        const modal = document.createElement('div');
        modal.className = 'curl-command-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>cURL Command</h3>
                    <button class="modal-close" onclick="this.closest('.curl-command-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p>Copy the command below:</p>
                    <textarea class="curl-textarea" readonly>${curlCommand}</textarea>
                    <button class="copy-button" onclick="
                        this.previousElementSibling.select();
                        document.execCommand('copy');
                        this.textContent = 'Copied!';
                        setTimeout(() => this.textContent = 'Copy to Clipboard', 1000);
                    ">Copy to Clipboard</button>
                </div>
            </div>
        `;

        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;

        const modalOverlay = modal.querySelector('.modal-overlay');
        modalOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
        `;

        const modalContent = modal.querySelector('.modal-content');
        modalContent.style.cssText = `
            position: relative;
            background: #21252b;
            border-radius: 12px;
            border: 1px solid #3a3f47;
            width: 100%;
            max-width: 600px;
            max-height: 80vh;
            overflow: hidden;
        `;

        const modalHeader = modal.querySelector('.modal-header');
        modalHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #3a3f47;
            background: #2a2f36;
        `;

        const modalTitle = modal.querySelector('.modal-header h3');
        modalTitle.style.cssText = `
            margin: 0;
            color: #ffffff;
            font-size: 18px;
            font-weight: 600;
        `;

        const modalClose = modal.querySelector('.modal-close');
        modalClose.style.cssText = `
            background: none;
            border: none;
            font-size: 24px;
            color: #8b92a5;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
        `;

        const modalBody = modal.querySelector('.modal-body');
        modalBody.style.cssText = `
            padding: 24px;
            color: #e1e5e9;
        `;

        const textarea = modal.querySelector('.curl-textarea');
        textarea.style.cssText = `
            width: 100%;
            height: 150px;
            padding: 16px;
            border: 1px solid #3a3f47;
            border-radius: 8px;
            background: #1a1d23;
            color: #e1e5e9;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            line-height: 1.4;
            resize: vertical;
            margin: 16px 0;
        `;

        const copyButton = modal.querySelector('.copy-button');
        copyButton.style.cssText = `
            background: #014C75;
            color: #ffffff;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        `;

        document.body.appendChild(modal);

        // Focus on textarea for easy copying
        textarea.focus();
        textarea.select();
    }
}

export default ExportService;
