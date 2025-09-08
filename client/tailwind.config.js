/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#00A6FB',
                    hover: '#0582CA',
                },
                secondary: {
                    DEFAULT: '#0582CA',
                    hover: '#006494',
                },
                accent: {
                    primary: '#006494',
                    secondary: '#003554',
                    tertiary: '#051923',
                },
                blue: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#00A6FB',
                    600: '#0582CA',
                    700: '#006494',
                    800: '#003554',
                    900: '#051923',
                },
            },
            fontFamily: {
                'sans': ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
            },
        },
    },
    plugins: [],
    corePlugins: {
        preflight: false, // Disable TailwindCSS reset to avoid conflicts with custom CSS
    },
}
