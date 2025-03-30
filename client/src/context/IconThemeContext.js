// src/context/IconThemeContext.js (NEW FILE)
import React, { createContext, useState, useEffect, useContext } from 'react';
import * as FiIcons from 'react-icons/fi'; // Feather Icons
import * as MdIcons from 'react-icons/md'; // Material Design Icons
// You would import your cartoon icon components here if you had them
// import * as CartoonIcons from '../components/icons/cartoon'; // Example

const IconThemeContext = createContext();

// Define the icons needed across the app for each theme
const iconThemes = {
    feather: {
        settings: FiIcons.FiSettings,
        user: FiIcons.FiUser,
        logout: FiIcons.FiLogOut,
        send: FiIcons.FiSend,
        edit: FiIcons.FiEdit,
        delete: FiIcons.FiTrash2,
        add: FiIcons.FiPlus,
        explore: FiIcons.FiCompass, // Example
        spotlight: FiIcons.FiStar,  // Example
        trending: FiIcons.FiTrendingUp, // Example
        ai: FiIcons.FiCpu, // Example
        check: FiIcons.FiCheckCircle,
        rocket: FiIcons.FiRocket,
        search: FiIcons.FiSearch,
        save: FiIcons.FiSave,
    },
    material: {
        settings: MdIcons.MdSettings,
        user: MdIcons.MdPersonOutline,
        logout: MdIcons.MdLogout,
        send: MdIcons.MdSend,
        edit: MdIcons.MdEdit,
        delete: MdIcons.MdDeleteOutline,
        add: MdIcons.MdAdd,
        explore: MdIcons.MdExplore,
        spotlight: MdIcons.MdOutlineStar,
        trending: MdIcons.MdTrendingUp,
        ai: MdIcons.MdComputer, // Example using a different Material icon
        check: MdIcons.MdCheckCircleOutline,
        rocket: MdIcons.MdRocketLaunch,
        search: MdIcons.MdSearch,
        save: MdIcons.MdSave,
    },
    // Add more themes here, e.g., a 'cartoon' theme
    // cartoon: {
    //   settings: CartoonIcons.Settings, // Assuming you have custom components
    //   user: CartoonIcons.User,
    //   ...etc
    // }
};

export const availableIconThemes = Object.keys(iconThemes); // ['feather', 'material']

export const IconThemeProvider = ({ children }) => {
    const [iconTheme, setIconThemeState] = useState(() => {
        return localStorage.getItem('iconTheme') || 'feather'; // Default to feather
    });

    useEffect(() => {
        // Save theme preference to localStorage
        localStorage.setItem('iconTheme', iconTheme);
        // Optionally add a class to the body for theme-specific CSS if needed
        // document.body.dataset.iconTheme = iconTheme;
    }, [iconTheme]);

    const setIconTheme = (newTheme) => {
        if (iconThemes[newTheme]) {
            setIconThemeState(newTheme);
            // Backend update call will be handled in SettingsPage
        } else {
            console.warn("Tried to set invalid icon theme:", newTheme);
        }
    };

    // Provide the current theme name and the actual icon components map
    const currentIcons = iconThemes[iconTheme] || iconThemes.feather; // Fallback to feather

    return (
        <IconThemeContext.Provider value={{ iconTheme, setIconTheme, currentIcons }}>
            {children}
        </IconThemeContext.Provider>
    );
};

// Custom hook
export const useIconTheme = () => useContext(IconThemeContext);