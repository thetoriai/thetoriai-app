import React from "react";
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
  FilmIcon
} from "./Icons";

const AFRICAN_COUNTRIES = [
  "Nigeria",
  "Ghana",
  "Kenya",
  "Ethiopia",
  "South Africa",
  "Tanzania",
  "Uganda",
  "Senegal",
  "Ivory Coast",
  "Cameroon",
  "Rwanda",
  "Zambia",
  "Zimbabwe",
  "Morocco",
  "Egypt"
];
const WORLD_COUNTRIES = [
  "USA",
  "UK",
  "France",
  "Germany",
  "Japan",
  "China",
  "India",
  "Brazil",
  "Canada",
  "Australia",
  "Mexico",
  "Italy",
  "Spain",
  "South Korea"
];

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
}

// COLOR MAPPING FOR ARTLINE SYSTEM
export const VIEW_COLORS: Record<string, string> = {
  roster: "#a855f7", // Purple
  storybook: "#10b981", // Emerald
  storyboard: "#f59e0b", // Amber
  timeline: "#6366f1", // Indigo
  footage: "#06b6d4", // Cyan
  history: "#94a3b8", // Slate
  "buy-credits": "#eab308" // Gold
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
  session
}) => {
  const isWelcome = activeView === "welcome";
  const isMobile = window.innerWidth < 768;
  const countries =
    characterStyle === "Afro-toon" ? AFRICAN_COUNTRIES : WORLD_COUNTRIES;

  const handleNavClick = (view: string) => {
    setActiveView(view);
  };

  const handleContextChange = (style: string) => {
    setCharacterStyle(style);
    if (style === "Afro-toon") {
      setSelectedCountry("Nigeria");
    } else {
      setSelectedCountry("USA");
    }
  };

  return (
    <aside
      className={`
                h-full bg-[#0a0f1d] border-r border-white/5 flex flex-col transition-all duration-500 ease-in-out z-50 shrink-0
                ${isWelcome && isMobile ? "w-[72px]" : "w-full md:w-[350px]"}
                overflow-hidden
            `}
    >
      <div
        className={`flex flex-col p-4 ${isWelcome && isMobile ? "px-0 items-center gap-6" : "px-8 items-stretch gap-6 pt-8"}`}
      >
        <div
          className={`flex items-center justify-between ${isWelcome && isMobile ? "flex-col gap-4" : ""}`}
        >
          <div
            className={`flex items-center gap-4 ${isWelcome && isMobile ? "flex-col pt-2" : ""}`}
          >
            <div className="w-10 h-10 bg-indigo-600/10 border border-indigo-500/20 rounded-full overflow-hidden flex items-center justify-center p-2 shadow-lg">
              <Logo className={`transition-all duration-300 w-full h-full`} />
            </div>
            {(!isWelcome || !isMobile) && (
              <h1 className="text-2xl font-black text-white tracking-tighter italic animate-in fade-in duration-500 text-shadow-sm">
                Thetori Ai
              </h1>
            )}
          </div>

          {(!isWelcome || !isMobile) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView("buy-credits")}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 shadow-inner hover:bg-indigo-600/40 transition-all group rounded-xl"
              >
                <CreditCardIcon className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black text-indigo-300 tracking-widest">
                  {creditBalance.toLocaleString()}
                </span>
              </button>
              <button
                onClick={onLogout}
                className="p-2 text-gray-500 hover:text-white transition-all hover:bg-white/5 rounded-xl"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {(!isWelcome || !isMobile) && (
        <div className="flex flex-col flex-1 px-8 pb-8 overflow-hidden">
          <div className="sidebar-box p-5 mb-4 shrink-0 !rounded-2xl">
            <span className="sidebar-label mb-4 text-[10px] font-black tracking-[0.2em] text-white opacity-90 uppercase">
              Visual directives
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 tracking-widest block ml-1 uppercase">
                  Style
                </label>
                <div className="relative">
                  <select
                    value={visualStyle}
                    onChange={(e) => setVisualStyle(e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-gray-200 outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors"
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
                <label className="text-[9px] font-black text-gray-400 tracking-widest block ml-1 uppercase">
                  Aspect
                </label>
                <div className="relative">
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-gray-200 outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors"
                  >
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                  </select>
                  <ChevronDownIcon className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="sidebar-box p-5 mb-6 shrink-0 !rounded-2xl">
            <span className="sidebar-label mb-4 text-[10px] font-black tracking-[0.2em] text-white opacity-90 uppercase">
              Production context
            </span>
            <div className="space-y-3">
              <div className="flex bg-gray-900 p-1 border border-white/10 rounded-xl shadow-inner">
                <button
                  onClick={() => handleContextChange("Afro-toon")}
                  className={`flex-1 py-2 text-[10px] font-black transition-all uppercase rounded-lg ${characterStyle === "Afro-toon" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-gray-200"}`}
                >
                  Afro
                </button>
                <button
                  onClick={() => handleContextChange("General")}
                  className={`flex-1 py-2 text-[10px] font-black transition-all uppercase rounded-lg ${characterStyle === "General" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-gray-200"}`}
                >
                  Global
                </button>
              </div>
              <div className="relative">
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-bold text-gray-200 outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors shadow-sm"
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

          <nav className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-y-auto pr-1 scrollbar-none">
            {[
              {
                id: "roster",
                icon: <UserPlusIcon className="w-4 h-4" />,
                label: "Character roster"
              },
              {
                id: "storybook",
                icon: <BookOpenIcon className="w-4 h-4" />,
                label: "Storywriter section"
              },
              {
                id: "storyboard",
                icon: <VideoIcon className="w-4 h-4" />,
                label: "Production stage"
              },
              {
                id: "timeline",
                icon: <TimelineIcon className="w-4 h-4" />,
                label: "Story timeline"
              },
              {
                id: "footage",
                icon: <FilmIcon className="w-4 h-4" />,
                label: "Quick Footage Desk"
              },
              {
                id: "history",
                icon: <HistoryIcon className="w-4 h-4" />,
                label: "Production history"
              },
              {
                id: "buy-credits",
                icon: <CreditCardIcon className="w-4 h-4" />,
                label: "Get credits"
              }
            ].map((item) => (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => handleNavClick(item.id)}
                  style={
                    {
                      "--glow-color": VIEW_COLORS[item.id] || "#6366f1"
                    } as React.CSSProperties
                  }
                  className={`sidebar-glow-btn w-full flex items-center gap-4 px-4 py-3.5 transition-all border-2 border-transparent rounded-xl ${activeView === item.id ? "active" : "text-gray-400 hover:bg-white/[0.03] hover:text-gray-200"}`}
                >
                  <span
                    className={`transition-colors duration-300 ${activeView === item.id ? "text-white" : "text-gray-500"}`}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[11px] font-black tracking-[0.15em] uppercase truncate">
                    {item.label}
                  </span>
                </button>
              </div>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/5 opacity-40 shrink-0">
            <p className="text-[8px] font-black text-center text-gray-500 tracking-[0.4em] uppercase">
              Thetori Ai Engine v2.5.3
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};
