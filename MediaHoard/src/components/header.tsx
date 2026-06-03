"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { IconPickerDialog } from "@/components/ui/icon-picker-dialog";
import { ThemeEditor } from "@/components/theme-editor";
import { SearchModal } from "@/components/search-modal";
import { useProfiles, Profile } from "@/providers/ProfileProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { isDesktopShell } from "@/lib/desktop-player";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { profiles, activeProfile, switchProfile, createProfile, updateProfile, deleteProfile } = useProfiles();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Profile Setup/Edit State
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [setupData, setSetupData] = useState({ name: "", color: "#39E079", icon: "" });
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);
  const [isDesktopApp, setIsDesktopApp] = useState<boolean | null>(null);
  const [canOpenContentHoard, setCanOpenContentHoard] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const desktopItemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [desktopIndicator, setDesktopIndicator] = useState({ x: 0, width: 0, opacity: 0 });

  const playMenuClick = () => {
    if (!theme.isSoundEnabled) return;
    const audio = new Audio("/sounds/menuclick.mp3");
    audio.volume = theme.globalVolume;
    audio.play().catch(() => {});
  };

  const playHover = () => {
    if (!theme.isSoundEnabled) return;
    const audio = new Audio("/sounds/hover.mp3");
    audio.volume = theme.globalVolume * 0.6;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    const desktopCheckFrame = window.requestAnimationFrame(() => {
      setIsDesktopApp(isDesktopShell());
      setCanOpenContentHoard(Boolean(window.mediahoardElectron?.contentHoard?.open));
    });
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(desktopCheckFrame);
      window.removeEventListener("scroll", handleScroll);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 1000);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  const handleMenuEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsOpen(true);
  };

  const tabs = [
    { name: "Browse", path: "/browse", icon: "apps" },
    { name: "Home", path: "/" },
    { name: "Movies", path: "/movies" },
    { name: "TV", path: "/tv" },
  ];

  useEffect(() => {
    const updateDesktopIndicator = () => {
      const nav = desktopNavRef.current;
      const activeItem = desktopItemRefs.current[pathname];

      if (!nav || !activeItem) {
        setDesktopIndicator((current) =>
          current.opacity === 0 ? current : { ...current, opacity: 0 }
        );
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const activeRect = activeItem.getBoundingClientRect();
      const nextIndicator = {
        x: activeRect.left - navRect.left,
        width: activeRect.width,
        opacity: 1,
      };

      setDesktopIndicator((current) => {
        if (
          current.x === nextIndicator.x &&
          current.width === nextIndicator.width &&
          current.opacity === nextIndicator.opacity
        ) {
          return current;
        }

        return nextIndicator;
      });
    };

    const scheduleDesktopIndicatorUpdate = () => {
      window.requestAnimationFrame(updateDesktopIndicator);
    };

    scheduleDesktopIndicatorUpdate();

    window.addEventListener("resize", scheduleDesktopIndicatorUpdate);
    window.addEventListener("scroll", scheduleDesktopIndicatorUpdate, { passive: true });

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleDesktopIndicatorUpdate();
      });

      if (desktopNavRef.current) {
        resizeObserver.observe(desktopNavRef.current);
      }

      Object.values(desktopItemRefs.current).forEach((item) => {
        if (item) {
          resizeObserver?.observe(item);
        }
      });
    }

    return () => {
      window.removeEventListener("resize", scheduleDesktopIndicatorUpdate);
      window.removeEventListener("scroll", scheduleDesktopIndicatorUpdate);
      resizeObserver?.disconnect();
    };
  }, [pathname]);

  const handleCreateOrUpdate = () => {
    if (editingProfile) {
      updateProfile(editingProfile.id, {
        name: setupData.name || "My Profile",
        icon: setupData.icon,
        color: setupData.color
      });
    } else {
      createProfile(setupData.name || "New Profile", setupData.icon, setupData.color);
    }
    setIsSetupOpen(false);
    setEditingProfile(null);
    setSetupData({ name: "", color: "#39E079", icon: "" });
  };

  const openSetup = (p?: Profile) => {
    if (p) {
      setEditingProfile(p);
      setSetupData({ name: p.name, color: p.color || "#39E079", icon: p.icon || "" });
    } else {
      setEditingProfile(null);
      setSetupData({ name: "", color: "#39E079", icon: "" });
    }
    setIsSetupOpen(true);
  };

  if (pathname === "/player") {
    return null;
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-24 flex justify-center px-6">
        <div className="relative flex items-center justify-between w-full max-w-[1440px] h-20 mt-4 px-8">
          
          {/* 1. Header Background Layer */}
          <div 
            className="absolute inset-0 rounded-full border transition-all duration-500 ease-in-out hidden md:block pointer-events-none"
            style={{
              backgroundColor: isScrolled ? `rgba(var(--theme-header-bg-rgb), var(--theme-glass-opacity))` : 'transparent',
              borderColor: isScrolled ? 'rgba(255,255,255,0.1)' : 'transparent',
              backdropFilter: isScrolled ? `blur(var(--theme-glass-blur))` : 'none',
              WebkitBackdropFilter: isScrolled ? `blur(var(--theme-glass-blur))` : 'none',
              opacity: isScrolled ? 1 : 0,
              boxShadow: isScrolled ? '0 10px 30px rgba(0,0,0,0.5)' : 'none'
            }}
          />

          {/* 2. Left Side: Back Button & Logo */}
          <div className="flex items-center gap-4 shrink-0 pointer-events-auto relative z-10">
            {canOpenContentHoard && (
              <button
                type="button"
                className="flex items-center justify-center w-10 h-10 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-xl border border-white/10 transition-all shadow-xl active:scale-90"
                aria-label="Open ContentHoard"
                title="Open ContentHoard"
                onClick={() => window.mediahoardElectron?.contentHoard?.open()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>
              </button>
            )}
            <AnimatePresence mode="wait">
              {pathname.startsWith("/detail/") && (
                <motion.button 
                  key="back-button"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  type="button"
                  onClick={() => { router.back(); playMenuClick(); }} 
                  className="flex items-center justify-center w-10 h-10 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-xl border border-white/10 transition-all shadow-xl active:scale-90"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </motion.button>
              )}
            </AnimatePresence>

            <Link href="/" className="transition-transform hover:scale-105 flex items-center gap-3" onClick={playMenuClick}>
            <div 
              className="flex items-center gap-3 bg-white/10 border border-white/20 px-4 py-2 rounded-2xl shadow-xl md:bg-transparent md:border-0 md:p-0 md:shadow-none [--logo-blur:blur(var(--theme-glass-blur))] md:[--logo-blur:none]"
              style={{
                backdropFilter: 'var(--logo-blur)',
                WebkitBackdropFilter: 'var(--logo-blur)'
              }}
            >
              {theme.logoUrl && <img src={theme.logoUrl} alt="Logo" className="h-8 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />}
              <span 
                className="text-xl font-bold tracking-tighter"
                style={{ 
                  fontFamily: theme.headerFont,
                  color: `var(--theme-text-header)`
                }}
              >
                {theme.headerText}
              </span>
            </div>
            </Link>
          </div>
          
          {/* 3. Center Navigation (RE-STRUCTURED to avoid 'fling' issue) */}
          <div className="absolute inset-0 hidden md:flex items-center justify-center pointer-events-none">
            <nav
              ref={desktopNavRef}
              className="relative flex items-center space-x-1 text-sm rounded-full border border-white/20 px-2 py-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] pointer-events-auto transition-opacity duration-500"
              style={{
                backgroundColor: theme.navBackgroundColor.startsWith("rgba") 
                  ? theme.navBackgroundColor 
                  : `rgba(var(--theme-nav-bg-rgb), var(--theme-glass-opacity))`,
                backdropFilter: `blur(var(--theme-glass-blur))`,
                WebkitBackdropFilter: `blur(var(--theme-glass-blur))`,
                opacity: isScrolled ? 0.9 : 1,
                fontFamily: theme.navFont
              }}
            >
              <motion.div
                aria-hidden="true"
                className="absolute left-0 top-1.5 bottom-1.5 rounded-full"
                style={{ backgroundColor: 'var(--theme-accent)' }}
                animate={{
                  x: desktopIndicator.x,
                  width: desktopIndicator.width,
                  opacity: desktopIndicator.opacity,
                }}
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
              {tabs.map((tab) => {
                const isActive = pathname === tab.path;
                return (
                  <Link 
                    key={tab.name}
                    href={tab.path}
                    onClick={playMenuClick}
                    ref={(element) => {
                      desktopItemRefs.current[tab.path] = element;
                    }}
                    className={`relative rounded-full px-5 py-2 z-10 flex items-center justify-center transition-colors`}
                    style={{ 
                      color: isActive ? theme.navTextColorSelected : theme.navTextColorUnselected,
                      fontWeight: isActive ? 'bold' : 'normal'
                    }}
                  >
                    {tab.icon ? (
                      <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{tab.icon}</span>
                    ) : (
                      tab.name
                    )}
                  </Link>
                );
              })}
              
              <div className="flex items-center ml-2 space-x-1 relative z-10">
                <Link 
                  href="/library"
                  onClick={playMenuClick}
                  ref={(element) => {
                    desktopItemRefs.current["/library"] = element;
                  }}
                  className={`relative rounded-full w-10 h-10 flex items-center justify-center transition-colors`} 
                  style={{ color: pathname === "/library" ? theme.navTextColorSelected : theme.navTextColorUnselected }}
                >
                  <span className="material-symbols-outlined text-[20px]">library_books</span>
                </Link>

                <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
                  <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="flex items-center">
                    <DropdownMenuTrigger 
                      type="button"
                      aria-label="Open navigation menu"
                      onClick={playMenuClick}
                      className="hover:bg-white/5 w-10 h-10 rounded-full flex items-center justify-center focus:outline-none transition-colors"
                      style={{ color: theme.navTextColorUnselected }}
                    >
                      <span className="material-symbols-outlined text-[20px]">menu</span>
                    </DropdownMenuTrigger>
                  </div>
                  <DropdownMenuContent 
                    align="center" 
                    onMouseEnter={handleMenuEnter} 
                    onMouseLeave={handleMouseLeave} 
                    className="w-48 backdrop-blur-xl border-white/10 rounded-lg mt-4 shadow-xl"
                    style={{
                      backgroundColor: theme.dropdownBackgroundColor,
                      color: theme.dropdownTextColor,
                      fontFamily: theme.dropdownFont
                    }}
                  >
                    <DropdownMenuItem 
                      onMouseEnter={playHover}
                      onClick={playMenuClick}
                      className="focus:bg-white/10 rounded-lg p-0"
                    >
                      <Link href="/addons" className="w-full flex items-center gap-3 px-3 py-2">
                        <span className="material-symbols-outlined text-[20px]">extension</span> Addons
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onMouseEnter={playHover}
                      onClick={playMenuClick}
                      className="focus:bg-white/10 rounded-lg p-0"
                    >
                      <Link href="/lists" className="w-full flex items-center gap-3 px-3 py-2">
                        <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span> Lists
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onMouseEnter={playHover}
                      onClick={playMenuClick}
                      className="focus:bg-white/10 rounded-lg p-0"
                    >
                      <Link href="/settings" className="w-full flex items-center gap-3 px-3 py-2">
                        <span className="material-symbols-outlined text-[20px]">settings</span> Settings
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <button 
                type="button"
                aria-label="Open search"
                onClick={() => { setIsSearchOpen(true); playMenuClick(); }}
                className="hover:bg-white/5 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ color: theme.navTextColorUnselected }}
              >
                <span className="material-symbols-outlined text-[20px]">search</span>
              </button>
            </nav>
          </div>

          {/* 4. Right Side: Profile */}
          <div className="flex items-center gap-3 shrink-0 pointer-events-auto relative z-10">
            {!isDesktopApp && (
              <Link
                href="/settings#playback"
                onClick={playMenuClick}
                className="hidden md:inline-flex flex-col items-center justify-center rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-white/15"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">play_circle</span>
                  <span>Select Player</span>
                </span>
                <span className="text-[10px] font-black tracking-[0.08em] text-center">(required)</span>
              </Link>
            )}
            <div className="md:bg-transparent md:backdrop-blur-0 md:border-0 md:p-0 bg-white/10 backdrop-blur-2xl border border-white/20 p-1 rounded-full shadow-xl">
              <DropdownMenu modal={false} open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <DropdownMenuTrigger type="button" aria-label="Open profiles" onClick={playMenuClick} className="w-10 h-10 rounded-full transition-all duration-300 active:scale-95 ease-in-out flex items-center justify-center focus:outline-none cursor-pointer border-none outline-none ring-0 overflow-hidden"
                  style={{ backgroundColor: activeProfile?.color || 'transparent' }}>
                  {activeProfile?.icon ? (
                    activeProfile.icon.includes('://') || activeProfile.icon.startsWith('data:') ? <img src={activeProfile.icon} className="w-full h-full object-cover" alt="" /> : <span className="material-symbols-outlined text-white text-xl">{activeProfile.icon}</span>
                  ) : (
                    <span className="material-symbols-outlined text-white">{activeProfile ? 'person' : 'account_circle'}</span>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-64 backdrop-blur-2xl border-white/10 rounded-[2rem] mt-4 shadow-2xl p-3"
                  style={{
                    backgroundColor: theme.menuBackgroundColor,
                    color: theme.menuTextColor,
                    fontFamily: theme.menuFont
                  }}
                >
                  <div className="px-3 py-2 mb-2"><h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Profiles</h3></div>
                  <div className="space-y-1 mb-3 max-h-60 overflow-y-auto custom-scrollbar">
                    {profiles.map(p => (
                      <div key={p.id} className="flex items-center gap-2 group px-1">
                        <DropdownMenuItem onClick={() => { switchProfile(p.id); playMenuClick(); }} className={`flex-1 flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${activeProfile?.id === p.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: p.color || '#39E079' }}>
                            {p.icon ? (p.icon.includes('://') || p.icon.startsWith('data:') ? <img src={p.icon} alt="" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-[18px] text-white/90">{p.icon}</span>) : <span className="material-symbols-outlined text-[18px] text-white/90">person</span>}
                          </div>
                          <span className="text-sm font-bold truncate">{p.name}</span>
                        </DropdownMenuItem>
                        <button onClick={(e) => { e.stopPropagation(); openSetup(p); setIsProfileOpen(false); playMenuClick(); }} className="p-2 opacity-30 hover:opacity-100 rounded-lg transition-all"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/10 pt-3 space-y-1">
                    <DropdownMenuItem 
                      onClick={() => { setIsThemeEditorOpen(true); setIsProfileOpen(false); playMenuClick(); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 text-white/80 transition-all font-bold"
                    >
                      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">palette</span>
                      </div>
                      Appearance
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { openSetup(); setIsProfileOpen(false); playMenuClick(); }} className="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 text-white/80 transition-all font-bold">
                      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center"><span className="material-symbols-outlined text-[20px]">add</span></div> Add Profile
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation (Bottom) */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 w-[90%] max-w-[400px]">
        <button 
          type="button"
          aria-label="Open search"
          onClick={() => setIsSearchOpen(true)}
          className="w-14 h-14 rounded-full border shadow-lg flex items-center justify-center pointer-events-auto active:scale-90 transition-transform"
          style={{
            backgroundColor: theme.navBackgroundColor.startsWith("rgba") 
              ? theme.navBackgroundColor 
              : `rgba(var(--theme-nav-bg-rgb), var(--theme-glass-opacity))`,
            borderColor: 'rgba(255,255,255,0.2)',
            backdropFilter: `blur(var(--theme-glass-blur))`,
            WebkitBackdropFilter: `blur(var(--theme-glass-blur))`,
            color: theme.navTextColorUnselected
          }}
        >
          <span className="material-symbols-outlined text-[28px]">search</span>
        </button>

        <nav 
          className="flex items-center rounded-full border shadow-2xl pointer-events-auto w-full h-14 overflow-hidden px-1"
          style={{
            backgroundColor: theme.navBackgroundColor.startsWith("rgba") 
              ? theme.navBackgroundColor 
              : `rgba(var(--theme-nav-bg-rgb), var(--theme-glass-opacity))`,
            borderColor: 'rgba(255,255,255,0.2)',
            backdropFilter: `blur(var(--theme-glass-blur))`,
            WebkitBackdropFilter: `blur(var(--theme-glass-blur))`,
            fontFamily: theme.navFont
          }}
        >
          {tabs.map((tab) => {
            const isActive = pathname === tab.path;
            return (
              <Link 
                key={tab.name} 
                href={tab.path} 
                className="relative h-12 flex-1 flex items-center justify-center transition-colors"
                style={{
                   color: isActive ? theme.navTextColorSelected : theme.navTextColorUnselected,
                   fontWeight: isActive ? 'bold' : 'normal'
                }}
              >
                {isActive && (
                  <motion.div 
                    layoutId="mobile-pill" 
                    className="absolute inset-0 rounded-full -z-10" 
                    style={{ backgroundColor: theme.navTextColorSelected === '#000000' && theme.navBackgroundColor.includes('rgba(255,255,255') ? '#ffffff' : theme.accentColor }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }} 
                  />
                )}
                {tab.icon ? <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{tab.icon}</span> : <span className="text-xs">{tab.name}</span>}
              </Link>
            );
          })}
          <Link 
            href="/library" 
            className="relative h-12 flex-1 flex items-center justify-center transition-colors"
            style={{ color: pathname === "/library" ? theme.navTextColorSelected : theme.navTextColorUnselected }}
          >
            {pathname === "/library" && (
              <motion.div 
                layoutId="mobile-pill" 
                className="absolute inset-0 rounded-full -z-10" 
                style={{ backgroundColor: theme.navTextColorSelected === '#000000' && theme.navBackgroundColor.includes('rgba(255,255,255') ? '#ffffff' : theme.accentColor }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }} 
              />
            )}
            <span className="material-symbols-outlined text-[24px]">library_books</span>
          </Link>
          <div className="flex-1 flex justify-end">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger 
                type="button"
                aria-label="Open navigation menu"
                className="h-12 w-12 flex items-center justify-center focus:outline-none bg-transparent border-none outline-none"
                style={{ color: theme.navTextColorUnselected }}
              >
                <span className="material-symbols-outlined text-[24px]">menu</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                side="top" 
                align="end" 
                className="w-48 backdrop-blur-2xl border-white/10 rounded-2xl mb-4 p-2 shadow-2xl"
                style={{
                  backgroundColor: theme.menuBackgroundColor,
                  color: theme.menuTextColor,
                  fontFamily: theme.menuFont
                }}
              >
                <DropdownMenuItem className="focus:bg-white/10 rounded-xl"><Link href="/addons" className="w-full flex items-center gap-3 px-4 py-3"><span className="material-symbols-outlined text-[22px]">extension</span> Addons</Link></DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-white/10 rounded-xl"><Link href="/lists" className="w-full flex items-center gap-3 px-4 py-3"><span className="material-symbols-outlined text-[22px]">format_list_bulleted</span> Lists</Link></DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-white/10 rounded-xl"><Link href="/settings" className="w-full flex items-center gap-3 px-4 py-3"><span className="material-symbols-outlined text-[22px]">settings</span> Settings</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </div>

      <ProfileModals 
        isSetupOpen={isSetupOpen} setIsSetupOpen={setIsSetupOpen}
        setupData={setupData} setSetupData={setSetupData}
        handleCreateOrUpdate={handleCreateOrUpdate}
        editingProfile={editingProfile} deleteProfile={deleteProfile}
        isIconPickerOpen={isIconPickerOpen} setIsIconPickerOpen={setIsIconPickerOpen}
      />
      <ThemeEditor 
        isOpen={isThemeEditorOpen} 
        onClose={() => setIsThemeEditorOpen(false)} 
      />
      <SearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
    </>
  );
}

type SetupData = {
  name: string;
  color: string;
  icon: string;
};

type IconProps = {
  name: string;
  className?: string;
  style?: CSSProperties;
};

type ProfileModalsProps = {
  isSetupOpen: boolean;
  setIsSetupOpen: Dispatch<SetStateAction<boolean>>;
  setupData: SetupData;
  setSetupData: Dispatch<SetStateAction<SetupData>>;
  handleCreateOrUpdate: () => void;
  editingProfile: Profile | null;
  deleteProfile: (id: string) => void;
  isIconPickerOpen: boolean;
  setIsIconPickerOpen: Dispatch<SetStateAction<boolean>>;
};

const Icon = ({ name, className = "", style = {} }: IconProps) => <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;

function ProfileModals({ isSetupOpen, setIsSetupOpen, setupData, setSetupData, handleCreateOrUpdate, editingProfile, deleteProfile, isIconPickerOpen, setIsIconPickerOpen }: ProfileModalsProps) {
  const { theme } = useTheme();
  return (
    <>
      <AnimatePresence>
        {isSetupOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xl animate-in fade-in duration-300">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="border border-white/10 p-10 rounded-[3rem] max-w-lg w-full shadow-2xl space-y-10"
              style={{
                backgroundColor: theme.menuBackgroundColor,
                color: theme.menuTextColor,
                fontFamily: theme.menuFont
              }}
            >
              <div className="text-center">
                <h2 className="text-4xl font-black">{editingProfile ? 'Edit Profile' : 'New Profile'}</h2>
                <p className="opacity-40 mt-2">Customize your environment.</p>
              </div>
              <div className="flex flex-col items-center gap-8">
                <div className="w-32 h-32 rounded-[2.5rem] border-4 border-white/10 flex items-center justify-center overflow-hidden bg-white/5 relative group shadow-2xl" style={{ backgroundColor: setupData.color }}>
                  {setupData.icon ? (setupData.icon.includes('://') || setupData.icon.startsWith('data:') ? <img src={setupData.icon} alt="" className="w-full h-full object-cover" /> : <Icon name={setupData.icon} className="!text-[64px] text-white" />) : <Icon name="person" className="!text-[64px] text-white/90" />}
                  <button onClick={() => setIsIconPickerOpen(true)} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><Icon name="photo_camera" className="text-white !text-3xl" /></button>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  {['#39E079', '#E03939', '#397EE0', '#E0A339', '#9C39E0', '#39E0DC', '#FFFFFF'].map(c => (
                    <button key={c} onClick={() => setSetupData((prev) => ({ ...prev, color: c }))} className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-125 ${setupData.color === c ? 'border-white scale-125 ring-4 ring-white/20 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.3em] px-1">Profile Name</label>
                <input type="text" value={setupData.name} onChange={(e) => setSetupData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Enter name..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-white/30 focus:bg-white/10 outline-none transition-all text-xl font-bold shadow-inner" autoFocus />
              </div>
              <div className="flex gap-4 pt-4">
                {editingProfile && <button onClick={() => confirm("Delete profile?") && deleteProfile(editingProfile.id) && setIsSetupOpen(false)} className="p-4 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-2xl transition-all border border-red-500/10"><Icon name="delete" className="!text-[24px]" /></button>}
                <button onClick={() => setIsSetupOpen(false)} className="flex-1 py-4 font-bold rounded-2xl bg-white/5 text-white/60 hover:text-white transition-all uppercase tracking-widest text-xs">Cancel</button>
                <button onClick={handleCreateOrUpdate} className="flex-[2] py-4 bg-white text-black font-black rounded-2xl shadow-lg transition-all uppercase tracking-widest text-xs active:scale-95">{editingProfile ? 'Save Changes' : 'Create Profile'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <IconPickerDialog isOpen={isIconPickerOpen} onClose={() => setIsIconPickerOpen(false)} onSelectUpload={(url: string) => setSetupData((prev) => ({ ...prev, icon: url }))} onSelectUrl={(url: string) => setSetupData((prev) => ({ ...prev, icon: url }))} onSelectPreset={(name: string) => setSetupData((prev) => ({ ...prev, icon: name }))} onSelectDefault={() => setSetupData((prev) => ({ ...prev, icon: "" }))} hasExistingIcon={!!setupData.icon} title="Profile Avatar" initialUrl={setupData.icon && (setupData.icon.includes('://') || setupData.icon.startsWith('data:')) ? setupData.icon : ""} presets={['face', 'face_6', 'face_5', 'face_3', 'face_4', 'face_2', 'child_care', 'comedy_mask', 'family_restroom', 'groups', 'person', 'pets', 'emoticon', 'rocket_launch', 'celebration']} />
    </>
  );
}
