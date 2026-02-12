import React, { useState, useRef, useEffect } from "react";
import {
  XIcon,
  BookOpenIcon,
  SparklesIcon,
  LoaderIcon,
  CheckIcon,
  RefreshIcon,
  PlayIcon,
  TrashIcon,
  LockClosedIcon,
  LockOpenIcon,
  MusicalNoteIcon,
  PlusIcon,
  DocumentMagnifyingGlassIcon,
  UserPlusIcon,
  ArrowsRightLeftIcon,
  StopIcon,
  Logo,
  FilmIcon,
  ChevronDownIcon,
  SpeakerWaveIcon,
  DownloadIcon,
  ClipboardIcon,
  ExclamationTriangleIcon
} from "./Icons";
import {
  generateStructuredStory,
  generateScenesFromNarrative,
  regenerateSceneVisual,
  generatePromptFromAudio,
  generateSpeech,
  PREBUILT_VOICES
} from "../services/geminiService";
import type { Character, Storybook, Outfit } from "../services/geminiService";
import { fileToBase64, base64ToBytes, pcmToWavBlob } from "../utils/fileUtils";

interface StorybookCreatorProps {
  storybookContent: Storybook;
  setStorybookContent: (data: Storybook) => void;
  characters: Character[];
  characterStyle: string;
  selectedCountry: string;
  creditBalance: number;
  onClose: () => void;
  onGenerateFromStorybook: (scenes: string[]) => void;
  onGenerateSingleStorybookScene?: (index: number, model: string) => void;
  onSwapOutfit?: (sceneIndex: number, outfit: Outfit) => Promise<void>;
  onAddAudioToTimeline?: (url: string, duration: number) => void;
  onAddAudioClip?: (
    url: string | File,
    duration?: number,
    startTime?: number
  ) => void;
  onDeductAudioCredit?: () => Promise<boolean>;
  onResetStorybook: () => void;
  storySeed: string;
  setStorySeed: (val: string) => void;
}

// DO add comment: CopyButton showing a green success state for clear 'good' feedback.
const CopyButton = ({
  text,
  className = ""
}: {
  text: string;
  className?: string;
}) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-lg transition-all active:scale-90 flex items-center justify-center ${copied ? "bg-green-600 text-white shadow-lg" : "text-gray-500 hover:text-indigo-400 hover:bg-white/5"} ${className}`}
      title="Copy to Clipboard"
    >
      {copied ? (
        <CheckIcon className="w-3.5 h-3.5" />
      ) : (
        <ClipboardIcon className="w-3.5 h-3.5" />
      )}
    </button>
  );
};

export const StorybookCreator: React.FC<StorybookCreatorProps> = ({
  storybookContent,
  setStorybookContent,
  characters,
  characterStyle,
  selectedCountry,
  creditBalance,
  onGenerateFromStorybook,
  onGenerateSingleStorybookScene,
  onAddAudioClip,
  onDeductAudioCredit,
  onResetStorybook,
  storySeed,
  setStorySeed
}) => {
  const [creationMode, setCreationMode] = useState<"ai" | "paste">("ai");
  const [title, setTitle] = useState(storybookContent.title || "");
  const [sharedStoryText, setSharedStoryText] = useState(
    storybookContent.storyNarrative || ""
  );
  const [selectedStoryGenre, setSelectedStoryGenre] =
    useState("Oral Tradition");
  const [selectedMovieStyle, setSelectedMovieStyle] = useState("Nollywood");
  const [includeDialogue, setIncludeDialogue] = useState(
    storybookContent.includeDialogue ?? true
  );
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [confirmingBatch, setConfirmingBatch] = useState(false);
  const [confirmingExecuteIdx, setConfirmingExecuteIdx] = useState<
    number | null
  >(null);
  const [isConfirmingSpeak, setIsConfirmingSpeak] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const speakButtonRef = useRef<HTMLButtonElement>(null);
  const batchButtonRef = useRef<HTMLButtonElement>(null);
  const scenesEndRef = useRef<HTMLDivElement>(null);
  const productionSequenceRef = useRef<HTMLDivElement>(null);

  // DO add comment: Music Video Specific State. Added specialized state to handle song lyrics and production mode.
  const [songLyrics, setSongLyrics] = useState("");
  const isMusicVideoMode = selectedStoryGenre === "Music Video";

  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("Zephyr");
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(
    null
  );
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [shouldScroll, setShouldScroll] = useState(false);

  const [generatingSceneAudioIdx, setGeneratingSceneAudioIdx] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (shouldScroll && storybookContent.scenes.length > 0) {
      setTimeout(() => {
        productionSequenceRef.current?.scrollIntoView({ behavior: "smooth" });
        setShouldScroll(false);
      }, 300);
    }
  }, [storybookContent.scenes.length, shouldScroll]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStorybookContent({
        ...storybookContent,
        title,
        storyNarrative: sharedStoryText,
        includeDialogue
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [title, sharedStoryText, includeDialogue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        isConfirmingSpeak &&
        speakButtonRef.current &&
        !speakButtonRef.current.contains(target)
      )
        setIsConfirmingSpeak(false);
      if (
        confirmingBatch &&
        batchButtonRef.current &&
        !batchButtonRef.current.contains(target)
      )
        setConfirmingBatch(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isConfirmingSpeak, confirmingBatch]);

  const toggleCharacterInCast = (name: string) => {
    const currentChars = [...storybookContent.characters];
    const exists = currentChars.includes(name);
    const newChars = exists
      ? currentChars.filter((n) => n !== name)
      : [...currentChars, name];
    setStorybookContent({ ...storybookContent, characters: newChars });
  };

  const handleStoryTextChange = (val: string) => {
    setSharedStoryText(val);
    if (storybookContent.scenes.length === 0) setStorySeed(val);
  };

  const handleCreateStory = async (forceContinuation: boolean = false) => {
    if (!title.trim()) return;
    setIsGeneratingStory(true);
    try {
      const selectedChars = characters.filter((c) =>
        storybookContent.characters.includes(c.name)
      );
      const inputIdea =
        storySeed && storySeed.trim().length > 5 ? storySeed : sharedStoryText;
      const historyText = forceContinuation
        ? storybookContent.storyNarrative
        : "";
      const res = await generateStructuredStory(
        inputIdea,
        title,
        selectedChars,
        includeDialogue,
        characterStyle,
        selectedStoryGenre,
        selectedMovieStyle,
        "3",
        historyText,
        isMusicVideoMode,
        songLyrics,
        selectedCountry
      );

      const lockedScenes = res.scenes.map((s: any) => ({
        ...s,
        isDescriptionLocked: true,
        isScriptLocked: true
      }));
      if (forceContinuation) {
        const updatedNarrative = `${storybookContent.storyNarrative}\n\n${res.storyNarrative}`;
        setStorybookContent({
          ...storybookContent,
          storyNarrative: updatedNarrative,
          scenes: [...storybookContent.scenes, ...lockedScenes]
        });
        setSharedStoryText(updatedNarrative);
      } else {
        setStorybookContent({
          ...storybookContent,
          title,
          storyNarrative: res.storyNarrative,
          scenes: lockedScenes,
          includeDialogue
        });
        setSharedStoryText(res.storyNarrative);
      }
      setShouldScroll(true);
    } catch (e) {
      setStoryError("Failed to generate story.");
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleProcessPastedStory = async () => {
    if (!title.trim() || !sharedStoryText.trim()) return;
    setIsGeneratingStory(true);
    try {
      const selectedChars = characters.filter((c) =>
        storybookContent.characters.includes(c.name)
      );
     const scenes = await generateScenesFromNarrative(
       sharedStoryText,
       selectedChars,
       includeDialogue,
       characterStyle,
       selectedMovieStyle,
       selectedCountry,
       selectedStoryGenre
     );
      const lockedScenes = scenes.map((s: any) => ({
        ...s,
        isDescriptionLocked: true,
        isScriptLocked: true
      }));
      setStorybookContent({
        ...storybookContent,
        title: title || "New Draft",
        storyNarrative: sharedStoryText,
        scenes: lockedScenes,
        includeDialogue
      });
      setShouldScroll(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleGenerateSpeechMaster = async () => {
    if (!sharedStoryText.trim()) return;
    if (!isConfirmingSpeak && !isGeneratingSpeech) {
      setIsConfirmingSpeak(true);
      return;
    }
    if (onDeductAudioCredit) {
      const success = await onDeductAudioCredit();
      if (!success) {
        setStoryError("Insufficient credits.");
        setIsConfirmingSpeak(false);
        return;
      }
    }
    setIsConfirmingSpeak(false);
    setIsGeneratingSpeech(true);
    try {
      const base64 = await generateSpeech(
        sharedStoryText,
        selectedCountry,
        selectedVoice,
        "Storytelling"
      );
      const bytes = base64ToBytes(base64);
      const blob = pcmToWavBlob(bytes, 24000);
      const url = URL.createObjectURL(blob);
      setStorybookContent({ ...storybookContent, narrativeAudioSrc: url });
      setPreviewAudio(new Audio(url));
    } catch (e) {
      setStoryError("TTS Failed.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleGenerateSceneAudio = async (index: number) => {
    const scene = storybookContent.scenes[index];
    if (!scene.script.trim()) return;
    if (creditBalance < 1) {
      setStoryError("Insufficient credits.");
      return;
    }
    setGeneratingSceneAudioIdx(index);
    try {
      if (onDeductAudioCredit) {
        const success = await onDeductAudioCredit();
        if (!success) {
          setStoryError("Insufficient credits.");
          setGeneratingSceneAudioIdx(null);
          return;
        }
      }
      const base64 = await generateSpeech(
        scene.script,
        selectedCountry,
        selectedVoice,
        "Storytelling"
      );
      const bytes = base64ToBytes(base64);
      const blob = pcmToWavBlob(bytes, 24000);
      const url = URL.createObjectURL(blob);
      const newScenes = [...storybookContent.scenes];
      newScenes[index] = { ...newScenes[index], audioSrc: url };
      setStorybookContent({ ...storybookContent, scenes: newScenes });
    } catch (e) {
      setStoryError("Failed to generate scene audio.");
    } finally {
      setGeneratingSceneAudioIdx(null);
    }
  };

  const handleAddSceneAudioToTimeline = (index: number) => {
    const scene = storybookContent.scenes[index];
    if (scene.audioSrc && onAddAudioClip) {
      onAddAudioClip(scene.audioSrc, 10);
    }
  };

  const togglePreviewAudio = () => {
    if (!previewAudio) return;
    if (isPlayingPreview) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      setIsPlayingPreview(false);
    } else {
      previewAudio.play();
      setIsPlayingPreview(true);
      previewAudio.onended = () => setIsPlayingPreview(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setStoryError(
        "Format Rejection: Please upload an audio file. Videos are not supported for transcription."
      );
      if (audioInputRef.current) audioInputRef.current.value = "";
      return;
    }
    setIsProcessingAudio(true);
    try {
      const base64 = await fileToBase64(file);
      // DO add comment: Linguistic Accuracy Sync. Passing selectedCountry to ensure transcription follows local dialect rules of the chosen country.
      const transcription = await generatePromptFromAudio(
        base64,
        file.type,
        selectedCountry
      );

      // DO add comment: Lyrics Context Redirect. If Music Video mode is active, the transcription is routed to songLyrics box.
      if (isMusicVideoMode) {
        setSongLyrics((prev) => (prev ? prev + "\n" : "") + transcription);
      } else {
      setSharedStoryText(
        (sharedStoryText ? sharedStoryText + "\n" : "") + transcription
      );
      setStorySeed((storySeed ? storySeed + "\n" : "") + transcription);
      }
    } catch {
      setStoryError("Failed to transcribe audio.");
    } finally {
      setIsProcessingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  };

  const handleGenerateScenes = async () => {
    setIsGeneratingScenes(true);
    try {
      const fullChars = characters.filter((c) =>
        storybookContent.characters.includes(c.name)
      );
      // DO add comment: Pass genre so Bible protocol activates correctly.
      const scenes = await generateScenesFromNarrative(
        storybookContent.storyNarrative,
        fullChars,
        storybookContent.includeDialogue || false,
        characterStyle,
        selectedMovieStyle,
        selectedCountry,
        selectedStoryGenre
      );
      const lockedScenes = scenes.map((s: any) => ({
        ...s,
        isDescriptionLocked: true,
        isScriptLocked: true
      }));
      setStorybookContent({ ...storybookContent, scenes: lockedScenes });
      setShouldScroll(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  const handleClearEverything = () => {
    onResetStorybook();
    setTitle("");
    setSharedStoryText("");
    setStorySeed("");
    setSongLyrics("");
    setPreviewAudio(null);
    setIsPlayingPreview(false);
  };

  const handleRegenerateVisual = async (index: number) => {
    try {
      const scene = storybookContent.scenes[index];
      const fullChars = characters.filter((c) =>
        storybookContent.characters.includes(c.name)
      );
      const newDesc = await regenerateSceneVisual(scene.script, fullChars);
      const newScenes = [...storybookContent.scenes];
      newScenes[index] = { ...newScenes[index], imageDescription: newDesc };
      setStorybookContent({ ...storybookContent, scenes: newScenes });
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecuteSingleScene = (index: number) => {
    if (confirmingExecuteIdx !== index) {
      setConfirmingExecuteIdx(index);
      return;
    }
    if (creditBalance < 1) {
      setStoryError("Insufficient credits.");
      setConfirmingExecuteIdx(null);
      return;
    }
    if (onGenerateSingleStorybookScene)
      onGenerateSingleStorybookScene(index, "gemini-2.5-flash-image");
    setConfirmingExecuteIdx(null);
  };

  const handleBatchProduce = () => {
    if (storybookContent.scenes.length === 0) return;
    if (!confirmingBatch) {
      setConfirmingBatch(true);
      return;
    }
    if (creditBalance < storybookContent.scenes.length) {
      setStoryError("Insufficient credits for full sequence production.");
      setConfirmingBatch(false);
      return;
    }
    setConfirmingBatch(false);
    const scenes = storybookContent.scenes.map((s) => s.imageDescription);
    onGenerateFromStorybook(scenes);
  };

  const handleDownloadAudio = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 overflow-y-auto lg:overflow-hidden font-sans scroll-smooth">
      {/* DO add comment: Reduced Header height and Reset Story button size for PC for better layout proportionality. */}
      <div className="hidden lg:flex p-2 border-b border-white/5 justify-between items-center shrink-0 bg-[#0a0f1d] z-50">
        <div className="flex flex-col ml-3">
          <h2 className="text-[10px] font-black text-gray-400 flex items-center gap-2  tracking-[0.2em] ">
            <BookOpenIcon className="w-5 h-5 text-indigo-500" /> Story writer
          </h2>
        </div>
        <div className="flex items-center gap-3 mr-3">
          <button
            onClick={handleClearEverything}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 hover:bg-red-600 border border-red-500/30 text-red-500 hover:text-white rounded-lg text-[9px] font-black  tracking-widest active:scale-95 transition-all shadow-lg"
          >
            <RefreshIcon className="w-3.5 h-3.5" /> Reset Story
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden">
        {/* DO add comment: Increased sidebar width on desktop from 320px to 420px for a more expansive writing area. */}
        <div className="w-full lg:w-[420px] p-4 lg:border-r border-white/5 flex flex-col gap-3 shrink-0 bg-[#0a0f1d]/20 h-auto lg:h-full lg:overflow-y-auto scrollbar-none">
          {/* MOBILE/TABLET HEADER WITH RESET BUTTON */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex-1 flex bg-gray-900 rounded-xl p-1 border border-white/5 themed-artline shrink-0">
              <button
                onClick={() => setCreationMode("ai")}
                className={`flex-1 py-2 text-[20px] font-black rounded-lg transition-all ${creationMode === "ai" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-200"}`}
              >
                Blueprint
              </button>
              <button
                onClick={() => setCreationMode("paste")}
                className={`flex-1 py-2 text-[20px] font-black rounded-lg transition-all ${creationMode === "paste" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500"}`}
              >
                Draft
              </button>
            </div>
            {/* DO add comment: Changed icon to RefreshIcon for Mobile/iPad Reset button. */}
            <button
              onClick={handleClearEverything}
              className="lg:hidden p-2.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-500/30 transition-all active:scale-95 shadow-md flex items-center justify-center"
              title="Reset Story"
            >
              <RefreshIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 px-1 shrink-0">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shrink-0 shadow-[0_0_8px_rgba(220,38,38,0.8)]"></div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Story Title..."
              className="w-full bg-transparent border-none py-1 text-2xl font-black text-white focus:outline-none placeholder-gray-800 tracking-tighter italic"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-1.5 p-2 bg-black/20 rounded-xl border border-white/5 shadow-inner min-h-[60px] shrink-0">
            {characters.length === 0 ? (
              <div className="flex items-center justify-center w-full opacity-20">
                <span className="text-[8px] font-black  tracking-widest text-gray-600">
                  No Actors Selected
                </span>
              </div>
            ) : (
              characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => toggleCharacterInCast(char.name)}
                  className={`flex flex-col items-center transition-all active:scale-95 group`}
                >
                  <div
                    className={`w-10 h-10 rounded-full border-2 overflow-hidden transition-all ${storybookContent.characters.includes(char.name) ? "border-green-500 scale-105 shadow-[0_0_12px_rgba(34,197,94,0.4)]" : "border-gray-800 opacity-40 grayscale group-hover:opacity-100"}`}
                  >
                    {char.imagePreview ? (
                      <img
                        src={char.imagePreview}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900\">
                        <UserPlusIcon className="w-4 h-4 text-gray-700" />
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[7px] font-black  tracking-tighter mt-1 ${storybookContent.characters.includes(char.name) ? "text-green-500" : "text-gray-600"}`}
                  >
                    {char.name.split(" ")[0] || "Actor"}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2 flex-1 min-h-0">
            {/* DO add comment: Music Video Lyrics Section. Conditional rendering of a lyrics input box when Music Video genre is selected. */}
            {isMusicVideoMode && (
              <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                    <MusicalNoteIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <label className="text-[12px] font-black text-indigo-400 tracking-[0.2em] uppercase">
                      Song Lyrics
                    </label>
                  </div>
                  {/* DO add comment: Voice Context in Lyrics. Moved button here for Music Video mode. */}
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="flex items-center gap-2 px-2.5 py-1 bg-indigo-900/20 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-300 hover:text-white rounded-lg text-[8px] font-black transition-all shadow-sm"
                  >
                    {isProcessingAudio ? (
                      <LoaderIcon className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <MusicalNoteIcon className="w-2.5 h-2.5" />
                    )}{" "}
                    {isProcessingAudio ? "Analysing..." : "Voice Context"}
                  </button>
                </div>
                <textarea
                  value={songLyrics}
                  onChange={(e) => setSongLyrics(e.target.value)}
                  placeholder="Paste your song lyrics here to synchronize visuals..."
                  className="w-full h-64 bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-4 text-[13px] font-bold text-white resize-none outline-none focus:border-indigo-400 transition-all placeholder-gray-700 shadow-inner scrollbar-none"
                />
              </div>
            )}

            <div className="flex justify-between items-center px-1 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]"></div>
                <label className="text-[18px] font-black text-gray-600 tracking-[0.2em] ">
                  {isMusicVideoMode ? "Visualizer Concept" : "Concept"}
                </label>
                <CopyButton text={sharedStoryText} />
              </div>

              {/* DO add comment: Conditional Render. Voice Context only appears here when NOT in Music Video mode. */}
              {!isMusicVideoMode && (
              <button
                onClick={() => audioInputRef.current?.click()}
                className="flex items-center gap-2 px-2.5 py-1 bg-indigo-900/20 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-300 hover:text-white rounded-lg text-[8px] font-black transition-all shadow-sm"
              >
                {isProcessingAudio ? (
                  <LoaderIcon className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <MusicalNoteIcon className="w-2.5 h-2.5" />
                )}{" "}
                {isProcessingAudio ? "Analysing..." : "Voice Context"}
              </button>
              )}
              <input
                type="file"
                ref={audioInputRef}
                className="hidden"
                accept="audio/*"
                onChange={handleAudioUpload}
              />
            </div>
            <textarea
              value={sharedStoryText}
              onChange={(e) => handleStoryTextChange(e.target.value)}
              placeholder={
                isMusicVideoMode
                  ? "Describe the mood, lighting, or setting of the music video..."
                  : "Type narrative vision..."
              }
              className={`w-full ${isMusicVideoMode ? "h-32" : "min-h-[140px] lg:flex-1"} bg-black/40 border border-white/5 rounded-2xl p-5 text-[15px] font-extrabold text-white resize-none outline-none focus:border-indigo-500/50 transition-all placeholder-gray-600 leading-[1.7] shadow-inner scrollbar-none`}
            />
          </div>

          <div className="space-y-3 shrink-0 mt-auto pt-2 border-t border-white/5">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <select
                  value={selectedStoryGenre}
                  onChange={(e) => setSelectedStoryGenre(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-[10px] font-black outline-none appearance-none cursor-pointer transition-colors ${isMusicVideoMode ? "bg-indigo-900/20 border-indigo-500 text-indigo-300" : "bg-gray-900 border-white/10 text-gray-400 hover:bg-black"}`}
                >
                  <option>Oral Tradition</option>
                  <option>Drama</option>
                  <option>Action</option>
                  <option>Sci-Fi</option>
                  <option>Comedy</option>
                  <option>History</option>
                  <option>Religion</option>
                  <option>Horror</option>
                  <option>Folklore</option>
                  <option>Mystery</option>
                  <option>Fantasy</option>
                  <option>Music Video</option>
                </select>
                <ChevronDownIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={selectedMovieStyle}
                  onChange={(e) => setSelectedMovieStyle(e.target.value)}
                  className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black text-gray-400 outline-none appearance-none cursor-pointer hover:bg-black transition-colors"
                >
                  <option>Nollywood</option>
                  <option>Hollywood</option>
                  <option>General</option>
                </select>
                <ChevronDownIcon className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-700 pointer-events-none" />
              </div>
            </div>

            {/* THREE-IN-A-ROW COMPACT FOOTER */}
            <div className="grid grid-cols-3 gap-2">
              {/* Voice/Speaker Area (Green themed) */}
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <select
                    value={selectedVoice}
                    disabled={isMusicVideoMode}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className={`w-full border rounded-xl px-2 py-1.5 text-[9px] font-black outline-none appearance-none transition-opacity ${isMusicVideoMode ? "bg-gray-800 border-white/5 text-gray-600 opacity-50" : "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"}`}
                  >
                    {PREBUILT_VOICES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {!isMusicVideoMode && (
                  <ChevronDownIcon className="w-2.5 h-2.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-900 pointer-events-none" />
                  )}
                </div>
                {/* DO add comment: Speak Grayed Out. Speaker button is disabled and visually muted in Music Video mode. */}
                <button
                  ref={speakButtonRef}
                  onClick={handleGenerateSpeechMaster}
                  disabled={
                    isGeneratingSpeech ||
                    !sharedStoryText.trim() ||
                    isMusicVideoMode
                  }
                  className={`w-full py-3 rounded-xl text-[9px] font-black tracking-widest transition-all active:scale-[0.98] border ${isMusicVideoMode ? "bg-gray-800/20 text-gray-600 border-white/5 opacity-50 cursor-not-allowed" : isConfirmingSpeak ? "bg-emerald-600 text-white border-emerald-500/10" : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border-emerald-500/10"}`}
                >
                  {isGeneratingSpeech ? (
                    <LoaderIcon className="w-3 h-3 animate-spin mx-auto" />
                  ) : isConfirmingSpeak ? (
                    "1C"
                  ) : (
                    "Speak"
                  )}
                </button>
              </div>

              {/* DO add comment: Dialogue Grayed Out. Button is disabled and visually muted in Music Video mode. */}
              <button
                onClick={() => setIncludeDialogue(!includeDialogue)}
                disabled={isMusicVideoMode}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border transition-all active:scale-[0.98] ${isMusicVideoMode ? "bg-gray-800/20 border-white/5 text-gray-600 opacity-50 cursor-not-allowed" : includeDialogue ? "bg-indigo-600/10 border-indigo-500 text-indigo-200" : "bg-gray-900 border-white/5 text-gray-600"}`}
              >
                <span className="text-[8px] font-black tracking-tighter  leading-none px-2 text-center">
                  Dialogue Gen
                </span>
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isMusicVideoMode ? "border-gray-800" : includeDialogue ? "bg-indigo-600 border-indigo-400 shadow-[0_0_10px_rgba(79,70,229,0.4)]" : "border-gray-800"}`}
                >
                  {includeDialogue && !isMusicVideoMode && (
                    <CheckIcon className="w-2.5 h-2.5 text-white" />
                  )}
                </div>
              </button>

              {/* Generate Button */}
              <button
                onClick={() =>
                  creationMode === "ai"
                    ? handleCreateStory(false)
                    : handleProcessPastedStory()
                }
                disabled={isGeneratingStory}
                className="flex flex-col items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-2xl active:scale-[0.98] border border-indigo-400/20 transition-all group"
              >
                {isGeneratingStory ? (
                  <LoaderIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <SparklesIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                )}
                <span className="text-[12px] tracking-[0.2em]">
                  {creationMode === "ai" ? "Generate" : "Process"}
                </span>
              </button>
            </div>

            {storybookContent.narrativeAudioSrc && !isMusicVideoMode && (
              <div className="grid grid-cols-3 gap-2 animate-in zoom-in-95 mt-2">
                <button
                  onClick={togglePreviewAudio}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition-all active:scale-95 shadow-xl border border-red-500/20 ${isPlayingPreview ? "bg-red-600 text-white" : "bg-red-700/80 hover:bg-red-600 text-white"}`}
                >
                  {isPlayingPreview ? (
                    <StopIcon className="w-5 h-5" />
                  ) : (
                    <PlayIcon className="w-5 h-5" />
                  )}
                  <span className="text-[8px] font-black  tracking-widest mt-1">
                    Play
                  </span>
                </button>
                <button
                  onClick={() =>
                    handleDownloadAudio(
                      storybookContent.narrativeAudioSrc!,
                      "master_narrative.wav"
                    )
                  }
                  className="flex flex-col items-center justify-center py-2.5 bg-blue-700/80 hover:bg-blue-600 text-white rounded-xl transition-all active:scale-95 shadow-xl border border-blue-400/20"
                >
                  <DownloadIcon className="w-5 h-5" />
                  <span className="text-[8px] font-black  tracking-widest mt-1">
                    Save
                  </span>
                </button>
                <button
                  onClick={() =>
                    onAddAudioClip?.(storybookContent.narrativeAudioSrc!, 10)
                  }
                  className="flex flex-col items-center justify-center py-2.5 bg-blue-700/80 hover:bg-blue-600 text-white rounded-xl transition-all active:scale-95 shadow-xl border border-blue-400/20"
                >
                  <MusicalNoteIcon className="w-5 h-5" />
                  <span className="text-[8px] font-black  tracking-widest mt-1">
                    Deck
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SEQUENCE AREA */}
        <div
          ref={productionSequenceRef}
          className="flex-1 flex flex-col relative overflow-visible lg:overflow-hidden bg-black/10"
        >
          <div className="flex-1 p-4 lg:p-8 lg:overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800">
            <div className="max-w-4xl mx-auto space-y-6 pb-40">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600/10 rounded-xl border border-indigo-500/20">
                    {isMusicVideoMode ? (
                      <MusicalNoteIcon className="w-5 h-5 text-indigo-500" />
                    ) : (
                    <FilmIcon className="w-5 h-5 text-indigo-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white italic tracking-tighter leading-none">
                      {isMusicVideoMode
                        ? "Music Video Sequence"
                        : "Sequence Map"}
                    </h3>
                    <p className="text-[9px] font-black text-gray-600 tracking-[0.3em] mt-1">
                      Elements: {storybookContent.scenes.length}
                    </p>
                  </div>
                </div>
                {storybookContent.scenes.length > 0 && (
                  <button
                    onClick={handleGenerateScenes}
                    disabled={isGeneratingScenes}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black text-indigo-300 hover:text-white flex items-center gap-2 transition-all tracking-widest"
                  >
                    {isGeneratingScenes ? (
                      <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshIcon className="w-3.5 h-3.5" />
                    )}{" "}
                    SYNC ALL
                  </button>
                )}
              </div>

              {storybookContent.scenes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center opacity-10">
                  <div className="w-20 h-20 rounded-full border border-dashed border-gray-600 flex items-center justify-center mb-8">
                    <Logo className="w-10 h-10 grayscale" />
                  </div>
                  <h4 className="text-[10px] font-black tracking-[0.5em] text-gray-500 ">
                    {isMusicVideoMode
                      ? "Awaiting Lyrical Blueprint"
                      : "Awaiting Blueprint Production"}
                  </h4>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {storybookContent.scenes.map((scene, index) => (
                    <div
                      key={index}
                      className="bg-gray-800/20 rounded-[2rem] border border-white/5 pt-3 pb-8 px-4 lg:pt-3 lg:pb-10 lg:px-5 hover:border-indigo-500/20 transition-all group relative overflow-hidden shadow-2xl"
                    >
                      <div className="flex justify-between items-center mb-3 relative z-10">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[12px] font-black tracking-widest">
                            {isMusicVideoMode
                              ? `Clip ${index + 1}`
                              : `Scene ${index + 1}`}
                          </span>

                          <button
                            onClick={() => {
                              const ns = [...storybookContent.scenes];
                              ns[index].isDescriptionLocked =
                                !ns[index].isDescriptionLocked;
                              setStorybookContent({
                                ...storybookContent,
                                scenes: ns
                              });
                            }}
                            className={`p-2 rounded-xl transition-all border ${scene.isDescriptionLocked ? "text-amber-500 bg-amber-500/10 border-amber-500/30" : "text-gray-600 bg-white/5 border-white/5"}`}
                          >
                            {scene.isDescriptionLocked ? (
                              <LockClosedIcon className="w-4 h-4" />
                            ) : (
                              <LockOpenIcon className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300">
                          <button
                            onClick={() => handleExecuteSingleScene(index)}
                            className={`px-5 py-2 text-[10px] font-black rounded-xl tracking-widest transition-all active:scale-95 shadow-lg ${confirmingExecuteIdx === index ? "bg-green-600 text-white" : "bg-indigo-600 text-white"}`}
                          >
                            {confirmingExecuteIdx === index
                              ? "Confirm"
                              : "Produce"}
                          </button>
                          <button
                            onClick={() => handleRegenerateVisual(index)}
                            className="p-2 text-gray-500 hover:text-white transition-colors rounded-xl bg-white/5 border border-white/5"
                          >
                            <RefreshIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const ns = [...storybookContent.scenes];
                              ns.splice(index, 1);
                              setStorybookContent({
                                ...storybookContent,
                                scenes: ns
                              });
                            }}
                            className="p-2 text-gray-600 hover:text-red-400 transition-colors rounded-xl bg-white/5 border border-white/5"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 items-stretch">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 mb-0.5 ml-1">
                            <label className="text-[8px] lg:text-[12px] font-black text-gray-500 tracking-[0.2em] ">
                              Visual Direction
                            </label>
                            <CopyButton text={scene.imageDescription} />
                          </div>
                          <textarea
                            value={scene.imageDescription}
                            readOnly={scene.isDescriptionLocked}
                            onChange={(e) => {
                              const ns = [...storybookContent.scenes];
                              ns[index].imageDescription = e.target.value;
                              setStorybookContent({
                                ...storybookContent,
                                scenes: ns
                              });
                            }}
                            className="w-full bg-black/50 border border-white/5 rounded-2xl pt-5 pr-5 pl-5 pb-12 text-[14px] font-bold text-white leading-relaxed h-full outline-none focus:border-indigo-500/30 transition-colors shadow-inner scrollbar-none"
                          />
                        </div>
                        <div className="space-y-2 flex flex-col h-full">
                          <div className="flex justify-between items-center mt-2 mb-1 lg:mt-0">
                            <div className="flex items-center gap-2 ml-1 mt-1 lg:mt-0">
                              <label className="text-[12px] font-black text-gray-500 tracking-[0.2em] ">
                                {isMusicVideoMode
                                  ? "Lyrics / Action"
                                  : "Narrative / Dialogue"}
                              </label>
                              <CopyButton text={scene.script} />
                            </div>
                            <div className="flex gap-2 mt-1 lg:mt-0">
                              {scene.audioSrc ? (
                                <div className="flex gap-1.5 animate-in zoom-in-95">
                                  <button
                                    onClick={() => {
                                      const audio = new Audio(scene.audioSrc!);
                                      audio.play();
                                    }}
                                    className="p-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600 transition-all"
                                    title="Preview Narrative"
                                  >
                                    <PlayIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDownloadAudio(
                                        scene.audioSrc!,
                                        `scene_${index + 1}.wav`
                                      )
                                    }
                                    className="p-1.5 bg-gray-800 text-gray-400 border border-white/5 rounded-lg hover:text-white transition-all"
                                    title="Download Asset"
                                  >
                                    <DownloadIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleAddSceneAudioToTimeline(index)
                                    }
                                    className="flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black tracking-widest shadow-lg hover:bg-indigo-500 active:scale-95"
                                  >
                                    + DECK
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleGenerateSceneAudio(index)
                                  }
                                  disabled={
                                    generatingSceneAudioIdx === index ||
                                    !scene.script.trim()
                                  }
                                  className="flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-white/10 rounded-lg text-[8px] font-black tracking-widest transition-all"
                                >
                                  {generatingSceneAudioIdx === index ? (
                                    <LoaderIcon className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <SpeakerWaveIcon className="w-3 h-3" />
                                  )}{" "}
                                  Narrate (1C)
                                </button>
                              )}
                            </div>
                          </div>
                          <textarea
                            value={scene.script}
                            readOnly={scene.isDescriptionLocked}
                            onChange={(e) => {
                              const ns = [...storybookContent.scenes];
                              ns[index].script = e.target.value;
                              setStorybookContent({
                                ...storybookContent,
                                scenes: ns
                              });
                            }}
                            className="w-full bg-black/50 border border-white/5 rounded-2xl p-5 text-[14px] font-bold text-white leading-relaxed flex-grow outline-none focus:border-indigo-500/30 transition-colors shadow-inner scrollbar-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={scenesEndRef} className="h-20" />
                </div>
              )}
            </div>
          </div>

          {/* FLOATING MASTER BATCH CONSOLE - MINIMALIST */}
          {storybookContent.scenes.length > 0 && (
            <div className="fixed lg:absolute bottom-6 left-0 right-0 px-6 flex justify-center pointer-events-none z-[100]">
              <div className="w-full max-sm bg-[#0a0f1d] border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-2 flex items-center justify-between pointer-events-auto animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 pl-6">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white tracking-tighter italic leading-none ">
                        {storybookContent.scenes.length} Scenes
                      </span>
                      <div className="h-3 w-px bg-white/10"></div>
                      <span className="text-[16px] font-black text-indigo-400 leading-none">
                        {storybookContent.scenes.length}C
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  ref={batchButtonRef}
                  onClick={handleBatchProduce}
                  className={`px-8 py-3.5 font-black  tracking-widest rounded-full shadow-2xl transition-all active:scale-95 flex items-center gap-3 text-[15px] border ${confirmingBatch ? "bg-green-600 border-green-400 text-white" : "bg-indigo-600 border-indigo-400 text-white shadow-[0_8px_30px_rgba(79,70,229,0.4)]"}`}
                >
                  <DocumentMagnifyingGlassIcon className="w-4 h-4" />
                  {confirmingBatch ? `Confirm Batch` : "Produce All"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {storyError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-900 border border-red-500 text-white px-8 py-3 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex items-center gap-4 animate-in slide-in-from-bottom-4 z-[200]">
          <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
          <span className="text-[11px] font-black tracking-widest italic ">
            Signal Error: {storyError}
          </span>
          <button
            onClick={() => setStoryError(null)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
