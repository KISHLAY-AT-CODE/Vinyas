import { useState, useEffect } from 'react';

const defaultTheme = {
    preset: 'default',
    accentColor: '#f97316',
    secondaryColor: '#ef4444',
    bodyBg: '#110b05',
    headerBackdrop: 'rgba(28, 18, 10, 0.65)',
    cardBackdrop: 'rgba(20, 12, 6, 0.4)',
    hoverBorderGlow: '#f97316',
    bgStyle: 'gradient',
    svgMeshCoords: null,
    bgOpacity: 0.25,
    bgBlur: 0,
    bgScale: 100,
    bgPositionX: 50,
    bgPositionY: 0,
    performanceMode: false
};

export const useThemeSettings = () => {
    const [themeModalOpen, setThemeModalOpen] = useState(false);
    
    const [themeSettings, setThemeSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('vinyasThemeSettings');
            return saved ? { performanceMode: false, ...JSON.parse(saved) } : defaultTheme;
        } catch (e) {
            return defaultTheme;
        }
    });

    const [backdropImage, setBackdropImage] = useState(() => {
        try {
            return localStorage.getItem('vinyasCustomLocalBg') || '';
        } catch (e) {
            return '';
        }
    });

    // Synchronize backdrop image updates across browser tabs
    useEffect(() => {
        const handleStorageChange = () => {
            try {
                setBackdropImage(localStorage.getItem('vinyasCustomLocalBg') || '');
            } catch (e) {}
        };
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('vinyas-bg-update', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('vinyas-bg-update', handleStorageChange);
        };
    }, []);

    // Apply CSS custom variables dynamically to document element
    useEffect(() => {
        const hexToRgb = (hex) => {
            const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
            const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };

        const activePresetId = themeSettings.preset || 'default';
        const defaultsByPreset = {
            default: {
                bodyBg: '#110b05',
                headerBackdrop: 'rgba(28, 18, 10, 0.65)',
                cardBackdrop: 'rgba(20, 12, 6, 0.4)',
                hoverBorderGlow: '#f97316',
                primary: '#f97316',
                secondary: '#ef4444'
            },
            emerald: {
                bodyBg: '#020c08',
                headerBackdrop: 'rgba(8, 30, 20, 0.65)',
                cardBackdrop: 'rgba(4, 20, 12, 0.45)',
                hoverBorderGlow: '#10b981',
                primary: '#10b981',
                secondary: '#059669'
            },
            blue: {
                bodyBg: '#020c1b',
                headerBackdrop: 'rgba(4, 20, 40, 0.65)',
                cardBackdrop: 'rgba(2, 12, 28, 0.42)',
                hoverBorderGlow: '#0ea5e9',
                primary: '#0ea5e9',
                secondary: '#3b82f6'
            },
            purple: {
                bodyBg: '#0f0219',
                headerBackdrop: 'rgba(28, 6, 44, 0.7)',
                cardBackdrop: 'rgba(18, 3, 30, 0.48)',
                hoverBorderGlow: '#ec4899',
                primary: '#a855f7',
                secondary: '#ec4899'
            },
            slate: {
                bodyBg: '#090a0c',
                headerBackdrop: 'rgba(20, 22, 26, 0.85)',
                cardBackdrop: 'rgba(14, 15, 18, 0.65)',
                hoverBorderGlow: '#94a3b8',
                primary: '#e2e8f0',
                secondary: '#94a3b8'
            },
            custom: {
                bodyBg: '#090a0f',
                headerBackdrop: 'rgba(15, 23, 42, 0.65)',
                cardBackdrop: 'rgba(10, 15, 30, 0.4)',
                hoverBorderGlow: '#f97316',
                primary: '#f97316',
                secondary: '#ec4899'
            }
        };

        const presetDefaults = defaultsByPreset[activePresetId] || defaultsByPreset.default;
        const root = document.documentElement;
        const primary = themeSettings.accentColor || presetDefaults.primary;
        const secondary = themeSettings.secondaryColor || presetDefaults.secondary;
        const rgb = hexToRgb(primary);
        
        root.style.setProperty('--primary-accent', primary);
        root.style.setProperty('--secondary-accent', secondary);
        root.style.setProperty('--glass-opacity', themeSettings.bgOpacity !== undefined ? themeSettings.bgOpacity : 0.25);
        root.style.setProperty('--glass-blur', `${themeSettings.bgBlur !== undefined ? themeSettings.bgBlur : 100}px`);

        if (themeSettings.performanceMode) {
            root.classList.add('performance-mode');
        } else {
            root.classList.remove('performance-mode');
        }

        const bodyBg = themeSettings.bodyBg || presetDefaults.bodyBg;
        const headerBackdrop = themeSettings.headerBackdrop || presetDefaults.headerBackdrop;
        const cardBackdrop = themeSettings.cardBackdrop || presetDefaults.cardBackdrop;
        const hoverBorderGlow = themeSettings.hoverBorderGlow || presetDefaults.hoverBorderGlow;
        const hoverRgb = hexToRgb(hoverBorderGlow);

        root.style.setProperty('--body-bg-color', bodyBg);
        root.style.setProperty('--header-backdrop', headerBackdrop);
        root.style.setProperty('--card-backdrop', cardBackdrop);
        root.style.setProperty('--hover-border-glow', hoverBorderGlow);
        if (hoverRgb) {
            root.style.setProperty('--hover-border-glow-rgb', `${hoverRgb.r}, ${hoverRgb.g}, ${hoverRgb.b}`);
        }

        if (rgb) {
            root.style.setProperty('--primary-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
            root.style.setProperty('--primary-accent-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
            const hoverR = Math.max(0, rgb.r - 20);
            const hoverG = Math.max(0, rgb.g - 20);
            const hoverB = Math.max(0, rgb.b - 20);
            root.style.setProperty('--primary-accent-hover', `rgb(${hoverR}, ${hoverG}, ${hoverB})`);
        }
        localStorage.setItem('vinyasThemeSettings', JSON.stringify(themeSettings));
    }, [themeSettings]);

    return {
        themeSettings,
        setThemeSettings,
        backdropImage,
        setBackdropImage,
        themeModalOpen,
        setThemeModalOpen
    };
};
