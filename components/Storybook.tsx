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
  DownloadIcon
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
        false,
        "",
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
        selectedCountry
      );
      const lockedScenes = scenes.map((s: any) => ({
        ...s,
        isDescriptionLocked: true,
        isScriptLocked: true
      }));
      setStorybookContent({
        ...storybookContent,
        title,
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
    if (onDeductAudioCredit && !onDeductAudioCredit()) {
      setStoryError("Insufficient credits.");
      setIsConfirmingSpeak(false);
      return;
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
      if (onDeductAudioCredit && !onDeductAudioCredit()) {
        setStoryError("Insufficient credits.");
        return;
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
      const transcription = await generatePromptFromAudio(base64, file.type);
      setSharedStoryText(
        (sharedStoryText ? sharedStoryText + "\n" : "") + transcription
      );
      setStorySeed((storySeed ? storySeed + "\n" : "") + transcription);
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
      const scenes = await generateScenesFromNarrative(
        storybookContent.storyNarrative,
        fullChars,
        storybookContent.includeDialogue || false,
        characterStyle,
        selectedMovieStyle,
        selectedCountry
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
      <div className="desktop:flex p-2 border-b border-white/5 justify-between items-center shrink-0 bg-[#0a0f1d] hidden">
        <h2 className="text-[9px] font-black text-gray-400 flex items-center gap-1.5  tracking-widest">
          <BookOpenIcon className="w-4 h-4 text-indigo-500" /> Story writer
        </h2>
        <div className="flex items-center gap-2">
          {storybookContent.narrativeAudioSrc && (
            <button
              onClick={() =>
                onAddAudioClip?.(storybookContent.narrativeAudioSrc!, 10)
              }
              className="flex items-center gap-1.5 px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-100 rounded-lg text-[8px] font-black  transition-all"
            >
              <MusicalNoteIcon className="w-3 h-3" /> To Timeline
            </button>
          )}
          <button
            onClick={handleClearEverything}
            className="flex items-center gap-1.5 px-2 py-1 bg-red-900/10 hover:bg-red-800 border border-red-900/30 text-red-400 rounded-lg text-[8px] font-black  active:scale-95"
          >
            <TrashIcon className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden">
        {/* LEFT COLUMN: HIGH DENSITY COMPACT DESIGN */}
        <div className="w-full lg:w-[280px] p-2 lg:border-r border-white/5 flex flex-col gap-1.5 shrink-0 bg-[#0a0f1d]/20 h-auto lg:h-full lg:overflow-y-auto scrollbar-none">
          <div className="flex bg-gray-900 rounded-lg p-0.5 border border-white/5 themed-artline shrink-0">
            <button
              onClick={() => setCreationMode("ai")}
              className={`flex-1 py-1 text-[8px] font-black rounded-md  transition-all ${creationMode === "ai" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-200"}`}
            >
              Blueprint
            </button>
            <button
              onClick={() => setCreationMode("paste")}
              className={`flex-1 py-1 text-[8px] font-black rounded-md  transition-all ${creationMode === "paste" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500"}`}
            >
              Draft
            </button>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Story Title..."
            className="w-full bg-transparent border-none py-1 text-lg font-black text-white focus:outline-none placeholder-gray-800 text-center tracking-tighter italic shrink-0"
          />

          <div className="flex flex-wrap justify-center gap-1 p-1 bg-black/20 rounded-lg border border-white/5 shadow-inner min-h-[50px] shrink-0">
            {characters.length === 0 ? (
              <div className="flex items-center justify-center w-full opacity-20">
                <span className="text-[6px] font-black  tracking-widest text-gray-600">
                  No Actors
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
                    className={`w-8 h-8 rounded-full border overflow-hidden transition-all ${storybookContent.characters.includes(char.name) ? "border-green-500 scale-105 shadow-[0_0_8px_rgba(34,197,94,0.3)]" : "border-gray-800 opacity-40 grayscale group-hover:opacity-100"}`}
                  >
                    {char.imagePreview ? (
                      <img
                        src={char.imagePreview}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900\">
                        <UserPlusIcon className="w-3 h-3 text-gray-700" />
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[5px] font-black  tracking-tighter ${storybookContent.characters.includes(char.name) ? "text-green-500" : "text-gray-600"}`}
                  >
                    {char.name.split(" ")[0] || "Actor"}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex flex-col gap-1 flex-1 min-h-0">
            <div className="flex justify-between items-center px-1 shrink-0">
              <label className="text-[7px] font-black text-gray-600  tracking-widest">
                Concept
              </label>
              <div className="flex gap-1">
                {storybookContent.narrativeAudioSrc && (
                  <div className="flex gap-1 animate-in zoom-in-95">
                    <button
                      onClick={togglePreviewAudio}
                      className={`flex items-center gap-1 px-1 py-0.5 rounded border transition-all ${isPlayingPreview ? "bg-red-600 border-red-400 text-white" : "bg-indigo-600/20 border-indigo-500/30 text-indigo-400"}`}
                    >
                      {isPlayingPreview ? (
                        <StopIcon className="w-2 h-2" />
                      ) : (
                        <PlayIcon className="w-2 h-2" />
                      )}
                      <span className="text-[5px] font-black ">
                        Play
                      </span>
                    </button>
                  </div>
                )}
                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-900/20 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-300 hover:text-white rounded text-[6px] font-black  transition-all shadow-sm"
                >
                  {isProcessingAudio ? (
                    <LoaderIcon className="w-1.5 h-1.5 animate-spin" />
                  ) : (
                    <MusicalNoteIcon className="w-1.5 h-1.5" />
                  )}{" "}
                  {isProcessingAudio ? "..." : "Voice"}
                </button>
              </div>
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
              placeholder="Type narrative vision..."
              className="w-full min-h-[80px] lg:flex-1 bg-black/40 border border-white/5 rounded-lg p-2 text-[10px] font-bold text-white resize-none outline-none focus:border-indigo-500/50 transition-all placeholder-gray-700 leading-relaxed shadow-inner scrollbar-none"
            />
          </div>

          <div className="space-y-1 shrink-0">
            <div className="grid grid-cols-2 gap-1">
              <div className="relative">
                <select
                  value={selectedStoryGenre}
                  onChange={(e) => setSelectedStoryGenre(e.target.value)}
                  className="w-full bg-gray-900 border border-white/10 rounded-md px-1.5 py-1 text-[8px] font-black text-gray-400 outline-none appearance-none cursor-pointer"
                >
                  {" "}
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
                </select>
                <ChevronDownIcon className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={selectedMovieStyle}
                  onChange={(e) => setSelectedMovieStyle(e.target.value)}
                  className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black text-gray-200 outline-none appearance-none cursor-pointer"
                >
                  <option>Nollywood</option>
                  <option>Hollywood</option>
                  <option>General</option>
                </select>
                <ChevronDownIcon className="w-2 h-2 absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-700 pointer-events-none" />
              </div>
            </div>
            <button
              onClick={() => setIncludeDialogue(!includeDialogue)}
              className={`w-full py-1 rounded-md border flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${includeDialogue ? "bg-indigo-600/10 border-indigo-500 text-indigo-200" : "bg-gray-900 border-white/5 text-gray-600"}`}
            >
              <div
                className={`w-2.5 h-2.5 rounded border flex items-center justify-center ${includeDialogue ? "bg-indigo-600 border-indigo-400" : "border-gray-800"}`}
              >
                {includeDialogue && (
                  <CheckIcon className="w-1.5 h-1.5 text-white" />
                )}
              </div>
              <span className="text-[8px] font-black  tracking-widest">
                Dialogue Gen
              </span>
            </button>
            <div className="flex gap-1 pb-1 lg:pb-0">
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="relative">
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-md px-1.5 py-1 text-[7px] font-black text-indigo-500 outline-none appearance-none"
                  >
                    {PREBUILT_VOICES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="w-1.5 h-1.5 absolute right-1.5 top-1/2 -translate-y-1/2 text-indigo-900 pointer-events-none" />
                </div>
                <button
                  ref={speakButtonRef}
                  onClick={handleGenerateSpeechMaster}
                  disabled={isGeneratingSpeech || !sharedStoryText.trim()}
                  className={`w-full py-1 rounded-md text-[7px] font-black  tracking-widest transition-all active:scale-[0.98] border border-white/5 ${isConfirmingSpeak ? "bg-green-600 text-white" : "bg-gray-800 text-gray-500 hover:text-white"}`}
                >
                  {isGeneratingSpeech ? (
                    <LoaderIcon className="w-2 h-2 animate-spin mx-auto" />
                  ) : isConfirmingSpeak ? (
                    "1C"
                  ) : (
                    "Speak"
                  )}
                </button>
              </div>
              <div className="flex-[2] flex flex-col gap-0.5">
                <button
                  onClick={() =>
                    creationMode === "ai"
                      ? handleCreateStory(false)
                      : handleProcessPastedStory()
                  }
                  disabled={isGeneratingStory}
                  className="h-full bg-indigo-600 hover:bg-indigo-500 text-white font-black  tracking-[0.1em] rounded-md shadow-lg active:scale-[0.98] text-[9px] flex items-center justify-center gap-1.5 border border-indigo-400/20"
                >
                  {isGeneratingStory ? (
                    <LoaderIcon className="w-3 h-3 animate-spin" />
                  ) : (
                    <SparklesIcon className="w-3 h-3" />
                  )}
                  <span>{creationMode === "ai" ? "GENERATE" : "PROCESS"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SEQUENCE AREA */}
        <div
          ref={productionSequenceRef}
          className="flex-1 flex flex-col relative overflow-visible lg:overflow-hidden bg-black/10"
        >
          <div className="flex-1 p-2 lg:p-4 lg:overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800">
            <div className="max-w-4xl mx-auto space-y-4 pb-32">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-600/10 rounded-lg border border-indigo-500/20">
                    <FilmIcon className="w-3 h-3 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white italic tracking-tighter  leading-none">
                      Sequence Map
                    </h3>
                    <p className="text-[7px] font-black text-gray-600  tracking-[0.2em] mt-0.5">
                      Count: {storybookContent.scenes.length}
                    </p>
                  </div>
                </div>
                {storybookContent.scenes.length > 0 && (
                  <button
                    onClick={handleGenerateScenes}
                    disabled={isGeneratingScenes}
                    className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[7px] font-black text-indigo-300 hover:text-white flex items-center gap-1.5 transition-all  tracking-widest"
                  >
                    {isGeneratingScenes ? (
                      <LoaderIcon className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <RefreshIcon className="w-2.5 h-2.5" />
                    )}{" "}
                    SYNC
                  </button>
                )}
              </div>

              {storybookContent.scenes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center opacity-10">
                  <div className="w-12 h-12 rounded-full border border-dashed border-gray-600 flex items-center justify-center mb-4">
                    <Logo className="w-6 h-6 grayscale" />
                  </div>
                  <h4 className="text-[8px] font-black  tracking-[0.3em] text-gray-500">
                    Awaiting Blueprint
                  </h4>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {storybookContent.scenes.map((scene, index) => (
                    <div
                      key={index}
                      className="bg-gray-800/20 rounded-xl border border-white/5 p-3 lg:p-4 hover:border-indigo-500/20 transition-all group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-center mb-3 relative z-10">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[8px] font-black  tracking-widest">
                            SCENE {index + 1}
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
                            className={`p-1 rounded-md transition-all border ${scene.isDescriptionLocked ? "text-amber-500 bg-amber-500/10 border-amber-500/30" : "text-gray-600 bg-white/5 border-white/5"}`}
                          >
                            {scene.isDescriptionLocked ? (
                              <LockClosedIcon className="w-3 h-3" />
                            ) : (
                              <LockOpenIcon className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300">
                          <button
                            onClick={() => handleExecuteSingleScene(index)}
                            className={`px-3 py-1.5 text-[7px] font-black rounded-md  tracking-widest transition-all active:scale-95 ${confirmingExecuteIdx === index ? "bg-green-600 text-white" : "bg-indigo-600 text-white"}`}
                          >
                            {confirmingExecuteIdx === index
                              ? "CONFIRM"
                              : "PRODUCE"}
                          </button>
                          <button
                            onClick={() => handleRegenerateVisual(index)}
                            className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-md bg-white/5 border border-white/5"
                          >
                            <RefreshIcon className="w-3 h-3" />
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
                            className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-md bg-white/5 border border-white/5"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
                        <div className="space-y-1">
                          <label className="text-[7px] font-black text-gray-500  ml-1 tracking-widest">
                            Image Prompt
                          </label>
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
                            className="w-full bg-black/50 border border-white/5 rounded-lg p-2.5 text-[11px] font-bold text-white leading-relaxed min-h-[70px] outline-none focus:border-indigo-500/30 transition-colors shadow-inner scrollbar-none"
                          />
                        </div>
                        <div className="space-y-1 flex flex-col">
                          <div className="flex justify-between items-center mb-0.5">
                            <label className="text-[7px] font-black text-gray-500  ml-1 tracking-widest">
                              The Story
                            </label>
                            <div className="flex gap-1">
                              {scene.audioSrc ? (
                                <div className="flex gap-1 animate-in zoom-in-95">
                                  <button
                                    onClick={() => {
                                      const audio = new Audio(scene.audioSrc!);
                                      audio.play();
                                    }}
                                    className="p-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-md hover:bg-emerald-600 transition-all"
                                  >
                                    <PlayIcon className="w-2 h-2" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDownloadAudio(
                                        scene.audioSrc!,
                                        `scene_${index + 1}.wav`
                                      )
                                    }
                                    className="p-1 bg-gray-800 text-gray-400 border border-white/5 rounded-md hover:text-white"
                                  >
                                    <DownloadIcon className="w-2 h-2" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleAddSceneAudioToTimeline(index)
                                    }
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-600 text-white rounded-md text-[6px] font-black  tracking-widest shadow-md"
                                  >
                                    Timeline
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
                                  className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-white/10 rounded-md text-[6px] font-black  tracking-widest transition-all"
                                >
                                  {generatingSceneAudioIdx === index ? (
                                    <LoaderIcon className="w-2 h-2 animate-spin" />
                                  ) : (
                                    <SpeakerWaveIcon className="w-2 h-2" />
                                  )}{" "}
                                  Narrate
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
                            className="w-full bg-black/50 border border-white/5 rounded-lg p-2.5 text-[11px] font-bold text-white leading-relaxed flex-1 min-h-[70px] outline-none focus:border-indigo-500/30 transition-colors shadow-inner scrollbar-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={scenesEndRef} className="h-10" />
                </div>
              )}
            </div>
          </div>

          {/* FLOATING MASTER BATCH CONSOLE - MINIMALIST */}
          {storybookContent.scenes.length > 0 && (
            <div className="fixed lg:absolute bottom-3 left-0 right-0 px-4 flex justify-center pointer-events-none z-[100]">
              <div className="w-full max-w-sm bg-[#0a0f1d] border border-white/10 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.8)] p-1.5 flex items-center justify-between pointer-events-auto animate-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-3 pl-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white tracking-tighter italic leading-none ">
                        {storybookContent.scenes.length} Scenes
                      </span>
                      <div className="h-2 w-px bg-white/10"></div>
                      <span className="text-[8px] font-black text-indigo-400 leading-none">
                        Est. {storybookContent.scenes.length}C
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  ref={batchButtonRef}
                  onClick={handleBatchProduce}
                  className={`px-6 py-2.5 font-black  tracking-widest rounded-full shadow-lg transition-all active:scale-95 flex items-center gap-2 text-[9px] border ${confirmingBatch ? "bg-green-600 border-green-400 text-white" : "bg-indigo-600 border-indigo-400 text-white shadow-[0_4px_15px_rgba(79,70,229,0.3)]"}`}
                >
                  <DocumentMagnifyingGlassIcon className="w-3 h-3" />
                  {confirmingBatch ? `Confirm` : "Produce Batch"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {storyError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-900 border border-red-500 text-white px-5 py-2 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2 z-[200]">
          <span className="text-[9px] font-black  tracking-widest italic">
            Signal Error: {storyError}
          </span>
          <button
            onClick={() => setStoryError(null)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
