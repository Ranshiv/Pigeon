// src/context/FontContext.js (Simplified)
import React, { createContext, useState, useEffect, useContext } from 'react';

const FontContext = createContext();

// Keep font size options
export const fontSizeOptions = {
    'Small': '14px',
    'Medium': '16px', // Default
    'Large': '18px',
};

export const FontProvider = ({ children }) => {
    // Keep only fontSize state
    const [fontSize, setFontSizeState] = useState(() => {
        return localStorage.getItem('fontSize') || fontSizeOptions['Medium']; // Default to Medium
    });

    useEffect(() => {
        // Apply only font size globally
        document.documentElement.style.setProperty('--app-font-size', fontSize);
        localStorage.setItem('fontSize', fontSize);
    }, [fontSize]);

    // Keep only setFontSize
    const setFontSize = (newFontSize) => {
        setFontSizeState(newFontSize);
        // Backend update call will be handled in SettingsPage
    };

    return (
        <FontContext.Provider value={{ fontSize, setFontSize }}> {/* Provide only fontSize */}
            {children}
        </FontContext.Provider>
    );
};

// Custom hook remains the same
export const useFont = () => useContext(FontContext);