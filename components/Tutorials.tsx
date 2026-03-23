import React, { useRef, useEffect } from "react";
import { XIcon, PlayIcon } from "./Icons";

interface TutorialsProps {
  onClose: () => void;
  activeSection?: string; // 'roster', 'storyboard', 'timeline', 'footage'
}

const TUTORIAL_VIDEOS = [
  {
    id: "roster",
    title: "Character Roster",
    description: "Learn how to manage your cast.",
    videoSrc: "/tutorials/roster.mp4" // Placeholder
  },
  {
    id: "storyboard",
    title: "Storyboard",
    description: "Create your scenes and shots.",
    videoSrc: "/tutorials/storyboard.mp4" // Placeholder
  },
  {
    id: "timeline",
    title: "Timeline",
    description: "Edit your clips and audio.",
    videoSrc: "/tutorials/timeline.mp4" // Placeholder
  },
  {
    id: "footage",
    title: "Quick Footage",
    description: "Generate quick clips on the fly.",
    videoSrc: "/tutorials/footage.mp4" // Placeholder
  }
];

const Tutorials: React.FC<TutorialsProps> = ({ onClose, activeSection }) => {
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (activeSection && sectionRefs.current[activeSection]) {
      sectionRefs.current[activeSection]?.scrollIntoView({
        behavior: "smooth"
      });
    }
  }, [activeSection]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gray-950/50">
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter italic">
              Studio Tutorials
            </h2>
            <p className="text-xs text-gray-400 font-medium mt-1">
              Master the art of AI filmmaking
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-12 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {TUTORIAL_VIDEOS.map((video) => (
            <div
              key={video.id}
              ref={(el) => (sectionRefs.current[video.id] = el)}
              className={`scroll-mt-24 transition-all duration-500 ${
                activeSection === video.id
                  ? "ring-2 ring-indigo-500/50 rounded-xl p-4 bg-indigo-500/5"
                  : ""
              }`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <PlayIcon className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {video.title}
                  </h3>
                  <p className="text-xs text-gray-400">{video.description}</p>
                </div>
              </div>

              {/* Video Player Placeholder */}
              <div className="aspect-video bg-black rounded-xl border border-white/10 overflow-hidden relative group">
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 group-hover:bg-black/40 transition-colors cursor-pointer">
                  <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                    <PlayIcon className="w-8 h-8 text-white fill-white ml-1" />
                  </div>
                </div>
                {/* In a real implementation, this would be a <video> tag */}
                <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-[10px] font-mono text-white backdrop-blur-sm border border-white/10">
                  Video Placeholder: {video.videoSrc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Tutorials;
