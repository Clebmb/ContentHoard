"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const Icon = ({ name, className = "", style = {} }: { name: string; className?: string; style?: React.CSSProperties }) => (
    <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
);

interface IconPickerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectUpload: (dataUrl: string) => void;
    onSelectUrl: (url: string) => void;
    onSelectDefault: () => void;
    onSelectPreset: (iconName: string) => void;
    hasExistingIcon: boolean;
    title?: string;
    initialUrl?: string;
    presets?: string[];
}

export function IconPickerDialog({
    isOpen,
    onClose,
    onSelectUpload,
    onSelectUrl,
    onSelectDefault,
    onSelectPreset,
    hasExistingIcon,
    title = "Select Icon",
    initialUrl = "",
    presets = []
}: IconPickerDialogProps) {
    const [url, setUrl] = useState(initialUrl);

    useEffect(() => {
        if (isOpen) setUrl(initialUrl || "");
    }, [isOpen, initialUrl]);

    if (!isOpen) return null;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
                onSelectUpload(re.target?.result as string);
                onClose();
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xl animate-in fade-in duration-300">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface-container-high/90 border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl space-y-6 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center shrink-0">
                    <h3 className="text-xl font-black text-white mb-1 tracking-tight">{title}</h3>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Source selection</p>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                    {presets.length > 0 && (
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                            <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Built-in Icons</div>
                            <div className="grid grid-cols-5 gap-2">
                                {presets.map(icon => (
                                    <button 
                                        key={icon} 
                                        onClick={() => { onSelectPreset(icon); onClose(); }}
                                        className="aspect-square bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition-all hover:scale-110 active:scale-95"
                                        title={icon}
                                    >
                                        <Icon name={icon} className="!text-[24px]" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                        <label className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all group">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                <Icon name="upload" />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-white">Upload from Device</div>
                                <div className="text-[9px] text-white/30 uppercase tracking-widest font-black">Local file</div>
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </label>

                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                                    <Icon name="link" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-white">Direct Image URL</div>
                                    <div className="text-[9px] text-white/30 uppercase tracking-widest font-black">Remote link</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={url} 
                                    onChange={(e) => setUrl(e.target.value)} 
                                    placeholder="https://..." 
                                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs focus:border-white/30 outline-none text-white transition-all shadow-inner" 
                                />
                                <button 
                                    onClick={() => { if (url.trim()) { onSelectUrl(url.trim()); onClose(); } }} 
                                    className="px-4 bg-white text-black font-black rounded-xl text-xs hover:scale-105 transition-all active:scale-95"
                                >
                                    Set
                                </button>
                            </div>
                        </div>

                        {hasExistingIcon && (
                            <button 
                                onClick={() => { onSelectDefault(); setUrl(""); onClose(); }} 
                                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-red-500/20 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:scale-110 group-hover:text-red-400 transition-all">
                                    <Icon name="close" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-bold text-white group-hover:text-red-400">Use Default</div>
                                    <div className="text-[9px] text-white/30 uppercase tracking-widest font-black">Clear custom icon</div>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
                
                <button 
                    onClick={onClose} 
                    className="w-full py-4 text-[10px] font-black text-white/40 hover:text-white uppercase tracking-[0.3em] transition-all shrink-0"
                >
                    Close
                </button>
            </motion.div>
        </div>
    );
}
