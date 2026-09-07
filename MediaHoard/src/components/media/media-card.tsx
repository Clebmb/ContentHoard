"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export interface MediaItem {
  id: string;
  type: string;
  name: string;
  poster?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
}

import Link from "next/link";
import { useTheme } from "@/providers/ThemeProvider";

export function MediaCard({ item }: { item: MediaItem }) {
  const { theme } = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Motion values for tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for the tilt
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  // Transform springs to degrees
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);

  // Shine position based on mouse
  const shineX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const shineY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseEnter = () => {
    if (theme.isSoundEnabled) {
      const hoverAudio = new Audio("/sounds/hover.mp3");
      hoverAudio.volume = theme.globalVolume * 0.8;
      hoverAudio.play().catch(() => {});
    }
  };

  const handleClick = () => {
    if (theme.isSoundEnabled) {
      const clickAudio = new Audio("/sounds/click.mp3");
      clickAudio.volume = theme.globalVolume;
      clickAudio.play().catch(() => {});
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <Link 
      href={`/detail/${item.type}/${encodeURIComponent(item.id)}`} 
      className="block w-fit p-10 -m-10"
      onClick={handleClick}
    >
      <motion.div
        ref={cardRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="group relative flex flex-col w-[160px] md:w-[200px] shrink-0 cursor-pointer overflow-visible perspective-1000"
      >
        <div 
          className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-container-low border border-white/10 group-hover:border-white/60 transition-all duration-500"
          style={{ 
            transform: "translateZ(50px)",
            boxShadow: `0 0 calc(30px * var(--theme-glow-intensity)) var(--theme-card-glow)`
          }}
        >
          {item.poster ? (
            <img
              src={item.poster}
              alt={item.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-variant">
              <span className="material-symbols-outlined text-4xl text-white/20">movie</span>
            </div>
          )}
          
          {/* Shine/Glint Effect */}
          <motion.div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${shineX} ${shineY}, rgba(255,255,255,0.15) 0%, transparent 80%)`,
            }}
          />

          {/* Rating badge */}
          {item.imdbRating && (
            <div className="absolute top-2 right-2 z-20 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 border border-white/10 shadow-lg">
              <span className="material-symbols-outlined text-[10px] text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              {item.imdbRating}
            </div>
          )}

          {/* Glossy gradient at the bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
        </div>

        <div className="mt-3 px-1 transition-transform duration-500 group-hover:translate-y-1">
          <ScrollingTitle 
            text={item.name}
            className="text-body-md font-bold text-white/90 group-hover:text-white transition-colors"
            style={{ fontFamily: 'var(--theme-font-title)' }}
          />
          <p className="text-label-sm text-white/40 truncate mt-0.5">
            {item.releaseInfo || item.type}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}

function ScrollingTitle({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [scrollAmount, setScrollAmount] = useState(0);

  const checkOverflow = () => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const textWidth = textRef.current.scrollWidth;
      if (textWidth > containerWidth) {
        setScrollAmount(textWidth - containerWidth + 10);
        setShouldScroll(true);
      } else {
        setShouldScroll(false);
      }
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="overflow-hidden whitespace-nowrap"
      onMouseEnter={checkOverflow}
    >
      <motion.h3
        ref={textRef}
        animate={shouldScroll ? { x: [0, -scrollAmount, 0] } : { x: 0 }}
        transition={{ 
          duration: scrollAmount > 0 ? (scrollAmount / 30) * 2 : 0, 
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 1.5
        }}
        className={className}
        style={style}
      >
        {text}
      </motion.h3>
    </div>
  );
}
