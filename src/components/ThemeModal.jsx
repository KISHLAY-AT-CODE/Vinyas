import React, { useState, useRef, useEffect } from 'react';

const hexToRgba = (hex, alpha) => {
    if (!hex) return '';
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})` : hex;
};

const colorToHex = (color) => {
    if (!color) return '#000000';
    if (color.startsWith('#')) return color;
    if (color.startsWith('rgba') || color.startsWith('rgb')) {
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) {
            const r = parseInt(matches[0], 10);
            const g = parseInt(matches[1], 10);
            const b = parseInt(matches[2], 10);
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }
    }
    return '#000000';
};

const PRESET_THEMES = [
    { 
        id: 'default', 
        name: 'Classic Orange', 
        primary: '#f97316', 
        secondary: '#ef4444', 
        bodyBg: '#110b05',
        headerBackdrop: 'rgba(28, 18, 10, 0.65)',
        cardBackdrop: 'rgba(20, 12, 6, 0.4)',
        hoverBorderGlow: '#f97316',
        desc: 'Warm sunset-brown with signature Vinyas orange highlights' 
    },
    { 
        id: 'emerald', 
        name: 'Forest Emerald', 
        primary: '#10b981', 
        secondary: '#059669', 
        bodyBg: '#020c08',
        headerBackdrop: 'rgba(8, 30, 20, 0.65)',
        cardBackdrop: 'rgba(4, 20, 12, 0.45)',
        hoverBorderGlow: '#10b981',
        desc: 'Deep forest canopy focused tech green' 
    },
    { 
        id: 'blue', 
        name: 'Ocean Breeze', 
        primary: '#0ea5e9', 
        secondary: '#3b82f6', 
        bodyBg: '#020c1b',
        headerBackdrop: 'rgba(4, 20, 40, 0.65)',
        cardBackdrop: 'rgba(2, 12, 28, 0.42)',
        hoverBorderGlow: '#0ea5e9',
        desc: 'Abyssal deep marine navy-blue clarity' 
    },
    { 
        id: 'purple', 
        name: 'Neon Orchid', 
        primary: '#a855f7', 
        secondary: '#ec4899', 
        bodyBg: '#0f0219',
        headerBackdrop: 'rgba(28, 6, 44, 0.7)',
        cardBackdrop: 'rgba(18, 3, 30, 0.48)',
        hoverBorderGlow: '#ec4899',
        desc: 'Vibrant cyberpunk purple and hot pink overlays' 
    },
    { 
        id: 'slate', 
        name: 'Midnight Slate', 
        primary: '#e2e8f0', 
        secondary: '#94a3b8', 
        bodyBg: '#090a0c',
        headerBackdrop: 'rgba(20, 22, 26, 0.85)',
        cardBackdrop: 'rgba(14, 15, 18, 0.65)',
        hoverBorderGlow: '#94a3b8',
        desc: 'Minimal sleek carbon and charcoal gray' 
    }
];

const ThemeModal = ({ isOpen, onClose, themeSettings, onUpdateThemeSettings, showToast }) => {
    const fileInputRef = useRef(null);
    const previewRef = useRef(null);
    const [customPrimary, setCustomPrimary] = useState(themeSettings.accentColor || '#f97316');
    const [customSecondary, setCustomSecondary] = useState(themeSettings.secondaryColor || '#ec4899');
    const [customBodyBg, setCustomBodyBg] = useState(themeSettings.bodyBg || '#0f172a');
    const [customHeaderBg, setCustomHeaderBg] = useState(colorToHex(themeSettings.headerBackdrop || 'rgba(15, 23, 42, 0.65)'));
    const [customCardBg, setCustomCardBg] = useState(colorToHex(themeSettings.cardBackdrop || 'rgba(10, 15, 30, 0.4)'));
    const [customHoverBorder, setCustomHoverBorder] = useState(themeSettings.hoverBorderGlow || '#f97316');
    const [opacity, setOpacity] = useState(themeSettings.bgOpacity || 0.25);
    const [blur, setBlur] = useState(themeSettings.bgBlur !== undefined ? themeSettings.bgBlur : 0);
    const [dragActive, setDragActive] = useState(false);
    const [isPreviewHidden, setIsPreviewHidden] = useState(false);

    // Mouse and Touch Drag repositioning state
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const dragStartPos = useRef({ x: 50, y: 0 });

    const handleDragStart = (e) => {
        if (!previewRef.current) return;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (clientX === undefined || clientY === undefined) return;
        
        setIsDragging(true);
        dragStart.current = { x: clientX, y: clientY };
        dragStartPos.current = {
            x: themeSettings.bgPositionX !== undefined ? themeSettings.bgPositionX : 50,
            y: themeSettings.bgPositionY !== undefined ? themeSettings.bgPositionY : 0
        };
    };

    const handleDragMove = (e) => {
        if (!isDragging || !previewRef.current) return;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (clientX === undefined || clientY === undefined) return;

        const rect = previewRef.current.getBoundingClientRect();
        const dx = clientX - dragStart.current.x;
        const dy = clientY - dragStart.current.y;

        const moveX = Math.round(dragStartPos.current.x - (dx / rect.width) * 100);
        const moveY = Math.round(dragStartPos.current.y - (dy / rect.height) * 100);

        onUpdateThemeSettings({
            bgPositionX: Math.max(0, Math.min(100, moveX)),
            bgPositionY: Math.max(0, Math.min(100, moveY))
        });
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isOpen) {
            setCustomPrimary(themeSettings.accentColor || '#f97316');
            setCustomSecondary(themeSettings.secondaryColor || '#ec4899');
            setCustomBodyBg(themeSettings.bodyBg || '#0f172a');
            setCustomHeaderBg(colorToHex(themeSettings.headerBackdrop || 'rgba(15, 23, 42, 0.65)'));
            setCustomCardBg(colorToHex(themeSettings.cardBackdrop || 'rgba(10, 15, 30, 0.4)'));
            setCustomHoverBorder(themeSettings.hoverBorderGlow || '#f97316');
            setOpacity(themeSettings.bgOpacity || 0.25);
            setBlur(themeSettings.bgBlur !== undefined ? themeSettings.bgBlur : 0);
        }
    }, [isOpen, themeSettings]);

    if (!isOpen) return null;

    const handleSelectPreset = (preset) => {
        if (preset.id === 'custom') {
            onUpdateThemeSettings({
                preset: 'custom',
                accentColor: customPrimary,
                secondaryColor: customSecondary,
                bodyBg: customBodyBg,
                headerBackdrop: hexToRgba(customHeaderBg, 0.65),
                cardBackdrop: hexToRgba(customCardBg, 0.40),
                hoverBorderGlow: customHoverBorder
            });
        } else {
            const target = PRESET_THEMES.find(t => t.id === preset.id);
            if (target) {
                onUpdateThemeSettings({
                    preset: target.id,
                    accentColor: target.primary,
                    secondaryColor: target.secondary,
                    bodyBg: target.bodyBg,
                    headerBackdrop: target.headerBackdrop,
                    cardBackdrop: target.cardBackdrop,
                    hoverBorderGlow: target.hoverBorderGlow
                });
                setCustomPrimary(target.primary);
                setCustomSecondary(target.secondary);
                setCustomBodyBg(target.bodyBg);
                setCustomHeaderBg(colorToHex(target.headerBackdrop));
                setCustomCardBg(colorToHex(target.cardBackdrop));
                setCustomHoverBorder(target.hoverBorderGlow);
                showToast(`Applied theme: ${target.name}!`, "success");
            }
        }
    };

    const handleCustomChange = (updated) => {
        const nextAccent = updated.accentColor !== undefined ? updated.accentColor : customPrimary;
        const nextSecondary = updated.secondaryColor !== undefined ? updated.secondaryColor : customSecondary;
        const nextBody = updated.bodyBg !== undefined ? updated.bodyBg : customBodyBg;
        
        const nextHeaderHex = updated.headerBackdrop !== undefined ? updated.headerBackdrop : customHeaderBg;
        const nextCardHex = updated.cardBackdrop !== undefined ? updated.cardBackdrop : customCardBg;
        const nextHover = updated.hoverBorderGlow !== undefined ? updated.hoverBorderGlow : customHoverBorder;

        if (updated.accentColor !== undefined) setCustomPrimary(updated.accentColor);
        if (updated.secondaryColor !== undefined) setCustomSecondary(updated.secondaryColor);
        if (updated.bodyBg !== undefined) setCustomBodyBg(updated.bodyBg);
        if (updated.headerBackdrop !== undefined) setCustomHeaderBg(updated.headerBackdrop);
        if (updated.cardBackdrop !== undefined) setCustomCardBg(updated.cardBackdrop);
        if (updated.hoverBorderGlow !== undefined) setCustomHoverBorder(updated.hoverBorderGlow);

        onUpdateThemeSettings({
            preset: 'custom',
            accentColor: nextAccent,
            secondaryColor: nextSecondary,
            bodyBg: nextBody,
            headerBackdrop: hexToRgba(nextHeaderHex, 0.65),
            cardBackdrop: hexToRgba(nextCardHex, 0.40),
            hoverBorderGlow: nextHover
        });
    };

    const processImageToMesh = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast("Invalid file type: Please upload an image.", "error");
            return;
        }

        showToast("Processing high-quality background image (local only)...", "info");
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // 1. Create a high-res canvas capped at 1920px to maintain pristine quality and aspect ratio
                const maxDim = 1920;
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }

                const highResCanvas = document.createElement('canvas');
                highResCanvas.width = w;
                highResCanvas.height = h;
                const highResCtx = highResCanvas.getContext('2d');
                highResCtx.drawImage(img, 0, 0, w, h);
                const highResDataUrl = highResCanvas.toDataURL('image/jpeg', 0.85);

                // 2. Generate mesh coordinates as a secondary fallback
                const meshCanvas = document.createElement('canvas');
                meshCanvas.width = 50;
                meshCanvas.height = 50;
                const meshCtx = meshCanvas.getContext('2d');
                meshCtx.drawImage(img, 0, 0, 50, 50);

                const coords = [
                    { x: 25, y: 25, cx: '50%', cy: '50%', r: 500 }, // Center
                    { x: 8,  y: 8,  cx: '15%', cy: '15%', r: 400 }, // Top-Left
                    { x: 42, y: 8,  cx: '85%', cy: '20%', r: 420 }, // Top-Right
                    { x: 8,  y: 42, cx: '20%', cy: '80%', r: 450 }, // Bottom-Left
                    { x: 42, y: 42, cx: '80%', cy: '85%', r: 430 }  // Bottom-Right
                ];

                try {
                    const blobs = coords.map(c => {
                        const pixel = meshCtx.getImageData(c.x, c.y, 1, 1).data;
                        const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
                        return {
                            cx: c.cx,
                            cy: c.cy,
                            r: c.r,
                            color: hex
                        };
                    });

                    // Store STRICTLY in local storage to keep DB payload 0 bytes!
                    try {
                        localStorage.setItem('vinyasCustomLocalBg', highResDataUrl);
                        // Notify background rendering loops
                        window.dispatchEvent(new Event('vinyas-bg-update'));
                    } catch (storageErr) {
                        console.error("Local storage allocation failed:", storageErr);
                        showToast("Image is too large for browser local storage. Try compressing it or using a web URL.", "error");
                        return;
                    }

                    // Update parent settings state with uploader status
                    onUpdateThemeSettings({
                        bgStyle: 'crisp-image',
                        svgMeshCoords: blobs,
                        uploadedImgLocal: true,
                        uploadedImgUrl: '' // Clear URL if local uploader active
                    });
                    showToast("Stunning full-quality background image successfully loaded!", "success");
                } catch (e) {
                    console.error(e);
                    showToast("Failed to parse image pixels. Try a different image format.", "error");
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        processImageToMesh(file);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processImageToMesh(e.dataTransfer.files[0]);
        }
    };

    const handleResetBackground = () => {
        onUpdateThemeSettings({
            bgStyle: 'gradient',
            svgMeshCoords: null,
            uploadedImg: null
        });
        showToast("Restored default ambient gradients.", "success");
    };

    return (
        <div 
            onClick={() => {
                if (isPreviewHidden) {
                    setIsPreviewHidden(false);
                }
            }}
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
                isPreviewHidden 
                    ? 'bg-transparent backdrop-blur-none pointer-events-auto cursor-pointer' 
                    : 'bg-slate-950/70 backdrop-blur-md pointer-events-auto'
            }`}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className={`bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col relative transition-all duration-300 ${
                    isPreviewHidden 
                        ? 'opacity-0 scale-95 pointer-events-none' 
                        : 'opacity-100 scale-100 pointer-events-auto'
                }`}
            >
                {/* Visual Ambient Spotlights */}
                <div className="absolute -left-12 -top-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-20 bg-gradient-to-tr from-orange-500 to-indigo-600" />
                
                {/* Header Section */}
                <div className="p-6 border-b border-slate-850 flex justify-between items-center bg-slate-900/95 backdrop-blur-md">
                    <div>
                        <h3 className="text-lg font-black bg-gradient-to-r from-orange-400 via-pink-500 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
                            <i className="ph-bold ph-palette text-xl"></i>
                            UI Theme & Background Customizer
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Design a premium tailored style for your Vinyas workspace.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsPreviewHidden(true)}
                            className="px-3.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 flex items-center gap-1.5 text-xs font-black transition-all cursor-pointer hover:scale-105 active:scale-95"
                            title="Preview layout behind the customizer (Click anywhere to restore)"
                        >
                            <i className="ph-bold ph-eye text-sm"></i>
                            <span>Preview</span>
                        </button>
                        
                        <button 
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <i className="ph-bold ph-x"></i>
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6 relative z-10 custom-scrollbar">
                    
                    {/* 1. Theme Presets */}
                    <div className="space-y-3">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Choose Theme Preset</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {PRESET_THEMES.map((theme) => {
                                const isActive = themeSettings.preset === theme.id;
                                return (
                                    <button
                                        key={theme.id}
                                        onClick={() => handleSelectPreset(theme)}
                                        className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all duration-300 cursor-pointer ${
                                            isActive 
                                                ? 'bg-slate-850 border-orange-500/50 shadow-md ring-1 ring-orange-500/20 scale-[1.02]' 
                                                : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 hover:bg-slate-850/40'
                                        }`}
                                    >
                                        <span 
                                            className="w-6 h-6 rounded-full flex-shrink-0 border border-white/10"
                                            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
                                        />
                                        <div>
                                            <h4 className="text-xs font-black text-slate-200">{theme.name}</h4>
                                            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{theme.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}

                            {/* Custom Color Button */}
                            <button
                                onClick={() => handleSelectPreset({ id: 'custom' })}
                                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all duration-300 cursor-pointer ${
                                    themeSettings.preset === 'custom'
                                        ? 'bg-slate-850 border-orange-500/50 shadow-md ring-1 ring-orange-500/20 scale-[1.02]'
                                        : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 hover:bg-slate-850/40'
                                }`}
                            >
                                <span 
                                    className="w-6 h-6 rounded-full flex-shrink-0 border border-white/10 flex items-center justify-center bg-gradient-to-tr from-rose-500 via-orange-400 to-indigo-500 text-[10px] text-white font-bold"
                                    style={themeSettings.preset === 'custom' ? { background: `linear-gradient(135deg, ${customPrimary}, ${customSecondary})` } : {}}
                                >
                                    🎨
                                </span>
                                <div>
                                    <h4 className="text-xs font-black text-slate-200">Custom Colors</h4>
                                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Fine-tune your personal brand</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* 2. Custom Color Picker Options */}
                    {themeSettings.preset === 'custom' && (
                        <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-2xl animate-fade-in space-y-4">
                            {/* Section A: Brand Accents */}
                            <div className="space-y-2">
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block border-b border-slate-900 pb-1">
                                    1. Brand Accent Colors
                                </span>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-slate-400 font-bold block">Accent Primary</label>
                                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
                                            <input 
                                                type="color" 
                                                value={customPrimary}
                                                onChange={(e) => handleCustomChange({ accentColor: e.target.value })}
                                                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                                            />
                                            <span className="font-mono text-[11px] font-bold text-slate-300 uppercase select-all">{customPrimary}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-slate-400 font-bold block">Accent Secondary</label>
                                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
                                            <input 
                                                type="color" 
                                                value={customSecondary}
                                                onChange={(e) => handleCustomChange({ secondaryColor: e.target.value })}
                                                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                                            />
                                            <span className="font-mono text-[11px] font-bold text-slate-300 uppercase select-all">{customSecondary}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section B: Workspace Layout Glass & Borders */}
                            <div className="space-y-2 pt-1">
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block border-b border-slate-900 pb-1">
                                    2. Workspace Backdrops & Glow
                                </span>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-slate-400 font-bold block">Body Background</label>
                                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
                                            <input 
                                                type="color" 
                                                value={customBodyBg}
                                                onChange={(e) => handleCustomChange({ bodyBg: e.target.value })}
                                                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                                            />
                                            <span className="font-mono text-[11px] font-bold text-slate-300 uppercase select-all">{customBodyBg}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-slate-400 font-bold block" title="Automatically rendered as transparent glassmorphism (65%)">Header Backdrop</label>
                                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
                                            <input 
                                                type="color" 
                                                value={customHeaderBg}
                                                onChange={(e) => handleCustomChange({ headerBackdrop: e.target.value })}
                                                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                                            />
                                            <span className="font-mono text-[11px] font-bold text-slate-300 uppercase select-all">{customHeaderBg}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-slate-400 font-bold block" title="Automatically rendered as transparent glassmorphism (40%)">Cards Backdrop</label>
                                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
                                            <input 
                                                type="color" 
                                                value={customCardBg}
                                                onChange={(e) => handleCustomChange({ cardBackdrop: e.target.value })}
                                                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                                            />
                                            <span className="font-mono text-[11px] font-bold text-slate-300 uppercase select-all">{customCardBg}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-slate-400 font-bold block">Hover Glow Border</label>
                                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
                                            <input 
                                                type="color" 
                                                value={customHoverBorder}
                                                onChange={(e) => handleCustomChange({ hoverBorderGlow: e.target.value })}
                                                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                                            />
                                            <span className="font-mono text-[11px] font-bold text-slate-300 uppercase select-all">{customHoverBorder}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Image-to-SVG Mesh Vectorizer */}
                    <div className="space-y-3">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Background Vectorizer</label>
                        
                        {/* File Upload Area */}
                        <div 
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center gap-2.5 cursor-pointer select-none relative ${
                                dragActive 
                                    ? 'border-orange-500/70 bg-orange-500/5' 
                                    : 'border-slate-800 bg-slate-950/20 hover:border-slate-700 hover:bg-slate-950/40'
                            }`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input 
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/*"
                                className="hidden"
                            />
                            
                            <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-750 flex items-center justify-center text-slate-400 group-hover:scale-115 transition-transform">
                                <i className="ph-fill ph-file-image text-2xl bg-gradient-to-r from-orange-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent"></i>
                            </div>
                            
                            <div>
                                <h4 className="text-xs font-black text-slate-200">Upload High-Res Local Image</h4>
                                <p className="text-[10px] text-slate-500 mt-1 font-medium">Drag & Drop or browse to load a pristine uncompressed background strictly inside your browser (never saved to database).</p>
                            </div>
                        </div>

                        {/* Web Image URL Alternative */}
                        <div className="space-y-1.5 p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl text-left">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Or Paste Web Image URL</label>
                            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5">
                                <input 
                                    type="text" 
                                    value={themeSettings.uploadedImgUrl || ''}
                                    onChange={(e) => {
                                        const url = e.target.value;
                                        onUpdateThemeSettings({
                                            bgStyle: url ? 'crisp-image' : 'gradient',
                                            uploadedImgUrl: url,
                                            uploadedImgLocal: false // Clear local uploader flag
                                        });
                                        localStorage.removeItem('vinyasCustomLocalBg');
                                        // Notify background rendering loops
                                        window.dispatchEvent(new Event('vinyas-bg-update'));
                                    }}
                                    placeholder="https://images.unsplash.com/photo-..."
                                    className="w-full bg-transparent text-xs font-semibold text-slate-350 outline-none px-2 py-1"
                                />
                                {themeSettings.uploadedImgUrl && (
                                    <button
                                        onClick={() => {
                                            onUpdateThemeSettings({ 
                                                uploadedImgUrl: '',
                                                bgStyle: 'gradient'
                                            });
                                            // Notify background rendering loops
                                            window.dispatchEvent(new Event('vinyas-bg-update'));
                                        }}
                                        className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 flex items-center justify-center cursor-pointer font-bold shrink-0"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                            <span className="text-[9px] text-slate-650 mt-1 block">Pastes any online image address. Auto-synchronized across all connected screens.</span>
                        </div>

                        {/* Interactive Position & Crop Backdrop Previewer */}
                        {(themeSettings.uploadedImgLocal || themeSettings.uploadedImgUrl) && (
                            <div className="space-y-4 p-4 bg-slate-950/60 border border-slate-850 rounded-2xl animate-fade-in text-left">
                                {/* Header actions */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <i className="ph-fill ph-crop text-lg text-indigo-400"></i>
                                        <div>
                                            <h5 className="text-[11px] font-black text-slate-200">Interactive Backdrop Positioner</h5>
                                            <p className="text-[9px] text-slate-500 font-medium">Pan, scale, blur, and fade your background image</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleResetBackground}
                                        className="px-2.5 py-1 bg-slate-900 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-lg text-[9px] font-black border border-slate-800 transition-all cursor-pointer"
                                    >
                                        Remove Image
                                    </button>
                                </div>

                                {/* Mock Vinyas Dashboard Viewport Preview Frame */}
                                <div 
                                    ref={previewRef}
                                    onMouseDown={handleDragStart}
                                    onMouseMove={handleDragMove}
                                    onMouseUp={handleDragEnd}
                                    onMouseLeave={handleDragEnd}
                                    onTouchStart={handleDragStart}
                                    onTouchMove={handleDragMove}
                                    onTouchEnd={handleDragEnd}
                                    className={`relative border border-slate-800 rounded-2xl bg-[#070a13] h-56 overflow-hidden w-full flex flex-col shadow-inner select-none cursor-grab active:cursor-grabbing transition-shadow ${
                                        isDragging ? 'shadow-lg ring-1 ring-indigo-500/30' : ''
                                    }`}
                                    title="Click and drag to position the background image"
                                >
                                    {/* Dynamic Preview Background layer */}
                                    <div 
                                        className="absolute inset-0 w-full h-full pointer-events-none bg-image-ambient"
                                        style={{
                                            backgroundImage: `url(${themeSettings.uploadedImgLocal ? (localStorage.getItem('vinyasCustomLocalBg') || '') : themeSettings.uploadedImgUrl})`,
                                            backgroundSize: themeSettings.bgScale && themeSettings.bgScale !== 100 ? `${themeSettings.bgScale}%` : 'cover',
                                            backgroundPosition: `${themeSettings.bgPositionX !== undefined ? themeSettings.bgPositionX : 50}% ${themeSettings.bgPositionY !== undefined ? themeSettings.bgPositionY : 0}%`,
                                            backgroundRepeat: 'no-repeat',
                                            filter: themeSettings.bgBlur ? `blur(${themeSettings.bgBlur * 0.15}px)` : 'none',
                                            opacity: themeSettings.bgOpacity !== undefined ? themeSettings.bgOpacity : 0.25,
                                            transition: isDragging ? 'none' : 'opacity 0.1s ease, filter 0.1s ease'
                                        }}
                                    />

                                    {/* Mock Vinyas Layout elements overlay */}
                                    <div className="absolute inset-0 flex flex-col p-3.5 z-10 pointer-events-none">
                                        {/* Mock Vinyas Header strip */}
                                        <div className="h-8 rounded-lg bg-slate-900/50 border border-slate-800/40 flex items-center justify-between px-3 shrink-0 mb-3 backdrop-blur-[2px]">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3.5 h-3.5 rounded bg-orange-500/70 flex items-center justify-center text-[8px] font-black text-white">Y</div>
                                                <div className="w-10 h-2 bg-white/70 rounded-full"></div>
                                            </div>
                                            <div className="w-24 h-3.5 bg-slate-950/40 border border-slate-900/40 rounded-full"></div>
                                            <div className="flex gap-2">
                                                <div className="w-3.5 h-3.5 rounded-full bg-slate-800/70"></div>
                                                <div className="w-3.5 h-3.5 rounded-full bg-slate-800/70"></div>
                                            </div>
                                        </div>

                                        {/* Mock Dashboard Layout with realistic scaling */}
                                        <div className="flex-grow flex gap-3 overflow-hidden">
                                            {/* Column 1: GamifiedDashboard mock (30% width) */}
                                            <div className="w-[30%] rounded-xl bg-slate-900/40 border border-slate-800/30 p-2 flex flex-col gap-2 shrink-0 backdrop-blur-[1px]">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-4 h-4 rounded-full bg-orange-500/40 shrink-0"></div>
                                                    <div className="w-8 h-1.5 bg-slate-200/80 rounded"></div>
                                                </div>
                                                <div className="space-y-1 bg-slate-950/30 p-1 rounded-lg border border-slate-900/40">
                                                    <div className="flex justify-between text-[6px] font-bold text-slate-500">
                                                        <span>Lvl 3</span>
                                                        <span>60%</span>
                                                    </div>
                                                    <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                                                        <div className="w-3/5 h-full bg-orange-500"></div>
                                                    </div>
                                                </div>
                                                <div className="w-full h-8 bg-slate-950/30 border border-slate-900/40 rounded-lg p-1 space-y-1">
                                                    <div className="w-10 h-1 bg-slate-600 rounded"></div>
                                                    <div className="flex gap-0.5 justify-between">
                                                        {[...Array(7)].map((_, i) => (
                                                            <div key={i} className={`w-1.5 h-1.5 rounded-sm ${i < 3 ? 'bg-indigo-500/80' : 'bg-slate-800/80'}`}></div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Column 2: main card space mock (remaining 70% width) */}
                                            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                                                {/* Mock Routine Card */}
                                                <div className="rounded-xl bg-slate-900/40 border border-slate-800/30 p-2.5 flex justify-between items-center backdrop-blur-[1px] shrink-0">
                                                    <div className="space-y-1.5">
                                                        <div className="w-16 h-2 bg-slate-100 rounded"></div>
                                                        <div className="w-20 h-1.5 bg-slate-400/80 rounded"></div>
                                                    </div>
                                                    <div className="w-10 h-4 bg-indigo-500/20 border border-indigo-500/30 rounded-full"></div>
                                                </div>

                                                {/* Mock Syllabus Subject Organizer */}
                                                <div className="rounded-xl bg-slate-900/40 border border-slate-800/30 p-2 flex-grow flex flex-col gap-1.5 backdrop-blur-[1px] overflow-hidden">
                                                    <div className="w-12 h-1.5 bg-slate-300 rounded"></div>
                                                    <div className="space-y-1 mt-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-2.5 h-2.5 bg-slate-950 border border-slate-805 rounded-sm"></div>
                                                            <div className="w-24 h-1 bg-slate-450 rounded"></div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-2.5 h-2.5 bg-indigo-500/80 border border-transparent rounded-sm flex items-center justify-center text-[5px] text-white">✓</div>
                                                            <div className="w-28 h-1 bg-slate-450 rounded"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Tooltip Overlay */}
                                    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-950/80 border border-slate-800 rounded-full px-3 py-1 text-[8px] font-black text-slate-300 flex items-center gap-1.5 z-20 pointer-events-none backdrop-blur-sm shadow-md animate-pulse">
                                        <i className="ph-bold ph-hand-pointing text-indigo-400"></i>
                                        <span>Drag mouse in preview to position background</span>
                                    </div>
                                </div>

                                {/* Controls: Scale, Blur & Opacity Sliders */}
                                <div className="space-y-3 bg-slate-950/40 border border-slate-900 p-3 rounded-xl">
                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-900 pb-1">
                                        Backdrop Scaling & Filter Tuning
                                    </span>
                                    
                                    {/* 1. Zoom Slider */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[9px] font-bold">
                                            <span className="text-slate-400">Zoom / Scale</span>
                                            <span className="text-indigo-405 font-mono font-bold">{themeSettings.bgScale || 100}%</span>
                                        </div>
                                        <input 
                                            type="range"
                                            min="100"
                                            max="250"
                                            value={themeSettings.bgScale || 100}
                                            onChange={(e) => onUpdateThemeSettings({ bgScale: Number(e.target.value) })}
                                            className="w-full accent-indigo-505 h-1 bg-slate-900 rounded-lg cursor-pointer"
                                        />
                                    </div>

                                    {/* 2. Blur Slider */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[9px] font-bold">
                                            <span className="text-slate-400">Backdrop Blur Intensity</span>
                                            <span className="text-orange-400 font-mono font-bold">{themeSettings.bgBlur !== undefined ? themeSettings.bgBlur : 0}px</span>
                                        </div>
                                        <input 
                                            type="range"
                                            min="0"
                                            max="150"
                                            value={themeSettings.bgBlur !== undefined ? themeSettings.bgBlur : 0}
                                            onChange={(e) => onUpdateThemeSettings({ bgBlur: Number(e.target.value) })}
                                            className="w-full accent-orange-500 h-1 bg-slate-900 rounded-lg cursor-pointer"
                                        />
                                    </div>

                                    {/* 3. Opacity Slider */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[9px] font-bold">
                                            <span className="text-slate-400">Contrast Overlay Opacity</span>
                                            <span className="text-orange-400 font-mono font-bold">{Math.round((themeSettings.bgOpacity !== undefined ? themeSettings.bgOpacity : 0.25) * 100)}%</span>
                                        </div>
                                        <input 
                                            type="range"
                                            min="10"
                                            max="100"
                                            value={Math.round((themeSettings.bgOpacity !== undefined ? themeSettings.bgOpacity : 0.25) * 100)}
                                            onChange={(e) => onUpdateThemeSettings({ bgOpacity: Number(e.target.value) / 100 })}
                                            className="w-full accent-orange-500 h-1 bg-slate-900 rounded-lg cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. Opacity & Blur Tuning Sliders (Gradients & Mesh only) */}
                    {(!themeSettings.uploadedImgLocal && !themeSettings.uploadedImgUrl) && (
                        <div className="space-y-4 p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                            {/* Opacity Slider */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                    <span className="text-slate-500">Overlay Blur</span>
                                    <span className="text-orange-400 font-mono font-bold">{blur}px</span>
                                </div>
                                <input 
                                    type="range"
                                    min="20"
                                    max="150"
                                    value={blur}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setBlur(val);
                                        onUpdateThemeSettings({ bgBlur: val });
                                    }}
                                    className="w-full accent-orange-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                                />
                            </div>

                            {/* Blur Slider */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                    <span className="text-slate-500">Overlay Contrast Opacity</span>
                                    <span className="text-orange-400 font-mono font-bold">{Math.round(opacity * 100)}%</span>
                                </div>
                                <input 
                                    type="range"
                                    min="10"
                                    max="100"
                                    value={Math.round(opacity * 100)}
                                    onChange={(e) => {
                                        const val = Number(e.target.value) / 100;
                                        setOpacity(val);
                                        onUpdateThemeSettings({ bgOpacity: val });
                                    }}
                                    className="w-full accent-orange-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                                />
                            </div>
                        </div>
                    )}

                    {/* 5. Performance & GPU Optimization */}
                    <div className="space-y-3 p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block border-b border-slate-900 pb-1">
                            Performance & GPU Optimization
                        </label>
                        <div className="flex items-start gap-3 mt-2">
                            <label className="flex items-center gap-3 cursor-pointer group text-xs text-slate-300 select-none">
                                <input
                                    type="checkbox"
                                    checked={themeSettings.performanceMode || false}
                                    onChange={(e) => onUpdateThemeSettings({ performanceMode: e.target.checked })}
                                    className="w-4.5 h-4.5 rounded bg-slate-950 border-slate-850 text-orange-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="font-extrabold group-hover:text-white transition-colors flex items-center gap-1.5">
                                    <i className="ph-bold ph-cpu text-orange-400 text-sm"></i>
                                    Integrated Graphics / Performance Mode
                                </span>
                            </label>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium pl-7">
                            Disables heavy backdrop-blur filters, complex background glows, and hover particles to optimize rendering for integrated GPUs and low-end hardware.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ThemeModal;
