import React from "react";
import {
  UserPlusIcon,
  BookOpenIcon,
  VideoIcon,
  TimelineIcon,
  SparklesIcon,
  CheckIcon,
  XIcon
} from "./Icons";

interface StudioHubProps {
  onNavigate: (view: string) => void;
}

export const StudioHub: React.FC<StudioHubProps> = ({ onNavigate }) => {
  const cards = [
    {
      id: "roster",
      title: "1️⃣ Roster — Character Engine",
      description:
        "Create a persistent AI character with defined physical traits, clothing, age, identity, and style. Your character stays visually consistent throughout your entire project.",
      icon: <UserPlusIcon className="w-6 h-6 text-purple-400" />,
      color: "bg-purple-500/10 border-purple-500/20 hover:border-purple-500",
      textColor: "text-purple-400"
    },
    {
      id: "storybook",
      title: "2️⃣ Storybook — Story Creation",
      description:
        "Choose your mode: Blueprint (AI generates structured story concepts) or Draft (Write your own). Each scene includes visual directives, narrative, dialogue, and audio options.",
      icon: <BookOpenIcon className="w-6 h-6 text-emerald-400" />,
      color: "bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500",
      textColor: "text-emerald-400"
    },
    {
      id: "storyboard",
      title: "3️⃣ Storyboard — Visual & Motion",
      description:
        "Generate images from scenes, change camera angles, add motion, create video (Fast or HD), and generate B-roll with Quick Footage.",
      icon: <VideoIcon className="w-6 h-6 text-amber-400" />,
      color: "bg-amber-500/10 border-amber-500/20 hover:border-amber-500",
      textColor: "text-amber-400"
    },
    {
      id: "timeline",
      title: "4️⃣ Timeline — Final Production",
      description:
        "Combine video, images, audio, and text. Edit like a video editor, screenshot final frames, regenerate scenes, and use DirectCut to record reaction videos live.",
      icon: <TimelineIcon className="w-6 h-6 text-indigo-400" />,
      color: "bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500",
      textColor: "text-indigo-400"
    }
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 md:p-12 scrollbar-thin scrollbar-thumb-gray-800">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* HEADER */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white">
            Studio <span className="text-indigo-500">Command</span> Center
          </h1>
          <p className="text-xs md:text-sm font-bold text-gray-400 tracking-widest uppercase">
            Select a module to begin production
          </p>
        </div>

        {/* MAIN CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card, idx) => (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className={`group relative p-8 rounded-3xl border text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${card.color} animate-in fade-in slide-in-from-bottom-8`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="absolute top-6 right-6 opacity-50 group-hover:opacity-100 transition-opacity">
                {card.icon}
              </div>
              <h3
                className={`text-xl font-black italic tracking-tight mb-4 ${card.textColor}`}
              >
                {card.title}
              </h3>
              <p className="text-sm font-medium text-gray-400 leading-relaxed">
                {card.description}
              </p>
            </button>
          ))}
        </div>

        {/* DIFFERENTIATOR SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-white/5 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
          {/* PROBLEM STATEMENT */}
          <div className="bg-red-900/5 border border-red-500/10 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <XIcon className="w-5 h-5 text-red-400" />
              </div>
              <h4 className="text-sm font-black text-red-400 tracking-widest uppercase">
                Standard AI Video Platforms
              </h4>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-gray-400 text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                Subscription heavy & expensive
              </li>
              <li className="flex items-center gap-3 text-gray-400 text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                Fragmented workflows (jump between apps)
              </li>
              <li className="flex items-center gap-3 text-gray-400 text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                Built for enterprise studios, not individuals
              </li>
            </ul>
          </div>

          {/* SOLUTION STATEMENT */}
          <div className="bg-indigo-900/5 border border-indigo-500/10 rounded-3xl p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <SparklesIcon className="w-5 h-5 text-indigo-400" />
              </div>
              <h4 className="text-sm font-black text-indigo-400 tracking-widest uppercase">
                Why Thetori AI is Different
              </h4>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-gray-300 text-sm font-bold">
                <CheckIcon className="w-4 h-4 text-indigo-500" />
                Built for underserved creators
              </li>
              <li className="flex items-center gap-3 text-gray-300 text-sm font-bold">
                <CheckIcon className="w-4 h-4 text-indigo-500" />
                Freemium access model
              </li>
              <li className="flex items-center gap-3 text-gray-300 text-sm font-bold">
                <CheckIcon className="w-4 h-4 text-indigo-500" />
                Unified workflow (All-in-One)
              </li>
              <li className="flex items-center gap-3 text-gray-300 text-sm font-bold">
                <CheckIcon className="w-4 h-4 text-indigo-500" />
                True Character Continuity
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
