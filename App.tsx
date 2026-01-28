// Studio Re-architecture: Distinct rendering paths for PC (Integrated) and Mobile (Hub-and-Spoke).
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from "react";
import { Sidebar, VIEW_COLORS } from "./components/Sidebar";
import { Auth } from "./components/Auth";
import { Modals } from "./components/Modals";
import { WelcomePage } from "./components/WelcomePage";
import { ActorRoster } from "./components/ActorRoster";
import { StorybookCreator } from "./components/Storybook";
import { Storyboard } from "./components/Storyboard";
import { Timeline } from "./components/Timeline";
import { HistoryPanel } from "./components/History";
import { Footage } from "./components/Footage";
import DirectorsCut from "./components/DirectorsCut";
import {
  XIcon,
  SparklesIcon,
  VideoIcon,
  FilmIcon,
  CheckIcon,
  CreditCardIcon,
  ChevronLeftIcon,
  TrashIcon,
  Logo,
  GiftIcon
} from "./components/Icons";
import { supabase } from "./services/supabaseClient";
import {
  type Character,
  type Storybook,
  generateSingleImage,
  generateCharacterDescription,
  generateCharacterVisual,
  editImage,
  generatePromptFromAudio,
  type Outfit,
  generateSpeech,
  generateVideoFromScene
} from "./services/geminiService";
import { fileToBase64 } from "./utils/fileUtils";
import { dbGet, dbSet } from "./utils/indexedDB";
import {
  SUPPORT_EMAIL,
  HELLO_EMAIL,
  PAYPAL_STARTER_LINK,
  PAYPAL_PRO_LINK,
  PAYPAL_STUDIO_LINK
} from "./utils/constants";

// Define aistudio interface extension
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

// Labels for production tracking. Costs are managed entirely on Supabase.
const CREDIT_ACTIONS = {
  IMAGE_NORMAL: "IMAGE_NORMAL",
  IMAGE_PRO: "IMAGE_PRO",
  IMAGE_EDIT_PRO: "IMAGE_EDIT_PRO",
  IMAGE_CAMERA_ANGLE_PRO: "IMAGE_CAMERA_ANGLE_PRO",

  STORYBOOK_SCENE: "STORYBOOK_SCENE",

  CHARACTER_IMAGE: "CHARACTER_IMAGE",

  VIDEO_FAST: "VIDEO_FAST",
  VIDEO_HQ: "VIDEO_HQ",
  VIDEO_ADD_AUDIO: "VIDEO_ADD_AUDIO",

  AUDIO_GENERIC: "AUDIO_GENERIC"
};

type LayoutMode = "phone" | "tablet" | "desktop";

const ViewHeader: React.FC<{
  title: string;
  onBack: () => void;
  layout: LayoutMode;
}> = ({ title, onBack, layout }) => (
  <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0a0f1d] shrink-0 z-50">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-indigo-600/10 border border-indigo-500/20 rounded-full flex items-center justify-center p-1.5 shadow-lg">
        <Logo className="w-full h-full" />
      </div>
        <h2 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] italic">
          {title}
        </h2>
          </div>
    <button
      onClick={onBack}
      className="p-2 bg-gray-800/50 hover:bg-red-900/20 rounded-xl text-gray-400 hover:text-red-400 transition-all flex items-center gap-2 border border-white/5 group"
    >
      <span className="text-[8px] font-black uppercase tracking-widest hidden sm:block group-hover:translate-x-[-2px] transition-transform">
        Close Page
                </span>
      <XIcon className="w-5 h-5" />
    </button>
  </div>
);

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [activeView, setActiveView] = useState("welcome");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("desktop");

  // ALIGNMENT PROTOCOL: Ensures 'Standing' iPads use compact sidebars while 'Rotating' iPads get the full console.
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isPortrait = height > width;

      if (width <= 500) {
        setLayoutMode("phone");
      } else if (width < 1024 && isPortrait) {
        // STANDING IPAD: Compact sidebar logic.
        setLayoutMode("tablet");
        if (activeView === "menu") setActiveView("storybook");
      } else {
        // ROTATING IPAD / DESKTOP: Full sidebar workspace.
        setLayoutMode("desktop");
        if (activeView === "menu") setActiveView("storybook");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeView]);

  const [visualStyle, setVisualStyle] = useState(
    () => localStorage.getItem("visualStyle") || "3D Render"
  );
  const [aspectRatio, setAspectRatio] = useState(
    () => localStorage.getItem("aspectRatio") || "16:9"
  );
  const [characterStyle, setCharacterStyle] = useState(
    () => localStorage.getItem("characterStyle") || "Afro-toon"
  );
  const [selectedCountry, setSelectedCountry] = useState(
    () => localStorage.getItem("selectedCountry") || "Nigeria"
  );
  const [imageModel] = useState("gemini-2.5-flash-image");
  const [videoModel, setVideoModel] = useState("veo-3.1-fast-generate-preview");
  const [videoResolution, setVideoResolution] = useState("720p");

  const [characters, setCharacters] = useState<Character[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [savedScenes, setSavedScenes] = useState<any[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [creditSettings, setCreditSettings] = useState({
    creditBalance: 0,
    currency: "USD"
  });

  // Gift States
  const [isGiftMode, setIsGiftMode] = useState(false);
  const [giftRecipientEmail, setGiftRecipientEmail] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", session.user.id)
          .single();
        if (!error && data)
          setCreditSettings((prev) => ({
            ...prev,
            creditBalance: data.credits
          }));
      }
    };
    fetchProfile();
  }, [session]);

  const [storybook, setStorybook] = useState<Storybook>(() => {
    try {
      const saved = localStorage.getItem("storybookState");
      return saved
        ? JSON.parse(saved)
        : {
            title: "",
            characters: [],
            storyNarrative: "",
            scenes: [],
            includeDialogue: true
          };
    } catch (e) {
      return {
        title: "",
        characters: [],
        storyNarrative: "",
        scenes: [],
        includeDialogue: true
      };
    }
  });

  const [storySeed, setStorySeed] = useState(
    () => localStorage.getItem("storySeedMemory") || ""
  );
  const [activeHistoryIndex, setActiveHistoryIndex] = useState(-1);
  const [isGenerating, setIsGenerating] = useState(false);

  // FOOTAGE DESK SPECIFIC STATE (PERSISTENT)
  const [footageHistory, setFootageHistory] = useState<any[]>([]);
  const [footagePrompt, setFootagePrompt] = useState(
    () => localStorage.getItem("footagePrompt") || ""
  );
  const [footageMode, setFootageMode] = useState<"image" | "video">(
    () => (localStorage.getItem("footageMode") as any) || "image"
  );
  const [footageVideoTier, setFootageVideoTier] = useState(
    () => localStorage.getItem("footageVideoTier") || "veo31-fast"
  );
  const [footageImageTier, setFootageImageTier] = useState(
    () => localStorage.getItem("footageImageTier") || "fast"
  );
  const [footageRefImages, setFootageRefImages] = useState<(string | null)[]>(
    () => {
      try {
        const saved = localStorage.getItem("footageRefImages");
        return saved ? JSON.parse(saved) : [null, null, null];
      } catch (e) {
        return [null, null, null];
      }
    }
  );

  // TIMELINE PERSISTENT STATE
  const [timelineClips, setTimelineClips] = useState<any[]>([]);
  const [audioClips, setAudioClips] = useState<any[]>([]);
  const [textClips, setTextClips] = useState<any[]>([]);
  // Persistent playhead position for timeline cross-tab stability
  const [timelinePlaybackTime, setTimelinePlaybackTime] = useState(0);

  // TIMELINE HISTORY ENGINE
  const [timelineHistory, setTimelineHistory] = useState<string[]>([]);
  // DO add comment: Fixed block-scoped variable error by removing redundant and syntactically incorrect 'isUndoing.current' initialization.
  const isUndoing = useRef(false);

  useEffect(() => {
    if (!isDataLoaded) return;
    if (isUndoing.current) {
      isUndoing.current = false;
      return;
    }
    const state = JSON.stringify({
      clips: timelineClips,
      audio: audioClips,
      text: textClips
    });
    setTimelineHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === state) return prev;
      return [...prev, state].slice(-20);
    });
  }, [timelineClips, audioClips, textClips, isDataLoaded]);

  const handleTimelineUndo = useCallback(() => {
    if (timelineHistory.length <= 1) return;
    isUndoing.current = true;
    const newHistory = [...timelineHistory];
    newHistory.pop(); // Remove current state
    const prevStateStr = newHistory[newHistory.length - 1];
    try {
      const prevState = JSON.parse(prevStateStr);
      setTimelineClips(prevState.clips || []);
      setAudioClips(prevState.audio || []);
      setTextClips(prevState.text || []);
      setTimelineHistory(newHistory);
    } catch (e) {
      console.error("Undo parse error", e);
      isUndoing.current = false;
    }
  }, [timelineHistory]);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any>({});
  const [activeVideoIndices, setActiveVideoIndices] = useState<number[]>([]);
  const [activeI2ISlot, setActiveI2ISlot] = useState<{
    genId: number;
    sceneId: string;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setSession(session);
      setIsAuthChecking(false);
    });
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setSession(session);
      if (session && activeView === "welcome")
        setActiveView(layoutMode === "phone" ? "menu" : "storybook");
      if (_event === "SIGNED_OUT") {
        setCharacters([]);
        setHistory([]);
        setFootageHistory([]);
        setTimelineClips([]);
        setAudioClips([]);
        setTextClips([]);
        setActiveHistoryIndex(-1);
      }
    });
    return () => subscription.unsubscribe();
  }, [activeView, layoutMode]);

  useEffect(() => {
    const loadData = async () => {
      const h = await dbGet("appHistory");
      const s = await dbGet("savedScenes");
      const c = await dbGet("characters");
      const tc = await dbGet("timelineClips");
      const ac = await dbGet("audioClips");
      const txt = await dbGet("textClips");
      const fh = await dbGet("footageHistory");
      if (h) setHistory(h);
      if (s) setSavedScenes(s);
      if (c) setCharacters(c);
      if (tc) setTimelineClips(tc);
      if (ac) setAudioClips(ac);
      if (txt) setTextClips(txt);
      if (fh) setFootageHistory(fh);
      setIsDataLoaded(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isDataLoaded) dbSet("appHistory", history);
  }, [history, isDataLoaded]);
  useEffect(() => {
    if (isDataLoaded) dbSet("savedScenes", savedScenes);
  }, [savedScenes, isDataLoaded]);
  useEffect(() => {
    if (isDataLoaded) dbSet("characters", characters);
  }, [characters, isDataLoaded]);
  useEffect(() => {
    if (isDataLoaded) dbSet("timelineClips", timelineClips);
  }, [timelineClips, isDataLoaded]);
  useEffect(() => {
    if (isDataLoaded) dbSet("audioClips", audioClips);
  }, [audioClips, isDataLoaded]);
  useEffect(() => {
    if (isDataLoaded) dbSet("textClips", textClips);
  }, [textClips, isDataLoaded]);
  useEffect(() => {
    if (isDataLoaded) dbSet("footageHistory", footageHistory);
  }, [footageHistory, isDataLoaded]);

  // Footage Desk Persistence
  useEffect(
    () => localStorage.setItem("footagePrompt", footagePrompt),
    [footagePrompt]
  );
  useEffect(
    () => localStorage.setItem("footageMode", footageMode),
    [footageMode]
  );
  useEffect(
    () => localStorage.setItem("footageVideoTier", footageVideoTier),
    [footageVideoTier]
  );
  useEffect(
    () => localStorage.setItem("footageImageTier", footageImageTier),
    [footageImageTier]
  );
  useEffect(
    () =>
      localStorage.setItem(
        "footageRefImages",
        JSON.stringify(footageRefImages)
      ),
    [footageRefImages]
  );

  useEffect(
    () => localStorage.setItem("storybookState", JSON.stringify(storybook)),
    [storybook]
  );
  useEffect(
    () => localStorage.setItem("selectedCountry", selectedCountry),
    [selectedCountry]
  );
  useEffect(
    () => localStorage.setItem("visualStyle", visualStyle),
    [visualStyle]
  );
  useEffect(
    () => localStorage.setItem("aspectRatio", aspectRatio),
    [aspectRatio]
  );
  useEffect(
    () => localStorage.setItem("characterStyle", characterStyle),
    [characterStyle]
  );

  // MASTER CREDIT DEDUCTION: Must run and succeed BEFORE any API generation occurs.
  const consumeCredits = async (actionType: keyof typeof CREDIT_ACTIONS) => {
    if (!session?.user?.id) throw new Error("Not authenticated");

    // Call Supabase RPC to handle deduction logic based on action label
   const { data, error } = await supabase.rpc("consume_credits", {
     p_user_id: session.user.id,
     p_action_type: actionType
   });

    if (error) throw error;
    if (data !== true) throw new Error("INSUFFICIENT_CREDITS");

    // Silent balance sync after successful deduction
   const { data: profile } = await supabase
     .from("profiles")
     .select("credits")
     .eq("id", session.user.id)
     .single();

   if (profile) {
     setCreditSettings((p) => ({
       ...p,
       creditBalance: profile.credits
     }));
   }

   return true;
 };

  const ensureApiKey = async () => {
    if (
      typeof window.aistudio !== "undefined" &&
      typeof window.aistudio.hasSelectedApiKey === "function"
    ) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
        return true;
      }
    }
    return true;
  };

  const handleGenerate = async (
    prompts: string[],
    source: string = "idea",
    referenceImage?: string,
    preferredImageModel?: string
  ) => {
    const activeImageModel = preferredImageModel || imageModel;
    if (activeImageModel === "gemini-3-pro-image-preview") await ensureApiKey();

    setIsGenerating(true);

    if (source !== "footage") setActiveView("storyboard");

    try {
      let sessionId = Date.now();
      const sessionTitle =
        source === "storybook"
          ? "Storywriter"
          : source === "footage"
          ? "Footage Desk"
          : "Production";
      const newItem = {
        id: sessionId,
        type: source,
        prompt: sessionTitle,
        imageSet: [],
        videoStates: [],
        aspectRatio,
        characterStyle: selectedCountry,
        visualStyle,
        isClosed: false
      };

      setHistory((prev) => {
        const next = [...prev, newItem];
        if (source !== "footage") setActiveHistoryIndex(next.length - 1);
        return next;
      });

      const placeholders = prompts.map((p, i) => ({
        sceneId: `scene-${sessionId}-${i}`,
        prompt: p,
        src: null,
        error: null,
        isHidden: false,
        status: "pending",
        variants: []
      }));
      setHistory((prev) =>
        prev.map((h) =>
          h.id === sessionId
            ? {
                ...h,
                imageSet: placeholders,
                videoStates: placeholders.map(() => ({
                  status: "idle",
                  clips: [],
                  draftScript: "",
                  draftCameraMovement: "Zoom In (Focus In)"
                }))
              }
            : h
        )
      );

      let currentSequentialRef: string | undefined = referenceImage;

      for (let i = 0; i < prompts.length; i++) {
        // DEDUCTION FIRST: Image generating label. Logic avoids double-charging by assigning source-specific label.
        let action: any =
          source === "storybook"
            ? "STORYBOOK_SCENE"
            : activeImageModel === "gemini-3-pro-image-preview"
              ? "IMAGE_PRO"
              : "IMAGE_NORMAL";

        await consumeCredits(action as any);
        if (referenceImage) await consumeCredits("IMAGE_EDIT_PRO");

        const activeRef =
          source === "storybook" && i > 0
            ? currentSequentialRef
            : referenceImage;

        const { src, error } = await generateSingleImage(
          prompts[i],
          aspectRatio,
          selectedCountry,
          visualStyle,
          "General",
          characters,
          activeImageModel,
          activeRef
        );
        if (src) currentSequentialRef = src;

        const updatedScene = {
          sceneId: `scene-${sessionId}-${i}`,
          src,
          error,
          status: error ? "error" : "complete",
          variants: src
            ? [{ src, prompt: prompts[i], angleName: "Original" }]
            : [],
          selectedVariantIndex: 0,
          originSessionId: sessionId,
          originSection:
            source === "storybook"
              ? "StorybookSection"
              : source === "footage"
                ? "FootageFrontSection"
                : "FootageFrontSection"
        };

        setHistory((prev) =>
          prev.map((h) =>
            h.id === sessionId
              ? {
                  ...h,
                  imageSet: h.imageSet.map((s: any, idx: number) =>
                    idx === i ? updatedScene : s
                  )
                }
              : h
          )
        );
        if (source === "footage")
          setFootageHistory((prev) => [updatedScene, ...prev]);
      }
    } catch (e: any) {
      console.error(e);
      setIsGenerating(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateScene = async (genId: number, sceneId: string) => {
    const sessionId = genId;
    const session = history.find((h) => h.id === sessionId);
    if (!session) return;

    const sceneIndex = session.imageSet.findIndex(
      (s: any) => s.sceneId === sceneId
    );
    if (sceneIndex === -1) return;

    const currentScene = session.imageSet[sceneIndex];
    const prompt = currentScene.prompt;

    let refImage = null;
    if (sceneIndex > 0) {
      refImage = session.imageSet[sceneIndex - 1].src;
    }

    if (creditSettings.creditBalance < 1) return;

    // DO add comment: Fixed status update. Removed illegal references to src/error before API call.
    setHistory((prev) =>
      prev.map((h) =>
        h.id === genId
          ? {
              ...h,
              imageSet: h.imageSet.map((s: any) =>
                s.sceneId === sceneId ? { ...s, status: "generating" } : s
              )
            }
          : h
      )
    );

    try {
      // DEDUCTION FIRST: Image generated label.
      await consumeCredits("IMAGE_NORMAL");

      const { src, error } = await generateSingleImage(
        prompt,
        aspectRatio,
        selectedCountry,
        visualStyle,
        "General",
        characters,
        imageModel,
        refImage
      );

      setHistory((prev) =>
        prev.map((h) =>
          h.id === genId
            ? {
                ...h,
                imageSet: h.imageSet.map((s: any) => {
                  if (s.sceneId === sceneId) {
                    return {
                      ...s,
                      src: src || s.src,
                      error,
                      status: error ? "error" : "complete",
                      variants: src
                        ? [
                            ...(s.variants || []),
                            { src, prompt, angleName: "Regenerated" }
                          ]
                        : s.variants,
                      selectedVariantIndex: src
                        ? s.variants?.length || 0
                        : s.selectedVariantIndex
                    };
                  }
                  return s;
                })
              }
            : h
        )
      );
    } catch (e) {
      setHistory((prev) =>
        prev.map((h) =>
          h.id === genId
            ? {
                ...h,
                imageSet: h.imageSet.map((s: any) =>
                  s.sceneId === sceneId
                    ? { ...s, status: "error", error: "Regeneration failed" }
                    : s
                )
              }
            : h
        )
      );
    }
  };

  const handleFootageProduce = async (
    prompt: string,
    mode: "image" | "video" | "i2i",
    refImage?: string,
    videoTier?: string,
    imageTier?: string
  ) => {
    const modelToUse =
      imageTier === "pro"
        ? "gemini-3-pro-image-preview"
        : "gemini-2.5-flash-image";

    const ethnicityContext =
      characterStyle === "Afro-toon"
        ? "Subject: African/Black person."
        : `Subject: Person from ${selectedCountry}.`;
    const styleContext = `Visual Medium: [${visualStyle}].`;
    const finalPrompt = `${styleContext} ${ethnicityContext} Location: ${selectedCountry}. Scene Description: ${prompt}`;

    await handleGenerate([finalPrompt], "footage", refImage, modelToUse);
  };

  const handleAnimateFootage = async (item: any) => {
    await ensureApiKey();
    const action = videoModel.includes("fast") ? "VIDEO_FAST" : "VIDEO_HQ";

    setFootageHistory((prev) =>
      prev.map((f) =>
        f.sceneId === item.sceneId ? { ...f, videoStatus: "loading" } : f
      )
    );
    try {
      // DEDUCTION FIRST: Video label.
      await consumeCredits(action as any);

      const { videoUrl, videoObject } = await generateVideoFromScene(
        { src: item.src, prompt: item.prompt },
        aspectRatio,
        item.prompt,
        null,
        visualStyle,
        selectedCountry,
        videoModel,
        videoResolution as any,
        "Zoom In",
        () => {},
        characters
      );
      if (videoUrl) {
        setFootageHistory((prev) =>
          prev.map((f) =>
            f.sceneId === item.sceneId
              ? {
                  ...f,
                  videoStatus: "complete",
                  videoClips: [
                    ...(f.videoClips || []),
                    { videoUrl, videoObject }
                  ]
                }
              : f
          )
        );
      }
    } catch (e) {
      setFootageHistory((prev) =>
        prev.map((f) =>
          f.sceneId === item.sceneId ? { ...f, videoStatus: "error" } : f
        )
      );
    }
  };

  const handleApplyCameraAngle = async (angle: string, subject?: string) => {
    if (!modalData.genId || !modalData.sceneId) return;
    const sess = history.find((h) => h.id === modalData.genId);
    const scene = sess?.imageSet.find(
      (s: any) => s.sceneId === modalData.sceneId
    );
    if (!scene || !sess) return;

    setIsGenerating(true);
    setActiveModal(null);

    try {
      // DEDUCTION FIRST: Everything label (Camera angle specific).
      await consumeCredits("IMAGE_CAMERA_ANGLE_PRO");

      const focusDirective = subject
        ? ` focusing specifically on ${subject}`
        : "";
      const prompt = `A ${angle}${focusDirective}. Re-render the existing scene with a new camera placement. Maintain environment and subject identical.`;

      const { src, error } = await generateSingleImage(
        prompt,
        sess.aspectRatio,
        selectedCountry,
        sess.visualStyle,
        "General",
        characters,
        imageModel,
        scene.src,
        null
      );

      if (src) {
        handleAddSceneVariant(
          modalData.genId,
          modalData.sceneId,
          src,
          prompt,
          angle
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSingleStorybookScene = async (
    index: number,
    model: string
  ) => {
    const scene = storybook.scenes[index];
    if (!scene) return;
    try {
      // DOUBLE CHARGE FIX: Removed direct consumeCredits call here.
      // handleGenerate now handles the source-specific deduction 'STORYBOOK_SCENE'.
      await handleGenerate(
        [scene.imageDescription],
        "storybook",
        undefined,
        model
      );
    } catch (err) {
      console.error(err);
    }
  };

  const masterHistory = useMemo(() => {
    return (history || []).flatMap((h) =>
      (h.imageSet || []).map((s: any) => ({
        ...s,
        originSessionId: h.id,
        timestamp: h.id,
        originSection:
          h.type === "storybook"
            ? "StorybookSection"
            : h.type === "upload"
            ? "UploadedSection"
            : h.type === "timeline"
            ? "TimelineSection"
                : h.type === "footage"
                  ? "FootageFrontSection"
            : "FootageFrontSection"
      }))
    );
  }, [history]);

  const handleUploadStartImage = async (file: File) => {
    try {
      const rawBase64 = await fileToBase64(file);
      const sessionId = Date.now();
      const sceneId = `scene-${sessionId}-0`;
      const newItem = {
        id: sessionId,
        type: "upload",
        prompt: "Manual Upload",
        imageSet: [
          {
            sceneId,
            src: rawBase64,
            status: "complete",
            prompt: "Uploaded Image",
            variants: [
              {
                src: rawBase64,
                prompt: "Original Upload",
                angleName: "Original"
              }
            ],
            selectedVariantIndex: 0,
            originSessionId: sessionId,
            originSection: "UploadedSection"
          }
        ],
        videoStates: [
          {
            status: "idle",
            clips: [],
            draftScript: "",
            draftCameraMovement: "Zoom In (Focus In)"
          }
        ],
        aspectRatio,
        characterStyle: selectedCountry,
        visualStyle,
        isClosed: false
      };
      setHistory((prev) => {
        const next = [...prev, newItem];
        setActiveHistoryIndex(next.length - 1);
        return next;
      });
      setActiveView("storyboard");
    } catch (e) {
      console.error("Upload failed", e);
    }
  };

  const handleCaptureFrame = (base64: string) => {
    const existingTimelineIndex = history.findIndex(
      (h) => h.type === "timeline"
    );

    if (existingTimelineIndex !== -1) {
      const existingSess = history[existingTimelineIndex];
      const sceneId = `scene-${existingSess.id}-${existingSess.imageSet.length}`;
      const newScene = {
        sceneId,
        src: base64,
        status: "complete",
        prompt: "Timeline Frame",
        variants: [{ src: base64, prompt: "Snap", angleName: "Timeline" }],
        selectedVariantIndex: 0,
        originSessionId: existingSess.id,
        originSection: "TimelineSection"
      };
      const newVideoState = {
        status: "idle",
        clips: [],
        draftScript: "",
        draftCameraMovement: "Zoom In (Focus In)"
      };

      setHistory((prev) =>
        prev.map((h, i) =>
          i === existingTimelineIndex
            ? {
                ...h,
                imageSet: [...h.imageSet, newScene],
                videoStates: [
                  ...h.videoStates,
                  {
                    status: "idle",
                    clips: [],
                    draftScript: "",
                    draftCameraMovement: "Zoom In (Focus In)"
                  }
                ],
                isClosed: false
              }
            : h
        )
      );
      setActiveHistoryIndex(existingTimelineIndex);
    } else {
      const sessionId = Date.now();
      const sceneId = `scene-${sessionId}-0`;
      const newItem = {
        id: sessionId,
        type: "timeline",
        prompt: "Timeline Snap",
        imageSet: [
          {
            sceneId,
            src: base64,
            status: "complete",
            prompt: "Timeline Frame",
            variants: [{ src: base64, prompt: "Snap", angleName: "Timeline" }],
            selectedVariantIndex: 0,
            originSessionId: sessionId,
            originSection: "TimelineSection"
          }
        ],
        videoStates: [
          {
            status: "idle",
            clips: [],
            draftScript: "",
            draftCameraMovement: "Zoom In (Focus In)"
          }
        ],
        aspectRatio,
        characterStyle: selectedCountry,
        visualStyle,
        isClosed: false
      };
      setHistory((prev) => {
        const next = [...prev, newItem];
        setActiveHistoryIndex(next.length - 1);
        return next;
      });
    }
    setActiveView("storyboard");
  };

  const handleToggleSave = (card: any) => {
    const sceneIdToMatch = card.sceneId || card.id;
    const isSaved = savedScenes.some(
      (s) => (s.sceneId || s.id) === sceneIdToMatch
    );
    if (isSaved) {
      setSavedScenes((prev) =>
        prev.filter((s) => (s.sceneId || s.id) !== sceneIdToMatch)
      );
    } else {
      setSavedScenes((prev) => [
        ...prev,
        {
          ...card,
          id:
            card.id || `${card.originSessionId || Date.now()}-${sceneIdToMatch}`
        }
      ]);
    }
  };

  const handleDeleteScene = (genId: number, sceneId: string) => {
    setHistory((prev) => {
      const newHistory = prev.map((h) => {
        if (h.id !== genId) return h;
        const updatedImageSet = h.imageSet.map((s: any) =>
          s.sceneId === sceneId ? { ...s, isHidden: true } : s
        );
        const hasVisible = updatedImageSet.some((s: any) => !s.isHidden);
        return { ...h, imageSet: updatedImageSet, isClosed: !hasVisible };
      });

      const currentSession = newHistory.find((h) => h.id === genId);
      if (currentSession?.isClosed) {
        const nextOpenIdx = newHistory.findIndex((h) => !h.isClosed);
        setActiveHistoryIndex(nextOpenIdx);
      }
      return newHistory;
    });
  };

  const handleLoadHistory = (
    index: number,
    sceneId?: string,
    restore?: boolean
  ) => {
    if (index === -1) return;
    setHistory((prev) =>
      prev.map((h, i) => {
        if (i !== index) return h;
        return {
          ...h,
          isClosed: false,
          imageSet: h.imageSet.map((s: any) =>
            s.sceneId === sceneId || !sceneId ? { ...s, isHidden: false } : s
          )
        };
      })
    );
    setActiveHistoryIndex(index);
    setActiveView("storyboard");
    setActiveModal(null);
  };

  const handleUploadToSession = async (file: File, sessionId: number) => {
    try {
      const rawBase64 = await fileToBase64(file);
      setHistory((prev) =>
        prev.map((h) =>
          h.id === sessionId
            ? {
                ...h,
                isClosed: false,
                imageSet: [
                  ...h.imageSet,
                  {
                    sceneId: `scene-${sessionId}-${h.imageSet.length}`,
                    src: rawBase64,
                    status: "complete",
                    prompt: "Uploaded Image",
                    variants: [
                      {
                        src: rawBase64,
                        prompt: "Original Upload",
                        angleName: "Original"
                      }
                    ],
                    selectedVariantIndex: 0,
                    originSessionId: sessionId,
                    originSection: "UploadedSection"
                  }
                ],
                videoStates: [
                  ...h.videoStates,
                  {
                    status: "idle",
                    clips: [],
                    draftScript: "",
                    draftCameraMovement: "Zoom In (Focus In)"
                  }
                ]
              }
            : h
        )
      );
    } catch (e) {
      console.error("Upload to session failed", e);
    }
  };

  const handleUndoEdit = (genId: number, sceneId: string) => {
    setHistory((prev) =>
      prev.map((h) =>
        h.id === genId
          ? {
              ...h,
              imageSet: h.imageSet.map((s: any) => {
                if (
                  s.sceneId !== sceneId ||
                  !s.variants ||
                  s.variants.length <= 1
                )
                  return s;
                const newVariants = s.variants.slice(0, -1);
                const prevVariant = newVariants[newVariants.length - 1];
                return {
                  ...s,
                  src: prevVariant.src,
                  variants: newVariants,
                  selectedVariantIndex: newVariants.length - 1
                };
              })
            }
          : h
      )
    );
  };

  const handleAddSceneVariant = (
    genId: number,
    sceneId: string,
    src: string,
    prompt: string,
    angleName: string
  ) => {
    setHistory((prev) =>
      prev.map((h) =>
        h.id === genId
          ? {
              ...h,
              imageSet: h.imageSet.map((s: any) =>
                s.sceneId === sceneId
                  ? {
                      ...s,
                      src: src,
                      variants: [
                        ...(s.variants || []),
                        { src, prompt, angleName }
                      ],
                      selectedVariantIndex: s.variants?.length || 0
                    }
                  : s
              )
            }
          : h
      )
    );
  };

  // DO add comment above each fix. Removed duplicate definition of handleSelectSceneVariant.
  const handleSelectSceneVariant = (
    genId: number,
    sceneId: string,
    variantIndex: number
  ) => {
    setHistory((prev) =>
      prev.map((h) =>
        h.id === genId
          ? {
              ...h,
              imageSet: h.imageSet.map((s: any) =>
                s.sceneId === sceneId
                  ? {
                      ...s,
                      src: s.variants[variantIndex].src,
                      selectedVariantIndex: variantIndex
                    }
                  : s
              )
            }
          : h
      )
    );
  };

  const handleUpdateSceneImage = (
    genId: number,
    sceneId: string,
    base64: string
  ) => {
    setHistory((prev) =>
      prev.map((h) =>
        h.id === genId
          ? {
              ...h,
              imageSet: h.imageSet.map((s: any) => {
                if (s.sceneId !== sceneId) return s;
                const vIdx = s.variants?.findIndex(
                  (v: any) => v.src === base64
                );
                if (vIdx !== -1 && vIdx !== undefined) {
                  return { ...s, src: base64, selectedVariantIndex: vIdx };
                }
                return { ...s, src: base64 };
              })
            }
          : h
      )
    );
  };

  // SEQUENTIAL LINE ORDER LOGIC: New assets start where the previous track content ends.
  const onAddTimelineClip = useCallback(
    (
      url: string,
      type: "video" | "image",
      duration?: number,
      startTime?: number,
      layer?: number,
      videoObject?: any
    ) => {
      const actualDuration = Number(duration) || 5;
      // FIX: DEFAULT TO LAYER 0 (V1) AS MAIN LINE
      const l = layer !== undefined ? Number(layer) : 0;

      setTimelineClips((prev) => {
        let start = 0;
        if (startTime !== undefined) {
          start = Number(startTime);
        } else {
          // Find end of current layer to append
          const sameLayerClips = prev.filter((c) => Number(c.layer) === l);
          start = sameLayerClips.reduce(
            (max, c) =>
              Math.max(
                max,
                (Number(c.startTime) || 0) + (Number(c.duration) || 0)
              ),
            0
          );
        }

        return [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            url,
            type,
            duration: actualDuration,
            startTime: start,
            originalDuration: actualDuration,
            layer: l,
            isMuted: false,
            volume: 1,
            fadeInDuration: 0,
            fadeOutDuration: 0,
            videoObject
          }
        ];
      });
    },
    []
  );

  const onAddAudioClip = useCallback(
    (url: string, duration?: number, startTime?: number) => {
      const actualDuration = Number(duration) || 10;
      setAudioClips((p) => {
        let start = 0;
        if (startTime !== undefined) {
          start = Number(startTime);
        } else {
          // Sequential append for audio
          start = p.reduce(
            (max, a) =>
              Math.max(
                max,
                (Number(a.startTime) || 0) + (Number(a.duration) || 0)
              ),
            0
          );
        }
        return [
          ...p,
          {
            id: "audio-" + Date.now().toString(),
            url,
            duration: actualDuration,
            startTime: start,
            originalDuration: actualDuration,
            isMuted: false,
            volume: 1,
            fadeInDuration: 0.5,
            fadeOutDuration: 0.5
          }
        ];
      });
    },
    []
  );

  const onAddTextClip = useCallback((text: string, startTime?: number) => {
    setTextClips((p) => {
      let start = 0;
      if (startTime !== undefined) {
        start = Number(startTime);
      } else {
        // Sequential append for text
        start = p.reduce(
          (max, t) =>
            Math.max(
              max,
              (Number(t.startTime) || 0) + (Number(t.duration) || 0)
            ),
          0
        );
      }
      return [
        ...p,
        {
          id: "text-" + Date.now().toString(),
          text,
          startTime: start,
          duration: 4,
          bgColor: "#000000",
          bgOpacity: 0.8,
          fadeInDuration: 0.8,
          fadeOutDuration: 0.5,
          transition: "none"
        }
      ];
    });
  }, []);

  const handleGenerateVideo = async (
    genId: number,
    sceneId: string,
    script?: string,
    cameraMovement?: string,
    withAudio?: boolean
  ) => {
    await ensureApiKey();
    const action = videoModel.includes("fast") ? "VIDEO_FAST" : "VIDEO_HQ";
    
    const item = history.find((h) => h.id === genId);
    const sceneIdx = item.imageSet.findIndex((s: any) => s.sceneId === sceneId);
    setHistory((prev) =>
      prev.map((h) =>
        h.id === genId
          ? {
              ...h,
              videoStates: h.videoStates.map((vs: any, idx: number) =>
                idx === sceneIdx ? { ...vs, status: "loading" } : vs
              )
            }
          : h
      )
    );
    try {
      // DEDUCTION FIRST: Video production label.
      await consumeCredits(action as any);
      if (withAudio) await consumeCredits("VIDEO_ADD_AUDIO");

      const { videoUrl, videoObject } = await generateVideoFromScene(
        item.imageSet[sceneIdx],
        aspectRatio,
        item.imageSet[sceneIdx].prompt,
        null,
        visualStyle,
        selectedCountry,
        videoModel,
        videoResolution as any,
        cameraMovement || "Zoom In",
        () => {},
        characters
      );
      if (videoUrl) {
        setHistory((prev) =>
          prev.map((h) =>
            h.id === genId
              ? {
                  ...h,
                  videoStates: h.videoStates.map((vs: any, idx: number) =>
                    idx === sceneIdx
                      ? {
                          ...vs,
                          status: "complete",
                          clips: [
                            ...(vs.clips || []),
                            { videoUrl, videoObject }
                          ]
                        }
                      : vs
                  )
                }
              : h
          )
        );
        const currentEnd = Math.max(
          0,
          ...timelineClips.map((c) => (c.startTime || 0) + c.duration)
        );
        setTimelineClips((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            url: videoUrl,
            duration: 8,
            startTime: currentEnd,
            originalDuration: 8,
            videoObject,
            isMuted: false
          }
        ]);
        
      }
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes("Requested entity was not found")) {
        await window.aistudio.openSelectKey();
      }
      setHistory((prev) =>
        prev.map((h) =>
          h.id === genId
            ? {
                ...h,
                videoStates: h.videoStates.map((vs: any, idx: number) =>
                  idx === sceneIdx ? { ...vs, status: "idle" } : vs
                )
              }
            : h
        )
      );
    }
  };

  const handleClearHistory = useCallback(() => {
    setHistory((prev) => {
      const filteredHistory = prev
        .map((session) => {
          const newImageSet: any[] = [];
          const newVideoStates: any[] = [];

          (session.imageSet || []).forEach((img: any, idx: number) => {
            const isSaved = savedScenes.some(
              (s) => (s.sceneId || s.id) === img.sceneId
            );
            const isActiveOnStage = !session.isClosed && !img.isHidden;

            if (isSaved || isActiveOnStage) {
              newImageSet.push(img);
              if (session.videoStates && session.videoStates[idx]) {
                newVideoStates.push(session.videoStates[idx]);
              }
            }
          });

          if (newImageSet.length === 0) return null;

          return {
            ...session,
            imageSet: newImageSet,
            videoStates: newVideoStates
          };
        })
        .filter(Boolean);

      const activeSessionId = prev[activeHistoryIndex]?.id;
      const nextActiveIdx = filteredHistory.findIndex(
        (h) => h.id === activeSessionId
      );
      setActiveHistoryIndex(nextActiveIdx);

      return filteredHistory;
    });
  }, [savedScenes, activeHistoryIndex]);

  // --- Sub-View Renderers ---
  const renderRoster = () => (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-gray-800">
      <div className="max-w-5xl mx-auto w-full">
        <ActorRoster
          characters={characters}
          setCharacters={setCharacters}
          handleBuildCharacterVisual={async (id) => {
            const char = characters.find((c) => c.id === id);
            if (!char) return;
            setCharacters((prev) =>
              prev.map((c) => (c.id === id ? { ...c, isDescribing: true } : c))
            );
            try {
              // DEDUCTION FIRST: Everything label (Character generation).
              await consumeCredits("CHARACTER_IMAGE");

              const { src, error } = await generateCharacterVisual(
                char,
                visualStyle,
                characterStyle,
                selectedCountry
              );
              if (src) {
                const { description } = await generateCharacterDescription(
                  src,
                  "image/png"
                );
                setCharacters((prev) =>
                  prev.map((c) =>
                    c.id === id
                      ? {
                          ...c,
                          imagePreview: `data:image/png;base64,${src}`,
                          description,
                          detectedImageStyle: null
                        }
                      : c
                  )
                );
              } else if (error)
                setCharacters((prev) =>
                  prev.map((c) =>
                    c.id === id ? { ...c, detectedImageStyle: error } : c
                  )
                );
            } catch (e) {
              console.error(e);
            } finally {
              setCharacters((prev) =>
                prev.map((c) =>
                  c.id === id ? { ...c, isDescribing: false } : c
                )
              );
            }
          }}
          handleUploadNewCharacterImage={async (f) => {
            const base64 = await fileToBase64(f);
            const tempId = Date.now();
            const newChar: Character = {
              id: tempId,
              name: "Scanning Identity...",
              imagePreview: `data:${f.type};base64,${base64}`,
              originalImageBase64: base64,
              originalImageMimeType: f.type,
              description: null,
              detectedImageStyle: null,
              isDescribing: false,
              isAnalyzing: true,
              isHero: false
            };
            setCharacters((prev) => [...prev, newChar]);
            try {
              // DEDUCTION FIRST: Everything label (Character import scan).
              await consumeCredits("CHARACTER_IMAGE");

              const {  description, detectedStyle } =
                await generateCharacterDescription(base64, f.type);
              setCharacters((prev) =>
                prev.map((c) =>
                  c.id === tempId
                    ? {
                        ...c,
                        
                        description,
                        detectedImageStyle: detectedStyle,
                        isAnalyzing: false
                      }
                    : c
                )
              );
            } catch {
              setCharacters((prev) =>
                prev.map((c) =>
                  c.id === tempId
                    ? { ...c, name: "Actor Entry", isAnalyzing: false }
                    : c
                )
              );
            }
          }}
          handleCharacterImageUpload={async (f, id) => {
            const base64 = await fileToBase64(f);
            setCharacters((prev) =>
              prev.map((c) => (c.id === id ? { ...c, isAnalyzing: true } : c))
            );
            try {
              // DEDUCTION FIRST: Everything label (Character update scan).
              await consumeCredits("CHARACTER_IMAGE");

              const { description, detectedStyle } =
                await generateCharacterDescription(base64, f.type);
              setCharacters((prev) =>
                prev.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        imagePreview: `data:${f.type};base64,${base64}`,
                        originalImageBase64: base64,
                        originalImageMimeType: f.type,
                        description,
                        detectedImageStyle: detectedStyle,
                        isAnalyzing: false
                      }
                    : c
                )
              );
            } catch {
              setCharacters((prev) =>
                prev.map((c) =>
                  c.id === id ? { ...c, isAnalyzing: false } : c
                )
              );
            }
          }}
          updateCharacter={(id, p) =>
            setCharacters((prev) =>
              prev.map((c) => (c.id === id ? { ...c, ...p } : c))
            )
          }
          removeCharacter={(id) =>
            setCharacters((prev) => prev.filter((c) => c.id !== id))
          }
          onToggleHero={(id) =>
            setCharacters((prev) =>
              prev.map((c) => ({
                ...c,
                isHero: c.id === id ? !c.isHero : false
              }))
            )
          }
          visualStyle={visualStyle}
        />
      </div>
    </div>
  );

  const renderStorybook = () => (
    <StorybookCreator
      storybookContent={storybook}
      setStorybookContent={setStorybook}
      characters={characters}
      characterStyle={characterStyle}
      selectedCountry={selectedCountry}
      creditBalance={creditSettings.creditBalance}
      onClose={() =>
        setActiveView(layoutMode === "phone" ? "menu" : "storybook")
      }
      onGenerateFromStorybook={(scenes) => handleGenerate(scenes, "storybook")}
      onGenerateSingleStorybookScene={handleGenerateSingleStorybookScene}
      onResetStorybook={() =>
        setStorybook({
          title: "",
          characters: [],
          storyNarrative: "",
          scenes: [],
          includeDialogue: true
        })
      }
      storySeed={storySeed}
      setStorySeed={setStorySeed}
      onAddAudioToTimeline={onAddAudioClip}
      onAddAudioClip={onAddAudioClip}
      onDeductAudioCredit={async () => {
        try {
          await consumeCredits("AUDIO_GENERIC");
          return true;
        } catch (e) {
          return false;
        }
      }}
    />
  );

  const renderStoryboard = () => (
    <Storyboard
      generationItem={
        activeHistoryIndex !== -1 ? history[activeHistoryIndex] : null
      }
      savedItems={savedScenes}
      history={history}
      historyIndex={activeHistoryIndex}
      onSaveScene={(gid, sid) => {
        const sess = history.find((h) => h.id === gid);
        const img = sess?.imageSet.find((s: any) => s.sceneId === sid);
        if (img) handleToggleSave(img);
      }}
      onEditScene={(gid, sid) => {
        const sess = history.find((h) => h.id === gid);
        const img = sess?.imageSet.find((s: any) => s.sceneId === sid);
        setModalData({
          genId: gid,
          sceneId: sid,
          src: img.src,
          variants: img.variants || []
        });
        setActiveModal("edit-image");
      }}
      onRegenerateScene={handleRegenerateScene}
      onAngleSelect={(gid, sid) => {
        const sess = history.find((h) => h.id === gid);
        const img = sess?.imageSet.find((s: any) => s.sceneId === sid);
        setModalData({ genId: gid, sceneId: sid, src: img.src });
        setActiveModal("camera-angles");
      }}
      onOpenVideoCreator={(idx) =>
        setActiveVideoIndices((prev) =>
          prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
        )
      }
      onGenerateVideo={handleGenerateVideo}
      onAddToTimeline={(url, dur, obj) =>
        setTimelineClips((prev) => {
          const end = Math.max(
            0,
            ...prev.map((c) => (c.startTime || 0) + c.duration)
          );
          return [
            ...prev,
            {
              id: Date.now().toString(),
              url,
              duration: dur || 8,
              startTime: end,
              originalDuration: dur || 8,
              videoObject: obj,
              isMuted: false
            }
          ];
        })
      }
      isGenerating={isGenerating}
      isDisabled={false}
      activeVideoIndices={activeVideoIndices}
      videoModel={videoModel}
      setVideoModel={setVideoModel}
      setVideoResolution={setVideoResolution}
      onPreviewImage={(src) => {
        setModalData({ src });
        setActiveModal("image-preview");
      }}
      onSwitchSession={handleLoadHistory}
      onNewSession={() => setActiveHistoryIndex(-1)}
      onUpdateVideoDraft={(gid, sid, upd) =>
        setHistory((prev) =>
          prev.map((h) =>
            h.id === gid
              ? {
                  ...h,
                  videoStates: h.videoStates.map((vs: any, idx: number) =>
                    h.imageSet[idx].sceneId === sid ? { ...vs, ...upd } : vs
                  )
                }
              : h
          )
        )
      }
      creditBalance={creditSettings.creditBalance}
      currency="USD"
      activeI2ISlot={activeI2ISlot}
      setActiveI2ISlot={setActiveI2ISlot}
      onUploadStartImage={handleUploadStartImage}
      onUploadToSession={handleUploadToSession}
      onStop={() => setIsGenerating(false)}
      onDeleteScene={handleDeleteScene}
      onUndoEdit={handleUndoEdit}
      storybook={storybook}
      onSceneVariantChange={(gid, sid, dir) => {
        const hIdx = history.findIndex((h) => h.id === gid);
        if (hIdx === -1) return;
        const scene = history[hIdx].imageSet.find(
          (s: any) => s.sceneId === sid
        );
        if (!scene || !scene.variants) return;
        const cur = scene.selectedVariantIndex || 0;
        let nextIdx = dir === "next" ? cur + 1 : cur - 1;
        if (nextIdx < 0) nextIdx = scene.variants.length - 1;
        if (nextIdx >= scene.variants.length) nextIdx = 0;
        handleSelectSceneVariant(gid, sid, nextIdx);
      }}
    />
  );

  const renderTimeline = () => (
    <Timeline
      clips={timelineClips}
      audioClips={audioClips}
      textClips={textClips}
      onUpdateClips={setTimelineClips}
      onUpdateAudioClips={setAudioClips}
      onUpdateTextClips={setTextClips}
      onDelete={(id) => setTimelineClips((p) => p.filter((c) => c.id !== id))}
      onDeleteAudio={(id) => setAudioClips((p) => p.filter((c) => c.id !== id))}
      onUpdateClip={(id, u) =>
        setTimelineClips((p) =>
          p.map((c) => (c.id === id ? { ...c, ...u } : c))
        )
      }
      onUpdateAudioClip={(id, u) =>
        setAudioClips((p) => p.map((c) => (c.id === id ? { ...c, ...u } : c)))
      }
      onExport={() => {
        setModalData({ clips: timelineClips });
        setActiveModal("export-video");
      }}
      onAddClip={onAddTimelineClip}
      onAddAudioClip={onAddAudioClip}
      onAddTextClip={onAddTextClip}
      onCaptureFrame={handleCaptureFrame}
      onUndo={handleTimelineUndo}
      playbackTime={timelinePlaybackTime}
      onUpdatePlaybackTime={setTimelinePlaybackTime}
    />
  );

  const renderFootageDesk = () => (
    <Footage
      characters={characters}
      visualStyle={visualStyle}
      aspectRatio={aspectRatio}
      characterStyle={characterStyle}
      selectedCountry={selectedCountry}
      onProduce={handleFootageProduce}
      isGenerating={isGenerating}
      creditBalance={creditSettings.creditBalance}
      footageHistory={footageHistory}
      onSaveItem={handleToggleSave}
      onDeleteItem={(sid) =>
        setFootageHistory((prev) => prev.filter((f) => f.sceneId !== sid))
      }
      onToTimeline={(item) => {
        const url =
          item.videoClips?.[0]?.videoUrl ||
          (item.src ? `data:image/png;base64,${item.src}` : null);
        if (url)
          onAddTimelineClip(
            url,
            item.videoClips?.length > 0 ? "video" : "image",
            8,
            undefined,
            0
          );
      }}
      onAnimate={handleAnimateFootage}
      onUpdateCountry={setSelectedCountry}
      savedItems={savedScenes}
      footagePrompt={footagePrompt}
      setFootagePrompt={setFootagePrompt}
      footageMode={footageMode}
      setFootageMode={setFootageMode}
      footageVideoTier={footageVideoTier}
      setFootageVideoTier={setFootageVideoTier}
      footageImageTier={footageImageTier}
      setFootageImageTier={setFootageImageTier}
      footageRefImages={footageRefImages}
      setFootageRefImages={setFootageRefImages}
    />
  );

  const renderHistory = () => (
    <div className="flex-1 overflow-y-auto bg-gray-950 p-4 md:p-8 scrollbar-thin scrollbar-thumb-gray-800">
      <HistoryPanel
        history={history}
        masterHistory={masterHistory}
        savedItems={savedScenes}
        onClose={() =>
          setActiveView(layoutMode === "desktop" ? "storybook" : "menu")
        }
        onLoadHistory={handleLoadHistory}
        onClearHistory={handleClearHistory}
        onToggleSave={handleToggleSave}
      />
    </div>
  );

  const renderCredits = () => (
    <div className="flex-1 h-full overflow-y-auto bg-gray-950 p-4 sm:p-8 scrollbar-thin scrollbar-thumb-gray-800">
      <div className="max-w-5xl mx-auto flex flex-col items-center animate-in fade-in zoom-in-95 duration-500 origin-top">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-white italic tracking-tighter mb-2 uppercase leading-none">
            Studio Top-Up
          </h2>
          <div className="inline-flex flex-col items-center gap-4">
            {/* GIFT TOGGLE SYSTEM */}
            <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10 shadow-inner">
              {/* DO add comment: Corrected state variable 'isGifting' to 'isGiftMode' */}
              <button
                onClick={() => setIsGiftMode(false)}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isGiftMode ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
              >
                Account Recharge
              </button>
              <button
                onClick={() => setIsGiftMode(true)}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isGiftMode ? "bg-amber-500 text-black shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
              >
                <GiftIcon className="w-4 h-4" /> Gift Someone
              </button>
            </div>

            {isGiftMode && (
              <div className="w-full max-w-md animate-in slide-in-from-top-4 duration-500">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] block ml-2">
                    Recipient Email Address
                  </label>
                  <div className="relative group">
                    <input
                      type="email"
                      value={giftRecipientEmail}
                      onChange={(e) => setGiftRecipientEmail(e.target.value)}
                      placeholder="registered-user@studio.com"
                      className="w-full bg-black/40 border border-amber-500/30 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all placeholder-gray-800 text-sm shadow-inner group-hover:border-amber-500/50"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                      <span className="text-[8px] font-black text-amber-500/50 uppercase tracking-widest">
                        Registered User Required
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isGiftMode && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600/10 border border-indigo-500/30 rounded-full">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">
              Pay-As-You-Produce • NOT a subscription
            </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-10">
          <div
            className={`${isGiftMode ? "bg-[#1e1a0f] border-amber-500/20" : "bg-[#0f172a] border-sky-500/20"} border rounded-2xl p-6 flex flex-col items-center text-center transition-all hover:scale-[1.02] shadow-xl group`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 border transition-all ${isGiftMode ? "bg-amber-600/10 border-amber-500/20 text-amber-500 group-hover:bg-amber-600 group-hover:text-black" : "bg-sky-600/10 border-sky-500/20 text-sky-400 group-hover:bg-sky-600 group-hover:text-white"}`}
            >
              <CreditCardIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white mb-1 italic tracking-tighter uppercase leading-none">
              {isGiftMode ? "Gift Pack: Line Up" : "Line Up"}
            </h3>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-black text-white tracking-tighter">
                $12
              </span>
              <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                One-time
              </span>
            </div>
            <a
              href={PAYPAL_STARTER_LINK}
              target="_blank"
              className={`w-full py-4 font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg mb-6 transition-colors ${isGiftMode ? "bg-amber-600 text-black hover:bg-amber-500" : "bg-sky-600 text-white hover:bg-sky-500"}`}
            >
              {isGiftMode ? "Gift 100 Credits" : "Purchase Now"}
            </a>
            <div className="w-full space-y-2 text-left border-t border-white/5 pt-4">
              <div
                className={`flex items-center gap-2 ${isGiftMode ? "text-amber-400" : "text-sky-300"}`}
              >
                <CheckIcon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  100 Credits
                </span>
              </div>
            </div>
          </div>

          <div
            className={`border-2 rounded-2xl flex flex-col items-center text-center shadow-[0_0_40px_rgba(255,255,255,0.05)] relative overflow-hidden group transition-all ${isGiftMode ? "bg-[#221c0e] border-amber-500/30" : "bg-[#111827] border-white/20"}`}
          >
            <div
              className={`w-full text-[8px] font-black py-1.5 uppercase tracking-[0.2em] shrink-0 ${isGiftMode ? "bg-amber-500 text-black" : "bg-white text-black"}`}
            >
              MOST POPULAR GIFT
            </div>
            <div className="p-6 pt-2 flex flex-col items-center w-full">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mt-3 mb-4 shadow-lg transition-all ${isGiftMode ? "bg-amber-600 text-black" : "bg-white text-indigo-950"}`}
              >
                {isGiftMode ? (
                  <GiftIcon className="w-6 h-6" />
                ) : (
                  <SparklesIcon className="w-6 h-6" />
                )}
            </div>
              <h3 className="text-xl font-black text-white mb-1 italic tracking-tighter uppercase leading-none">
                {isGiftMode ? "Gift Pack: Production" : "Production"}
            </h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-black text-white tracking-tighter">
                $25
              </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">
                Best Value
              </span>
            </div>
            <a
                href={PAYPAL_PRO_LINK}
              target="_blank"
                className={`w-full py-4 font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg mb-6 transition-all ${isGiftMode ? "bg-amber-600 text-black hover:bg-amber-500" : "bg-white text-black hover:bg-gray-200"}`}
            >
                {isGiftMode ? "Gift 300 Credits" : "Fuel Vision"}
            </a>
              <div className="w-full space-y-2 text-left border-t border-white/10 pt-4">
                <div
                  className={`flex items-center gap-2 ${isGiftMode ? "text-amber-400" : "text-white"}`}
                >
                  <CheckIcon
                    className={`w-4 h-4 shrink-0 ${isGiftMode ? "text-amber-400" : "text-white"}`}
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    300 Credits
                </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`${isGiftMode ? "bg-[#1e1a0f] border-amber-500/20" : "bg-[#0f172a] border-sky-500/20"} border rounded-2xl p-6 flex flex-col items-center text-center transition-all hover:scale-[1.02] shadow-xl group`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 border transition-all ${isGiftMode ? "bg-amber-600/10 border-amber-500/20 text-amber-500 group-hover:bg-amber-600 group-hover:text-black" : "bg-sky-600/10 border-sky-500/20 text-sky-400 group-hover:bg-sky-600 group-hover:text-white"}`}
            >
              <VideoIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white mb-1 italic tracking-tighter uppercase leading-none">
              {isGiftMode ? "Gift Pack: Studio" : "Studio"}
            </h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-black text-white tracking-tighter">
                $50
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Max Power
              </span>
            </div>
            <a
              href={PAYPAL_STUDIO_LINK}
              target="_blank"
              className={`w-full py-4 font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg mb-6 transition-colors ${isGiftMode ? "bg-amber-600 text-black hover:bg-amber-500" : "bg-amber-600 text-white hover:bg-amber-500"}`}
            >
              {isGiftMode ? "Gift 700 Credits" : "Purchase Now"}
            </a>
            <div className="w-full space-y-2 text-left border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 text-amber-400">
                <CheckIcon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  700 Credits
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-2xl bg-white/[0.02] border border-white/5 rounded-xl p-6 text-center shadow-2xl space-y-3 mb-20">
          <p className="text-gray-500 text-[11px] leading-relaxed font-bold tracking-tight italic">
            freedom, no obligation. from Thetori Ai
          </p>
          <p className="text-indigo-400 text-[9px] sm:text-[10px] leading-relaxed font-black tracking-tight max-w-xl mx-auto italic px-4">
            Are you a content creator wondering how to create consistent
            characters in your movies, but you don't really have the content?
            That's why Thetori Ai is here for you. a trial will convince you.
          </p>
          <div className="pt-2 border-t border-white/5 mt-2">
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.4em]">
              New Account Welcome Bonus: 5 Credits Applied Automatically
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const MobileViewWrapper: React.FC<{
    children: React.ReactNode;
    title: string;
  }> = ({ children, title }) => (
    <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="p-4 border-b border-white/5 bg-[#0a0f1d] flex justify-between items-center shrink-0">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] ml-2">
          {title}
        </h2>
        <button
          onClick={() => setActiveView("menu")}
          className="p-2.5 bg-gray-800 hover:bg-red-900/30 rounded-xl text-gray-400 hover:text-red-400 transition-all"
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );

  if (isAuthChecking)
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  const currentGlowColor = VIEW_COLORS[activeView] || "#6366f1";
  const closeSubPage = () =>
    setActiveView(layoutMode === "phone" ? "menu" : activeView);

  return (
    <div
      className={`flex h-screen bg-gray-950 text-white font-sans overflow-hidden layout-${layoutMode}`}
    >
      {layoutMode !== "phone" && session && activeView !== "welcome" && (
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          visualStyle={visualStyle}
          setVisualStyle={setVisualStyle}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          characterStyle={characterStyle}
          setCharacterStyle={setCharacterStyle}
          selectedCountry={selectedCountry}
          setSelectedCountry={setSelectedCountry}
          onLogout={() => {
            supabase.auth.signOut();
            setActiveView("welcome");
          }}
          creditBalance={creditSettings.creditBalance}
          session={session}
        />
      )}

      <main className="flex-1 h-full overflow-hidden relative flex flex-col bg-gray-950">
        {activeView === "welcome" ? (
          <WelcomePage
            session={session}
            onEnter={() => {
              if (!session) setActiveView("welcome");
              else setActiveView(layoutMode === "phone" ? "menu" : "storybook");
            }}
          />
        ) : (
          <div
            className="flex-1 flex flex-col h-full workspace-artline neon-active-frame"
            style={{ "--glow-color": currentGlowColor } as React.CSSProperties}
          >
            {layoutMode === "phone" ? (
              <div className="flex-1 h-full overflow-hidden flex flex-col">
            {activeView === "menu" && (
              <Sidebar
                activeView={activeView}
                setActiveView={setActiveView}
                visualStyle={visualStyle}
                setVisualStyle={setVisualStyle}
                aspectRatio={aspectRatio}
                setAspectRatio={setAspectRatio}
                characterStyle={characterStyle}
                setCharacterStyle={setCharacterStyle}
                selectedCountry={selectedCountry}
                setSelectedCountry={setSelectedCountry}
                onLogout={() => {
                  supabase.auth.signOut();
                  setActiveView("welcome");
                }}
                creditBalance={creditSettings.creditBalance}
                session={session}
              />
            )}
                {activeView === "roster" && (
                  <MobileViewWrapper title="Character Roster">
                    {renderRoster()}
                  </MobileViewWrapper>
                )}
            {activeView === "storybook" && (
                  <div className="flex-1 h-full overflow-hidden flex flex-col animate-in slide-in-from-right-2 duration-300">
                    <ViewHeader
                      title="Story writer"
                      onBack={closeSubPage}
                      layout={layoutMode}
                    />
                {renderStorybook()}
                  </div>
            )}

            {activeView === "storyboard" && (
                  <div className="flex-1 h-full overflow-hidden flex flex-col animate-in slide-in-from-right-2 duration-300">
                    <ViewHeader
                      title="Production stage"
                      onBack={closeSubPage}
                      layout={layoutMode}
                    />
                {renderStoryboard()}
                  </div>
                )}

                {activeView === "roster" && (
                  <div className="flex-1 h-full overflow-hidden flex flex-col animate-in slide-in-from-right-2 duration-300">
                    <ViewHeader
                      title="Character roster"
                      onBack={closeSubPage}
                      layout={layoutMode}
                    />
                    {renderRoster()}
                  </div>
            )}

            {activeView === "timeline" && (
                  <div className="flex-1 h-full overflow-hidden flex flex-col animate-in slide-in-from-right-2 duration-300">
                    <ViewHeader
                      title="Story timeline"
                      onBack={closeSubPage}
                      layout={layoutMode}
                    />
                {renderTimeline()}
                  </div>
            )}

            {activeView === "history" && (
                  <div className="flex-1 h-full overflow-hidden flex flex-col animate-in slide-in-from-right-2 duration-300">
                    <ViewHeader
                      title="Production history"
                      onBack={closeSubPage}
                      layout={layoutMode}
                    />
                {renderHistory()}
                  </div>
            )}

            {activeView === "buy-credits" && (
                  <div className="flex-1 h-full overflow-hidden flex flex-col animate-in slide-in-from-right-2 duration-300">
                    <ViewHeader
                      title="Get credits"
                      onBack={closeSubPage}
                      layout={layoutMode}
                    />
                {renderCredits()}
                  </div>
            )}

            {activeView === "footage" && (
                  <div className="flex-1 h-full overflow-hidden flex flex-col animate-in slide-in-from-right-2 duration-300">
                    <ViewHeader
                      title="Quick footage desk"
                      onBack={closeSubPage}
                      layout={layoutMode}
                    />
                {renderFootageDesk()}
                  </div>
                )}

                {activeView === "directors-cut" && (
                  <div className="flex-1 h-full overflow-hidden flex flex-col animate-in slide-in-from-right-2 duration-300">
                    <DirectorsCut onClose={() => setActiveView("menu")} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {activeView === "roster" && renderRoster()}
                {activeView === "storybook" && renderStorybook()}
                {activeView === "storyboard" && renderStoryboard()}
                {activeView === "timeline" && renderTimeline()}
                {activeView === "history" && renderHistory()}
                {activeView === "buy-credits" && renderCredits()}
                {activeView === "footage" && renderFootageDesk()}
              </div>
            )}
          </div>
        )}
      </main>

      <Modals
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        modalData={modalData}
        onClose={() => setActiveModal(null)}
        storybookContent={storybook}
        setStorybookContent={setStorybook}
        onGenerateFromStorybook={(s) => handleGenerate(s, "storybook")}
        history={history}
        masterHistory={masterHistory}
        onLoadHistory={handleLoadHistory}
        onClearHistory={handleClearHistory}
        characters={characters}
        creditBalance={creditSettings.creditBalance}
        onEditImage={() => setActiveModal("edit-image")}
        onApplyCameraAngle={handleApplyCameraAngle}
        onUpdateImage={() => {}}
        onResetStorybook={() =>
          setStorybook({
            title: "",
            characters: [],
            storyNarrative: "",
            scenes: [],
            includeDialogue: true
          })
        }
        storySeed={storySeed}
        setStorySeed={setStorySeed}
        savedItems={savedScenes}
        characterStyle={selectedCountry}
        selectedCountry={selectedCountry}
        currencySymbol="$"
        exchangeRate={1}
        costPerImage={1}
        onToggleSave={handleToggleSave}
        timelineClips={timelineClips}
        audioClips={audioClips}
        textClips={textClips}
        onUpdateClips={setTimelineClips}
        onUpdateAudioClips={setAudioClips}
        onUpdateTextClips={setTextClips}
        onUpdateTimelineClip={(id, u) =>
          setTimelineClips((p) =>
            p.map((c) => (c.id === id ? { ...c, ...u } : c))
          )
        }
        onDeleteTimelineClip={(id) =>
          setTimelineClips((p) => p.filter((c) => c.id !== id))
        }
        onDeleteAudio={(id) =>
          setAudioClips((p) => p.filter((ac) => ac.id !== id))
        }
        onAddTimelineClip={onAddTimelineClip}
        onAddAudioClip={onAddAudioClip}
        onAddTextClip={onAddTextClip}
        onCaptureFrameFromTimeline={handleCaptureFrame}
        onExportTimeline={() => {
          setModalData({ clips: timelineClips });
          setActiveModal("export-video");
        }}
        generationItem={
          activeHistoryIndex !== -1 ? history[activeHistoryIndex] : null
        }
        historyIndex={activeHistoryIndex}
        activeVideoIndices={activeVideoIndices}
        onOpenVideoCreator={(idx) =>
          setActiveVideoIndices((prev) =>
            prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
          )
        }
        onGenerateVideo={handleGenerateVideo}
        onAddToTimeline={(url, duration, obj) =>
          onAddTimelineClip(url, "video", duration, undefined, 0, obj)
        }
        videoModel={videoModel}
        setVideoModel={setVideoModel}
        setVideoResolution={setVideoResolution}
        onSwitchSession={handleLoadHistory}
        onNewSession={() => setActiveHistoryIndex(-1)}
        onUpdateVideoDraft={(gid, sid, updates) =>
          setHistory((prev) =>
            prev.map((h) =>
              h.id === gid
                ? {
                    ...h,
                    videoStates: h.videoStates.map((vs, idx) =>
                      h.imageSet[idx].sceneId === sid
                        ? { ...vs, ...updates }
                        : vs
                    )
                  }
                : h
            )
          )
        }
        activeI2ISlot={activeI2ISlot}
        setActiveI2ISlot={setActiveI2ISlot}
        onUploadStartImage={handleUploadStartImage}
        onUploadToSession={handleUploadToSession}
        onDeleteScene={handleDeleteScene}
        onUndoEdit={handleUndoEdit}
        setCharacters={setCharacters}
        handleBuildCharacterVisual={async (id) => {
          const char = characters.find((c) => c.id === id);
          if (!char) return;
          setCharacters((prev) =>
            prev.map((c) => (c.id === id ? { ...c, isDescribing: true } : c))
          );
          try {
            // DEDUCTION FIRST: Identity generation.
            await consumeCredits("CHARACTER_IMAGE");

            const { src, error } = await generateCharacterVisual(
              char,
              visualStyle,
              characterStyle,
              selectedCountry
            );
            if (src) {
              const { description } = await generateCharacterDescription(
                src,
                "image/png"
              );
              setCharacters((prev) =>
                prev.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        imagePreview: `data:image/png;base64,${src}`,
                        description,
                        detectedImageStyle: null
                      }
                    : c
                )
              );
            }
          } catch (e) {
            console.error(e);
          } finally {
            setCharacters((prev) =>
              prev.map((c) => (c.id === id ? { ...c, isDescribing: false } : c))
            );
          }
        }}
        handleUploadNewCharacterImage={async (f) => {
          const base64 = await fileToBase64(f);
          const tempId = Date.now();
          const newChar = {
            id: tempId,
            name: "Scanning Identity...",
            imagePreview: `data:${f.type};base64,${base64}`,
            originalImageBase64: base64,
            originalImageMimeType: f.type,
            description: null,
            detectedImageStyle: null,
            isDescribing: false,
            isAnalyzing: true,
            isHero: false
          };
          setCharacters((prev) => [...prev, newChar]);
          try {
            // DEDUCTION FIRST: Identity production.
            await consumeCredits("CHARACTER_IMAGE");

            const {  description, detectedStyle } =
              await generateCharacterDescription(base64, f.type);
            setCharacters((prev) =>
              prev.map((c) =>
                c.id === tempId
                  ? {
                      ...c,
                       
                      description,
                      detectedImageStyle: detectedStyle,
                      isAnalyzing: false
                    }
                  : c
              )
            );
          } catch {
            setCharacters((prev) =>
              prev.map((c) =>
                c.id === tempId
                  ? { ...c, name: "Actor Entry", isAnalyzing: false }
                  : c
              )
            );
          }
        }}
        handleCharacterImageUpload={async (f, id) => {
          const base64 = await fileToBase64(f);
          setCharacters((prev) =>
            prev.map((c) => (c.id === id ? { ...c, isAnalyzing: true } : c))
          );
          try {
            // DEDUCTION FIRST: Identity replacement.
            await consumeCredits("CHARACTER_IMAGE");

            const { description, detectedStyle } =
              await generateCharacterDescription(base64, f.type);
            setCharacters((prev) =>
              prev.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      imagePreview: `data:${f.type};base64,${base64}`,
                      originalImageBase64: base64,
                      originalImageMimeType: f.type,
                      description,
                      detectedImageStyle: detectedStyle,
                      isAnalyzing: false
                    }
                  : c
              )
            );
          } catch {
            setCharacters((prev) =>
              prev.map((c) => (c.id === id ? { ...c, isAnalyzing: false } : c))
            );
          }
        }}
        updateCharacter={(id, p) =>
          setCharacters((prev) =>
            prev.map((c) => (c.id === id ? { ...c, ...p } : c))
          )
        }
        removeCharacter={(id) =>
          setCharacters((prev) => prev.filter((c) => c.id !== id))
        }
        onToggleHero={(id) =>
          setCharacters((prev) =>
            prev.map((c) => ({ ...c, isHero: c.id === id ? !c.isHero : false }))
          )
        }
        onGenerateSingleStorybookScene={handleGenerateSingleStorybookScene}
        onAddSceneVariant={handleAddSceneVariant}
        onSelectSceneVariant={handleSelectSceneVariant}
        onSceneVariantChange={(gid, sid, dir) => {
          const hIdx = history.findIndex((h) => h.id === gid);
          if (hIdx === -1) return;
          const scene = history[hIdx].imageSet.find(
            (s: any) => s.sceneId === sid
          );
          if (!scene || !scene.variants) return;
          const cur = scene.selectedVariantIndex || 0;
          let nIdx = dir === "next" ? cur + 1 : cur - 1;
          if (nIdx < 0) nIdx = scene.variants.length - 1;
          if (nIdx >= scene.variants.length) nIdx = 0;
          handleSelectSceneVariant(gid, sid, nIdx);
        }}
        onUpdateSceneImage={handleUpdateSceneImage}
        onRegenerateScene={handleRegenerateScene}
        onAngleSelect={(gid, sid) => {
          const sess = history.find((h) => h.id === gid);
          const img = sess?.imageSet.find((s: any) => s.sceneId === sid);
          setModalData({ genId: gid, sceneId: sid, src: img.src });
          setActiveModal("camera-angles");
        }}
        visualStyle={visualStyle}
        onUpdateAudioClip={(id, updates) =>
          setAudioClips((p) =>
            p.map((c) => (c.id === id ? { ...c, ...updates } : c))
          )
        }
        onUndo={handleTimelineUndo}
        timelinePlaybackTime={timelinePlaybackTime}
        onUpdateTimelinePlaybackTime={setTimelinePlaybackTime}
      />
    </div>
  );
};

export default App;
