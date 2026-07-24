import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();
export const themeOptions = ['light', 'dark', 'omni', 'black'];

const normalizeTheme = (value) => themeOptions.includes(value) ? value : 'dark';

export const ThemeProvider = ({ children }) => {
    const [theme, setThemeState] = useState(() => normalizeTheme(localStorage.getItem('theme')));

    useEffect(() => {
        // Omni uses the dark selector family for legacy component styles while
        // its own token palette is defined in index.css.
        document.body.className = theme === 'light'
            ? 'light-theme'
            : theme === 'dark'
                ? 'dark-theme'
                : `${theme}-theme dark-theme`;

        if (theme !== 'light') {
            document.body.setAttribute('data-theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
        }

        localStorage.setItem('theme', theme);
    }, [theme]);

    const setTheme = (nextTheme) => setThemeState(normalizeTheme(nextTheme));

    // Preserve the existing two-state toggle for components that still use it.
    const toggleTheme = () => {
        setThemeState((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
