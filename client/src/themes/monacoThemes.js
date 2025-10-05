// Monaco Editor Themes - 2025 Blue Palette
// Custom themes that align with Pigeon's design system

export const pigeonLightTheme = {
    base: 'vs',
    inherit: true,
    rules: [
        // JSON/YAML Syntax Highlighting
        { token: 'string.key.json', foreground: '014C75', fontStyle: 'bold' },
        { token: 'string.value.json', foreground: '16a34a' },
        { token: 'number', foreground: 'dc2626' },
        { token: 'keyword', foreground: '014C75', fontStyle: 'bold' },
        { token: 'string', foreground: '16a34a' },
        { token: 'comment', foreground: '6c757d', fontStyle: 'italic' },
        { token: 'delimiter', foreground: '333333' },
        { token: 'delimiter.bracket', foreground: '014C75' },
        { token: 'delimiter.square', foreground: 'dc2626' },
        { token: 'delimiter.curly', foreground: '014C75' },

        // YAML specific
        { token: 'key', foreground: '014C75', fontStyle: 'bold' },
        { token: 'tag', foreground: '014C75' },

        // Operators and punctuation
        { token: 'operators', foreground: '333333' },
        { token: 'punctuation', foreground: '6c757d' },

        // Values
        { token: 'constant.language.boolean', foreground: 'dc2626' },
        { token: 'constant.language.null', foreground: '6c757d' },

        // Error highlighting
        { token: 'invalid', foreground: 'dc3545', fontStyle: 'bold' }
    ],
    colors: {
        // Editor background and foreground
        'editor.background': '#ffffff',
        'editor.foreground': '#333333',

        // Line numbers and margins
        'editorLineNumber.foreground': '#9ca3af',
        'editorLineNumber.activeForeground': '#014C75',
        'editorGutter.background': '#f8f9fa',

        // Cursor and selection
        'editor.selectionBackground': '#E5F3FF',
        'editor.inactiveSelectionBackground': '#f0f8ff',
        'editor.selectionHighlightBackground': '#E5F3FF80',
        'editorCursor.foreground': '#014C75',

        // Current line highlighting
        'editor.lineHighlightBackground': '#f8f9fa',
        'editor.lineHighlightBorder': '#e1e4e8',

        // Indentation guides
        'editorIndentGuide.background': '#e1e4e8',
        'editorIndentGuide.activeBackground': '#014C75',

        // Brackets
        'editorBracketMatch.background': '#E5F3FF',
        'editorBracketMatch.border': '#014C75',

        // Find/Replace
        'editor.findMatchBackground': '#fff3cd',
        'editor.findMatchHighlightBackground': '#fff3cd80',
        'editor.findRangeHighlightBackground': '#E5F3FF40',

        // Scrollbar
        'scrollbar.shadow': '#00000020',
        'scrollbarSlider.background': '#9ca3af40',
        'scrollbarSlider.hoverBackground': '#9ca3af60',
        'scrollbarSlider.activeBackground': '#014C7580',

        // Error and warning markers
        'editorError.foreground': '#dc3545',
        'editorWarning.foreground': '#ffc107',
        'editorInfo.foreground': '#014C75',

        // Minimap (when enabled)
        'minimap.background': '#f8f9fa',
        'minimap.selectionHighlight': '#E5F3FF',

        // Widget backgrounds (autocomplete, hover, etc.)
        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#e1e4e8',
        'editorWidget.foreground': '#333333',
        'editorWidget.resizeBorder': '#014C75',

        // Suggest widget
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#e1e4e8',
        'editorSuggestWidget.foreground': '#333333',
        'editorSuggestWidget.highlightForeground': '#014C75',
        'editorSuggestWidget.selectedBackground': '#E5F3FF',

        // Hover widget
        'editorHoverWidget.background': '#ffffff',
        'editorHoverWidget.border': '#e1e4e8',
        'editorHoverWidget.foreground': '#333333'
    }
};

export const pigeonDarkTheme = {
    base: 'vs-dark',
    inherit: true,
    rules: [
        // JSON/YAML Syntax Highlighting - Updated for blue theme
        { token: 'string.key.json', foreground: '5bc0de', fontStyle: 'bold' },
        { token: 'string.value.json', foreground: '5cb85c' },
        { token: 'number', foreground: 'd9534f' },
        { token: 'keyword', foreground: '5bc0de', fontStyle: 'bold' },
        { token: 'string', foreground: '5cb85c' },
        { token: 'comment', foreground: '9caab7', fontStyle: 'italic' },
        { token: 'delimiter', foreground: 'c8d3e0' },
        { token: 'delimiter.bracket', foreground: '5bc0de' },
        { token: 'delimiter.square', foreground: 'd9534f' },
        { token: 'delimiter.curly', foreground: '5bc0de' },

        // YAML specific
        { token: 'key', foreground: '5bc0de', fontStyle: 'bold' },
        { token: 'tag', foreground: '5bc0de' },

        // Operators and punctuation
        { token: 'operators', foreground: 'c8d3e0' },
        { token: 'punctuation', foreground: '9caab7' },

        // Values
        { token: 'constant.language.boolean', foreground: 'd9534f' },
        { token: 'constant.language.null', foreground: '9caab7' },

        // Error highlighting
        { token: 'invalid', foreground: 'f04747', fontStyle: 'bold' }
    ],
    colors: {
        // Editor background and foreground - Blue-tinted to match application
        'editor.background': '#001927',
        'editor.foreground': '#ffffff',

        // Line numbers and margins - Blue-tinted
        'editorLineNumber.foreground': '#7a92a8',
        'editorLineNumber.activeForeground': '#5bc0de',
        'editorGutter.background': '#001e30',

        // Cursor and selection - Blue theme colors
        'editor.selectionBackground': '#014C7540',
        'editor.inactiveSelectionBackground': '#014C7520',
        'editor.selectionHighlightBackground': '#014C7530',
        'editorCursor.foreground': '#5bc0de',

        // Current line highlighting - Subtle blue tint
        'editor.lineHighlightBackground': '#002a3f',
        'editor.lineHighlightBorder': '#2d4a5c',

        // Indentation guides - Blue-tinted
        'editorIndentGuide.background': '#2d4a5c',
        'editorIndentGuide.activeBackground': '#5bc0de',

        // Brackets - Blue theme
        'editorBracketMatch.background': '#014C7540',
        'editorBracketMatch.border': '#5bc0de',

        // Find/Replace - Updated colors
        'editor.findMatchBackground': '#f0ad4e',
        'editor.findMatchHighlightBackground': '#f0ad4e40',
        'editor.findRangeHighlightBackground': '#014C7520',

        // Scrollbar - Blue-tinted
        'scrollbar.shadow': '#00000040',
        'scrollbarSlider.background': '#7a92a840',
        'scrollbarSlider.hoverBackground': '#7a92a860',
        'scrollbarSlider.activeBackground': '#5bc0de80',

        // Error and warning markers
        'editorError.foreground': '#f04747',
        'editorWarning.foreground': '#f0ad4e',
        'editorInfo.foreground': '#5bc0de',

        // Minimap (when enabled) - Blue-tinted
        'minimap.background': '#1a3548',
        'minimap.selectionHighlight': '#014C7540',

        // Widget backgrounds (autocomplete, hover, etc.) - Blue-tinted
        'editorWidget.background': '#1a3548',
        'editorWidget.border': '#2d4a5c',
        'editorWidget.foreground': '#c8d3e0',
        'editorWidget.resizeBorder': '#5bc0de',

        // Suggest widget - Blue-tinted
        'editorSuggestWidget.background': '#1a3548',
        'editorSuggestWidget.border': '#2d4a5c',
        'editorSuggestWidget.foreground': '#c8d3e0',
        'editorSuggestWidget.highlightForeground': '#5bc0de',
        'editorSuggestWidget.selectedBackground': '#014C7540',

        // Hover widget - Blue-tinted
        'editorHoverWidget.background': '#1a3548',
        'editorHoverWidget.border': '#2d4a5c',
        'editorHoverWidget.foreground': '#c8d3e0'
    }
};

// Theme registration and utility functions
export const registerPigeonThemes = (monaco) => {
    if (!monaco) {
        console.warn('Monaco instance not available for theme registration');
        return;
    }

    try {
        // Define and register the light theme
        monaco.editor.defineTheme('pigeon-light', pigeonLightTheme);
        console.log('✓ Pigeon light theme registered successfully');

        // Define and register the dark theme
        monaco.editor.defineTheme('pigeon-dark', pigeonDarkTheme);
        console.log('✓ Pigeon dark theme registered successfully');

        console.log('✓ All Pigeon Monaco themes registered successfully');
    } catch (error) {
        console.error('✗ Error registering Pigeon Monaco themes:', error);
    }
};

// Helper function to get the appropriate theme name based on app theme
export const getPigeonMonacoTheme = (appTheme) => {
    const themeName = appTheme === 'dark' ? 'pigeon-dark' : 'pigeon-light';
    console.log(`Using Monaco theme: ${themeName} (app theme: ${appTheme})`);
    return themeName;
};

// Enhanced editor options that work well with Pigeon themes
export const pigeonEditorOptions = {
    // Enhanced readability options
    fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', monospace",
    fontSize: 13,
    lineHeight: 1.6,
    letterSpacing: 0.5,

    // Enhanced editing experience
    wordWrap: 'on',
    minimap: { enabled: false },
    lineNumbers: 'on',
    folding: true,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: true,

    // Enhanced visual elements
    renderLineHighlight: 'gutter',
    bracketPairColorization: { enabled: true },
    guides: {
        indentation: true,
        bracketPairs: true,
        bracketPairsHorizontal: true,
        highlightActiveIndentation: true
    },

    // Performance optimizations and ResizeObserver error prevention
    automaticLayout: true,
    scrollbar: {
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        vertical: 'auto',
        horizontal: 'auto'
    },
    // Disable features that can trigger excessive ResizeObserver calls
    occurrencesHighlight: false,
    renderControlCharacters: false,
    renderIndentGuides: true,
    renderWhitespace: 'selection'
};

// Export themes by name for easy access
export const THEMES = {
    LIGHT: 'pigeon-light',
    DARK: 'pigeon-dark'
};

const monacoThemes = {
    pigeonLightTheme,
    pigeonDarkTheme,
    registerPigeonThemes,
    getPigeonMonacoTheme,
    pigeonEditorOptions,
    THEMES
};

export default monacoThemes;