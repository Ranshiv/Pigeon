// src/context/LocalIconThemeContext.js (Revised for PNGs)
import React, { createContext, useState, useEffect, useContext } from 'react';

// --- Import standard icon library for default/fallbacks ---
import * as FiIcons from 'react-icons/fi'; // Feather Icons (Default)
// You could add other libraries like Material here too

// --- Import your PNG images ---
import buffaloIcon from '../assets/icons/buffalo.png';
import clownFishIcon from '../assets/icons/clown-fish.png';
import hippoIcon from '../assets/icons/hippo.png';
import lionIcon from '../assets/icons/lion.png';
import mouseIcon from '../assets/icons/mouse.png';
import pigIcon from '../assets/icons/pig.png';
import sheepIcon from '../assets/icons/sheep.png';
// Add imports for any other animal icons you have

const LocalIconThemeContext = createContext();

// --- Define the icons needed across the app ---
// Map standard keys to icons for each theme
const iconThemes = {
    feather: { // Default theme using react-icons components
        Settings: FiIcons.FiSettings,
        User: FiIcons.FiUser,
        Logout: FiIcons.FiLogOut,
        Send: FiIcons.FiSend,
        Edit: FiIcons.FiEdit,
        Delete: FiIcons.FiTrash2,
        Add: FiIcons.FiPlus,
        Explore: FiIcons.FiCompass,
        Spotlight: FiIcons.FiStar,
        Trending: FiIcons.FiTrendingUp,
        AI: FiIcons.FiCpu,
        Check: FiIcons.FiCheckCircle,
        Rocket: FiIcons.FiRocket,
        Search: FiIcons.FiSearch,
        Save: FiIcons.FiSave,
        // Add other core UI icons as needed
        // Use placeholder/default feather icons for animal concepts if no animal equivalent
        Buffalo: FiIcons.FiBox, // Placeholder
        ClownFish: FiIcons.FiDroplet, // Placeholder
        Hippo: FiIcons.FiBox, // Placeholder
        Lion: FiIcons.FiBox, // Placeholder
        Mouse: FiIcons.FiBox, // Placeholder
        Pig: FiIcons.FiBox, // Placeholder
        Sheep: FiIcons.FiBox, // Placeholder
    },
    animal: { // Theme using PNG image URLs
        // Use animal icons where appropriate
        Buffalo: buffaloIcon,
        ClownFish: clownFishIcon,
        Hippo: hippoIcon,
        Lion: lionIcon,
        Mouse: mouseIcon,
        Pig: pigIcon,
        Sheep: sheepIcon,
        // **Crucially, provide fallbacks for core UI icons using the default set**
        // If you don't have animal versions of these, fall back to Feather
        Settings: FiIcons.FiSettings,
        User: FiIcons.FiUser,
        Logout: FiIcons.FiLogOut,
        Send: FiIcons.FiSend,
        Edit: FiIcons.FiEdit,
        Delete: FiIcons.FiTrash2,
        Add: FiIcons.FiPlus,
        Explore: FiIcons.FiCompass,
        Spotlight: FiIcons.FiStar,
        Trending: FiIcons.FiTrendingUp,
        AI: FiIcons.FiCpu,
        Check: FiIcons.FiCheckCircle,
        Rocket: FiIcons.FiRocket,
        Search: FiIcons.FiSearch,
        Save: FiIcons.FiSave,
        // ... add fallbacks for any other core icons
    },
    // Add other themes (e.g., Material) here if desired
};

// Helper function to get icons, ensuring fallback for missing ones in a theme
const getIconsForTheme = (themeName) => {
    const defaultThemeIcons = iconThemes.feather; // Default set
    const selectedThemeIcons = iconThemes[themeName] || defaultThemeIcons;

    // Merge selected theme with default theme to ensure all keys exist
    const mergedIcons = { ...defaultThemeIcons, ...selectedThemeIcons };
    return mergedIcons;
}


export const availableLocalIconThemes = Object.keys(iconThemes);

export const LocalIconThemeProvider = ({ children }) => {
    const [iconThemeName, setIconThemeNameState] = useState(() => {
        return localStorage.getItem('localIconTheme') || 'feather';
    });

    useEffect(() => {
        localStorage.setItem('localIconTheme', iconThemeName);
        document.body.dataset.localIconTheme = iconThemeName;
    }, [iconThemeName]);

    const setIconTheme = (newThemeName) => {
        if (iconThemes[newThemeName]) {
            setIconThemeNameState(newThemeName);
            // Backend update handled in SettingsPage
        } else {
            console.warn("Tried to set invalid local icon theme:", newThemeName);
        }
    };

    // Provide the theme name and the fully resolved icon map for the current theme
    const currentIcons = getIconsForTheme(iconThemeName);

    return (
        <LocalIconThemeContext.Provider value={{ iconThemeName, setIconTheme, currentIcons }}>
            {children}
        </LocalIconThemeContext.Provider>
    );
};

// Custom hook
export const useLocalIconTheme = () => useContext(LocalIconThemeContext);