import React, { useState, useEffect, useRef } from "react";
import {
  UserPlusIcon,
  BookOpenIcon,
  HistoryIcon,
  SparklesIcon,
  VideoIcon,
  TimelineIcon,
  ChevronDownIcon,
  Logo,
  CreditCardIcon,
  PlusIcon,
  XIcon,
  FilmIcon,
  ClapperboardIcon
} from "./Icons";
import {
  HELLO_EMAIL,
  AFRICAN_COUNTRIES,
  WORLD_COUNTRIES
} from "../utils/constants";

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  visualStyle: string;
  setVisualStyle: (val: string) => void;
  aspectRatio: string;
  setAspectRatio: (val: string) => void;
  characterStyle: string;
  setCharacterStyle: (val: string) => void;
  selectedCountry: string;
  setSelectedCountry: (val: string) => void;
  onLogout: () => void;
  creditBalance: number;
  session?: any;
  onClose?: () => void;
}

export const VIEW_COLORS: Record<string, string> = {
  roster: "#a855f7",
  storybook: "#10b981",
  storyboard: "#f59e0b",
  timeline: "#6366f1",
  footage: "#06b6d4",
  history: "#94a3b8",
  "buy-credits": "#eab308",
  "directors-cut": "#ef4444"
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  visualStyle,
  setVisualStyle,
  aspectRatio,
  setAspectRatio,
  characterStyle,
  setCharacterStyle,
  selectedCountry,
  setSelectedCountry,
  onLogout,
  creditBalance,
  session,
  onClose
}) => {
  const windowWidth = window.innerWidth;
  // UPDATED BREAKPOINTS: 500px and below is Phone. 501px-1023px is Standing Tablet. 1024px+ is Desktop/Rotating.
  const isPhone = windowWidth <= 500;
  const isTablet = windowWidth >= 501 && windowWidth < 1024;

  const [showDirectivesDropdown, setShowDirectivesDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // CLICK-AWAY PROTOCOL: Ensures the master directives menu closes when focus is lost.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDirectivesDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const countries =
    characterStyle === "Afro-toon" ? AFRICAN_COUNTRIES : WORLD_COUNTRIES;

  const handleNavClick = (view: string) => {
    setActiveView(view);
    if (isPhone) setShowDirectivesDropdown(false);
  };

  const handleContextChange = (style: string) => {
    setCharacterStyle(style);
    setSelectedCountry(style === "Afro-toon" ? "Nigeria" : "USA");
  };

  const containerClasses = isPhone
    ? "w-full h-full bg-[#0a0f1d] flex flex-col z-[100] animate-in slide-in-from-bottom duration-300"
    : isTablet
      ? "w-[80px] h-full bg-[#0a0f1d] border-r border-white/5 flex flex-col items-center py-6 gap-6 shrink-0 transition-all duration-300"
      : "w-[350px] h-full bg-[#0a0f1d] border-r border-white/5 flex flex-col shrink-0 overflow-hidden";

  // MASTER DIRECTIVES TRIGGER: The 'three dots' that carry Visual + Context settings.
  const DotsTrigger = () => (
    <button
      onClick={() => setShowDirectivesDropdown(!showDirectivesDropdown)}
      className="flex gap-1.5 py-1.5 px-3 rounded-full hover:bg-white/10 transition-all group border border-white/5 bg-white/5"
      title="Production Directives"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] group-hover:scale-125 transition-transform"></div>
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] group-hover:scale-125 transition-transform delay-75"></div>
      <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)] group-hover:scale-125 transition-transform delay-150"></div>
    </button>
  );

  // UNIFIED DIRECTIVES MENU: Carries both Visual and Context directives as requested.
  const DirectivesDropdown = ({
    positionClasses
  }: {
    positionClasses: string;
  }) => (
    <div
      ref={dropdownRef}
      className={`${positionClasses} w-72 bg-[#111827] border border-indigo-500/30 rounded-[1.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.7)] p-5 animate-in zoom-in-95 slide-in-from-top-4 duration-300 z-[200]`}
    >
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-3 ml-1">
            Visual Directives
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block ml-1">
                Style
              </label>
              <div className="relative">
                <select
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-gray-200 outline-none appearance-none"
                >
                  <option>3D Render</option>
                  <option>Realistic</option>
                  <option>Illustrator</option>
                  <option>Anime</option>
                </select>
                <ChevronDownIcon className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block ml-1">
                Aspect
              </label>
              <div className="relative">
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-gray-200 outline-none appearance-none"
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                </select>
                <ChevronDownIcon className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/5"></div>

        <div>
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block mb-3 ml-1">
            Production Context
          </span>
          <div className="space-y-3">
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => handleContextChange("Afro-toon")}
                className={`flex-1 py-1.5 text-[9px] font-black transition-all uppercase rounded-lg ${characterStyle === "Afro-toon" ? "bg-indigo-600 text-white" : "text-gray-500"}`}
              >
                Afro
              </button>
              <button
                onClick={() => handleContextChange("General")}
                className={`flex-1 py-1.5 text-[9px] font-black transition-all uppercase rounded-lg ${characterStyle === "General" ? "bg-indigo-600 text-white" : "text-gray-500"}`}
              >
                Global
              </button>
            </div>
            <div className="relative">
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-bold text-gray-200 outline-none appearance-none cursor-pointer"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="w-3.5 h-3.5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // NAVIGATION LIST: Simplified per user request.
  const navItems = [
    {
      id: "roster",
      icon: <UserPlusIcon className="w-5 h-5" />,
      label: "Character roster"
    },
    {
      id: "storybook",
      icon: <BookOpenIcon className="w-5 h-5" />,
      label: "Story writer"
    },
    {
      id: "storyboard",
      icon: <VideoIcon className="w-5 h-5" />,
      label: "Production stage"
    },
    {
      id: "footage",
      icon: <FilmIcon className="w-5 h-5" />,
      label: "Quick footage desk"
    },
    {
      id: "timeline",
      icon: <TimelineIcon className="w-5 h-5" />,
      label: "Story timeline"
    },
    {
      id: "history",
      icon: <HistoryIcon className="w-5 h-5" />,
      label: "Production history"
    },
    {
      id: "buy-credits",
      icon: <CreditCardIcon className="w-5 h-5" />,
      label: "Get credits"
    }
  ];

  if (isPhone) {
    return (
      <div className={containerClasses}>
        <div className="p-8 flex items-center justify-between border-b border-white/5 bg-[#0a0f1d] sticky top-0 z-[110]">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-indigo-600/10 border border-indigo-500/20 rounded-full flex items-center justify-center p-2 mb-1">
                <Logo className="w-full h-full" />
              </div>
              <DotsTrigger />
            </div>
            <h1 className="text-xl font-black italic tracking-tighter ml-1">
              Thetori Ai
            </h1>
          </div>

          {showDirectivesDropdown && (
            <DirectivesDropdown positionClasses="absolute top-[90px] left-8" />
          )}

          <div className="bg-indigo-600/20 px-3 py-1.5 rounded-xl border border-indigo-500/30 flex items-center gap-2">
            <CreditCardIcon className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-300">
              {creditBalance}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {navItems.map((item) => (
            <div key={item.id} className="relative">
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className="w-full flex items-center gap-6 p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-400 active:bg-indigo-600 active:text-white transition-all"
            >
              <span
                style={{
                  color: activeView === item.id ? "#fff" : VIEW_COLORS[item.id]
                }}
              >
                {item.icon}
              </span>
              <span className="text-[12px] font-black uppercase tracking-[0.2em]">
                {item.label}
              </span>
            </button>
             {item.id === "timeline" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavClick("directors-cut");
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform z-20 border border-red-500"
                >
                  <ClapperboardIcon className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="p-8 border-t border-white/5 flex flex-col gap-4 bg-[#0a0f1d]">
          <button
            onClick={onLogout}
            className="w-full py-4 rounded-2xl bg-red-900/10 text-red-400 font-black uppercase tracking-widest text-[10px] border border-red-900/20"
          >
            Sign Out Session
          </button>
          <p className="text-[8px] font-black text-gray-600 text-center uppercase tracking-[0.3em]">
            v2.5.3 Production Terminal
          </p>
        </div>
      </div>
    );
  }

  if (isTablet) {
    return (
      <aside className={containerClasses}>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 rounded-xl flex items-center justify-center p-2 mb-2">
            <Logo className="w-full h-full" />
          </div>
          <DotsTrigger />
          {showDirectivesDropdown && (
            <DirectivesDropdown positionClasses="absolute top-24 left-[90px]" />
          )}
        </div>

        <nav className="flex flex-col gap-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${activeView === item.id ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:bg-white/5 hover:text-gray-300"}`}
            >
              <span
                style={{
                  color: activeView === item.id ? "#fff" : VIEW_COLORS[item.id]
                }}
              >
                {item.icon}
              </span>
            </button>
          ))}
        </nav>
        <div className="mt-auto pb-4 flex flex-col gap-4 items-center">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex flex-col items-center justify-center text-[8px] font-black text-indigo-400 uppercase">
            {creditBalance}
          </div>
          <button
            onClick={onLogout}
            className="p-3 text-gray-500 hover:text-red-400 transition-colors"
            title="Sign Out"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={containerClasses}>
      <div className="flex flex-col p-8 items-stretch gap-6 pt-10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-600/10 border border-indigo-500/20 rounded-full flex items-center justify-center p-2 shadow-lg">
                <Logo className="w-full h-full" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tighter italic">
                Thetori Ai
              </h1>
            </div>
            {/* COMPUTER/DESKTOP TRIGGER: Dots carry all visual directives and contexts. */}
            <div className="ml-2 relative">
              <DotsTrigger />
              {showDirectivesDropdown && (
                <DirectivesDropdown positionClasses="absolute top-10 left-0" />
              )}
            </div>
          </div>
          <div className="bg-indigo-600/20 px-3 py-1.5 rounded-xl border border-indigo-500/30 flex items-center gap-2 h-max">
            <CreditCardIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-300 tracking-widest">
              {creditBalance.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 px-8 pb-8 overflow-hidden">
        <nav className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-y-auto pr-1 scrollbar-none">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              style={
                {
                  "--glow-color": VIEW_COLORS[item.id] || "#6366f1"
                } as React.CSSProperties
              }
              className={`sidebar-glow-btn w-full flex items-center gap-4 px-4 py-3.5 transition-all border-2 border-transparent rounded-xl ${activeView === item.id ? "active" : "text-gray-400 hover:bg-white/[0.03] hover:text-gray-200"}`}
            >
              <span
                className={`transition-colors duration-300 ${activeView === item.id ? "text-white" : ""}`}
                style={{
                  color: activeView === item.id ? "#fff" : VIEW_COLORS[item.id]
                }}
              >
                {item.icon}
              </span>
              <span className="text-[11px] font-black tracking-[0.15em] uppercase truncate">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5 flex flex-col items-center gap-3 shrink-0">
          <button
            onClick={onLogout}
            className="w-full py-3 bg-red-900/10 hover:bg-red-900/20 text-red-400 border border-red-900/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
          >
            Sign Out Session
          </button>
          <p className="text-[7px] font-black text-center text-gray-500 tracking-[0.15em] italic">
            Contact: {HELLO_EMAIL}
          </p>
          <p className="text-[8px] font-black text-center text-gray-700 tracking-[0.4em] uppercase">
            Thetori Ai Engine v2.5.3
          </p>
        </div>
      </div>
    </aside>
  );
};
