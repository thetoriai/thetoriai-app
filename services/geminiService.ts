// DO add comment above each fix. Fix character likeness: Implemented Identity Preservation Protocol. Enhanced cultural logic for regional storytelling.
// Added Narrative-Cast Sync: Forces AI to map story roles to existing cast members.
// Added Protagonist Mandate: The uploaded character is the absolute lead actor; maps generic roles (e.g. 'man') to cast traits (e.g. 'boy').
// Added Strict Actor Mapping: Narrative text is a plot outline; Characters are the fixed actors. Mapping generic descriptions to specific cast traits is mandatory.
// Added Immersive Narration Protocol: Forbidden meta-mentions of visual styles (Nollywood/Hollywood) in the story text for clean audio playback.
// Added Background Extraction & Body Synthesis: AI now ignores reference backgrounds and automatically completes partial bodies into full-length figures.
// Added Synthesis Mandate: Explicit instructions to prioritize story action/pose over reference image pose while maintaining facial/clothing identity.
// Added STRICT CONTINUITY PROTOCOL: Forces the same character face and same exact outfit across every single frame/scene to avoid "shifting" character visuals.
// Added MEDIUM TRANSFORMATION PROTOCOL: Force-converts character source assets into the target visual style (e.g., Human to 3D, 3D to Illustrator, Anime to 3D) while retaining 1:1 identity features.
// Added LIGHTING & FULL-BODY SYNTHESIS: Mandates characters face the light and always generates complete figures from partial source images.
// Added ANIME TRANSFORMATION: Specifically defines Anime style with big expressive eyes, stylized features, and high-quality 2D animation aesthetic.
// Added MULTI-CHARACTER DIALOGUE PROTOCOL: Forces selected cast members to interact. If 2+ characters are selected, the AI is strictly forbidden from adding outsiders and must make the chosen characters speak to each other. If 1 character is selected, the AI automatically creates a unique supporting character to ensure dialogue.
// Added NARRATIVE VARIETY PROTOCOL: Ensures that even with identical inputs, the AI generates a completely fresh and original plot beat to prevent repetition.
// Added 8-SECOND PRODUCTION PROTOCOL: Every scene script/dialogue is strictly written to be spoken within exactly 8 seconds.
// Added DIALOGUE FORMAT PROTOCOL: All dialogue MUST follow the format "Name: Dialogue" (two-dot) to identify the speaker.
// Added ACCENT & LINGUISTIC AUTHENTICITY: Dialogue should use traditional language forms, regional dialects, or accents corresponding to the selected country (e.g. Nigerian English/Pidgin).
// Added SEQUENTIAL VISUAL CHAINING: In storyboard generation, scene 'i' MUST use the image from scene 'i-1' as its primary visual reference to ensure absolute frame-to-frame character and plot consistency.
// Added STYLE FIDELITY PROTOCOL: Forbids "style leakage". 3D must be volumetric/sculpted, not photographic.
// Added STUDIO ASSET EXTRACTION: Mandates that images on white backgrounds are "Studio Keys" - extract the character and ignore the white background.
// Added IDENTITY MASTER HIERARCHY: Prioritizes the generated/refined character visual over the original photo upload for scene consistency.
// Added ABSOLUTE ACTOR ISOLATION MANDATE: The background of any image from the Actor Roster is STRICTLY FORBIDDEN from appearing in the story. You must ONLY extract the person/character and place them in the environment described by the story narration.
// ADDED INPAINTING LOCK: When a mask is provided, the AI is now strictly ordered to NOT change any pixels outside that mask.
// ADDED CAMERA SHIFT MANDATE: Prevents duplicating characters by telling the AI to re-render the EXISTING person from a new angle instead of adding a second one.
// STUDIO GREEN-SCREEN PROTOCOL: Strictly enforces that white backgrounds from character assets must be discarded in favor of story-narrative environments.
// SIMILARITY-LOCKED CINEMATOGRAPHY: Ensures video transitions bridge frames via spatial subject alignment and optical zoom rather than object morphing.
// ENVIRONMENT LOCKDOWN PROTOCOL: Explicitly forbids the AI from generating stories set in "white rooms" or "white walls" just because the character assets are on white backgrounds.
// PERFORMANCE NARRATIVE PROTOCOL: Actions and movement (e.g., "looking frustrated", "gesturing", "fighting", "shooting") MUST be placed in the 'script' (Narrative/Dialogue) box. The 'imageDescription' is for visual DNA (colors, textures, framing) only.
// CINEMATIC ARCHETYPE PROTOCOL: Distinguishes between Hollywood (Action/Fighting/Shooting) and Nollywood (Dramatic Storytelling/Dialogue-heavy). Both MUST end well with positive resolution.
// FULL-BODY SYNTHESIS PROTOCOL: Strictly ordered to ignore the close-up framing of roster assets. AI must synthesize a full body/legs for characters to place them in the setting.
// IDENTITY LOOKUP PROTOCOL: Maps character names to visual DNA analyzed from reference images. Forbids repeating age, clothing, or feature descriptions in the output text fields.
// LINEAR CONTINUITY PROTOCOL: Enforces causal narrative chains (Entering car -> Driving -> Arriving). Ensures spatial persistence (if in yard, stay in yard).
// DYNAMIC ACTION MANDATE: Prioritizes movement-based storytelling: traveling, phoning, boarding planes, working, and household transitions. Flexible, two-sided interactions.
// DYNAMIC IDENTITY VARIABLE PROTOCOL: Character names are tied to visual tags (Archetype, Age, Clothing). These tags are re-analyzed after every generation and used as mandatory constraints in storyboard scenes.
// Added CONTINUATION PROTOCOL: If history is provided, the AI generates the NEXT CHAPTER.
// Added 8-SECOND DIALOGUE CAP: Force-limits dialogue length to ensure text can be spoken within the 8s window (approx 25 words max).
// Added SPEAKER PREFIX MANDATE: Explicitly mandates that every scene script MUST begin with "Name:" to identify the speaker from the selected cast.
// 3D ANTI-PHOTOREALISM LOCK: Injected strictly non-photographic instructions into 3D styles.
// ETHNICITY & WARDROBE MANDATE: Implemented "Afro-Identity" lock for Afro-toon style and "Smart Casual" wardrobe logic based on country context.
// ADDED SAFETY PARSING PROTOCOL: Intercepts Gemini safety blocks to return blunt, instructive error codes for minor safety and explicit content.

import {
  GoogleGenAI,
  Type,
  GenerateContentResponse,
  Modality
} from "@google/genai";
import type { Part } from "@google/genai";

export type Outfit = {
  id: string;
  name: string;
  image: string; // base64
};

export type Character = {
  id: number;
  name: string;
  imagePreview: string | null;
  originalImageBase64: string | null;
  originalImageMimeType: string | null;
  description: string | null;
  detectedImageStyle: string | null;
  isDescribing: boolean;
  isAnalyzing?: boolean;
  isHero?: boolean;
  customInstruction?: string;
  heroData?: {
    frontView?: string;
    backView?: string;
    sideViewLeft?: string;
    sideViewRight?: string;
    closeUp?: string;
    fullBody?: string;
    outfits: Outfit[];
  };
};

export type StoryboardSceneData = {
  id: number;
  imageDescription: string;
  script: string;
  isDescriptionLocked?: boolean;
  isScriptLocked?: boolean;
  selectedOutfitId?: string;
  audioSrc?: string | null;
  isGeneratingAudio?: boolean;
  selectedVoice?: string;
  selectedVoiceExpression?: string;
  previewSrc?: string | null;
  isLoading?: boolean;
  endImageSrc?: string | null;
  isI2IActive?: boolean;
};

export type Storybook = {
  title: string;
  characters: string[];
  storyNarrative: string;
  scenes: StoryboardSceneData[];
  narrativeAudioSrc?: string | null;
  isGeneratingNarrativeAudio?: boolean;
  selectedNarrativeVoice?: string;
  selectedNarrativeExpression?: string;
  selectedNarrativeAccent?: string;
  includeDialogue?: boolean;
};

export type EditImageParams = {
  imageBase64: string;
  mimeType: string;
  editPrompt: string;
  aspectRatio: string;
  visualStyle: string;
  characterStyle?: string;
  genre: string;
  characters: Character[];
  hasVisualMasks?: boolean;
  signal?: AbortSignal;
  imageModel?: string;
  overlayImage?: { base64: string; mimeType: string };
  referenceImage?: { base64: string; mimeType: string };
};

export const PREBUILT_VOICES = ["Zephyr", "Puck", "Charon", "Kore", "Fenrir"];
export const VOICE_EXPRESSIONS = [
  "Storytelling",
  "Loving",
  "Newscast",
  "Advertisement",
  "Cheerful",
  "Angry",
  "Sad"
];
export const ACCENT_OPTIONS = ["Global (Neutral)", "Nigerian English"];

export const CAMERA_ANGLE_OPTIONS = [
  {
    key: "close_up",
    name: "Close Shot",
    description: "Focuses tightly on a character's face."
  },
  {
    key: "medium",
    name: "Medium Shot",
    description: "Shows a character from the waist up."
  },
  {
    key: "full",
    name: "Full Shot",
    description: "Captures the entire character from head to toe."
  },
  {
    key: "wide",
    name: "Wide Shot",
    description: "Establishes the entire scene and location."
  },
  {
    key: "ots",
    name: "Over-the-Shoulder",
    description: "Looks over one character at another."
  },
  {
    key: "pov",
    name: "Point of View (POV)",
    description: "Shows the scene from a character's eyes."
  },
  {
    key: "high_angle",
    name: "High-Angle",
    description: "Looks down on the subject."
  },
  {
    key: "low_angle",
    name: "Low-Angle",
    description: "Looks up at the subject."
  },
  {
    key: "from_behind",
    name: "From the Back",
    description: "Frames the scene from behind the character."
  }
];

export const CAMERA_MOVEMENT_PROMPTS: { [key: string]: string } = {
  "Static Hold":
    "The camera remains completely static, holding a fixed shot on the scene.",
  "Drone Rise Tilt-Up":
    "The camera starts low and ascends smoothly while tilting upward, creating an epic aerial reveal of the scene.",
  "Dolly Back (Pull-Out)":
    "The camera starts relatively close to the subject and then moves straight backward (dolly out), smoothly revealing more of the surrounding environment.",
  "Pan Left":
    "The camera moves smoothly and horizontally from right to left across the scene.",
  "Pan Right":
    "The camera moves smoothly and horizontally from left to right across the scene.",
  "Orbit Around Subject":
    "The camera smoothly circles around the main subject of the scene, keeping them in focus.",
  "Crane Down":
    "The camera moves vertically downward, as if on a crane, offering a descending perspective of the scene.",
  "Crane Up":
    "The camera moves vertically upward, as if on a crane, for a powerful lift or establishing shot.",
  "Tracking Shot (Follow)":
    "The camera follows the subject's motion smoothly, keeping them at a consistent position in the frame.",
  "Zoom In (Focus In)":
    "The camera lens smoothly zooms in, gradually tightening the focus on the main subject or a specific detail.",
  "Zoom Out (Reveal)":
    "The camera lens smoothly zooms out, gradually widening the view to reveal more of the setting or context."
};

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractJson(text: string): string {
  let clean = text.trim();
  const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) clean = codeBlockMatch[1].trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end >= start)
    return clean.substring(start, end + 1);
  return clean;
}

export function detectMimeType(base64: string): string {
  if (!base64) return "image/png";
  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:([^;]+);/);
    if (match) return match[1];
  }
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  return "image/png";
}

export function stripBase64Prefix(base64: string): string {
  if (base64.includes(",")) return base64.split(",")[1];
  return base64;
}

async function withRetry<T>(
  apiCall: () => Promise<T>,
  onRetryMessage?: (msg: string) => void,
  signal?: AbortSignal
): Promise<T> {
  let attempt = 0;
  const maxRetries = 3;
  while (attempt < maxRetries) {
    if (signal?.aborted) throw new Error("Aborted");
    try {
      return await apiCall();
    } catch (error) {
      if (signal?.aborted) throw new Error("Aborted");
      attempt++;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        errorMessage.toLowerCase().includes("safety") ||
        errorMessage.toLowerCase().includes("blocked")
      ) {
        throw error;
      }

      const isRetryable =
        errorMessage.includes("503") ||
        errorMessage.includes("429") ||
        errorMessage.includes("500");
      if (isRetryable && attempt < maxRetries) {
        const delaySeconds = Math.pow(2, attempt) * 10;
        if (onRetryMessage)
          onRetryMessage(`Model Busy. Retrying in ${delaySeconds}s...`);
        await delay(delaySeconds * 1000);
      } else {
        throw error;
      }
    }
  }
  throw new Error("API call failed after retries.");
}

function getStyleInstructions(
  style: string,
  characterStyle: string = "General"
): string {
  const isAfrican = characterStyle === "Afro-toon";
  const africanMandate = isAfrican
    ? " MANDATORY AFRICAN SETTING: This scene takes place ENTIRELY inside Africa. Use authentic African architecture, landscapes, and local cultural markers."
    : "";

  // DO add comment: 3D Render Style Lockdown. Implemented highly aggressive CGI/Pixar instructions to stop the AI from generating realistic photos.
  // Also added an IDENTITY TRANSLATION MANDATE to force the model to see characters through the lens of the style.
  const transformationProtocol = `
        STRICT MEDIUM TRANSFORMATION (ZERO STYLE LEAKAGE):
        - You MUST strictly adhere to the requested visual medium: [${style}]. 
        - [3D Render]: TARGET Pixar/Dreamworks stylized CGI animation. This means sculpted, volumetric shapes, smooth porcelain-like skin, vibrant saturated colors, and cinematic volumetric lighting. 
        - [ANTI-REALISM LOCK]: You are STRICTLY FORBIDDEN from using real human skin pores, photographic realism, or realistic 8K textures. It MUST look like a high-budget animated 3D film. 
        - [Realistic Photo]: TARGET Cinematic 8K photography. Real physics, true human skin texture.
        - [Illustrator]: TARGET Flat vector art. Zero gradients, zero depth, clear solid colors, sharp clean outlines.
        - [Anime]: TARGET 2D Cel-shaded animation. Bold expressive outlines, big eyes, stylized hand-drawn features.
        
        IDENTITY TRANSLATION PROTOCOL:
        - If the target style is [3D Render], translate all character reference traits into stylized CGI forms. Smooth the skin, exaggerate expressions slightly, and use procedural stylized textures.
    `;

  const common = `REPLICATE EXACT facial identity and EXACT outfit from reference assets. ${africanMandate} NO STYLE MIXING. ${transformationProtocol}`;

  switch (style) {
    case "3D Render":
      return `Aesthetic: Stylized Disney/Pixar dimensional CGI animation. STRICTLY NON-PHOTOGRAPHIC. ${common}`;
    case "Realistic Photo":
      return `Aesthetic: Lifelike cinematic photograph. ${common}`;
    case "Illustrator":
      return `Aesthetic: Flat vector graphics. ${common}`;
    case "Anime":
      return `Aesthetic: 2D Cel-shaded animation. ${common}`;
    default:
      return `Style: ${style}. ${common}`;
  }
}

export async function generateCharacterDescription(
  imageBase64: string,
  mimeType: string,
  signal?: AbortSignal
): Promise<{ description: string; detectedStyle: string }> {
  const ai = getAiClient();
  const imagePart = { inlineData: { data: imageBase64, mimeType } };
  const prompt = `Perform a high-fidelity visual analysis for DYNAMIC IDENTITY LOCKING. 
    Return JSON with:
    'description': a detailed string of EXACT physical tags. You MUST use this structure:
    'Who: [Archetype], Age: [Precise Range], Clothes: [Exact description including colors and materials]'. 
    Example: 'Who: Determined detective, Age: 40-45, Clothes: Charcoal wool trench coat over a white button-up'.
    'detectedStyle': visual style name (e.g., 3D Render, Anime, Realistic).`;

  const response: GenerateContentResponse = await withRetry(
    () =>
      ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: "application/json" }
      }),
    undefined,
    signal
  );
  const parsed = JSON.parse(extractJson(response.text || "{}"));
  return {
    description: parsed.description || "",
    detectedStyle: parsed.detectedStyle || "Realistic"
  };
}

export async function editImage(
  params: EditImageParams
): Promise<{ src: string | null; error: string | null }> {
  const ai = getAiClient();
  const {
    imageBase64,
    mimeType,
    editPrompt,
    aspectRatio,
    visualStyle,
    characterStyle,
    characters,
    hasVisualMasks,
    signal,
    imageModel,
    overlayImage,
    referenceImage
  } = params;

  const parts: Part[] = [
    {
      inlineData: {
        data: stripBase64Prefix(imageBase64),
        mimeType: detectMimeType(imageBase64)
      }
    }
  ];

  if (overlayImage) {
    parts.push({
      inlineData: {
        data: stripBase64Prefix(overlayImage.base64),
        mimeType: overlayImage.mimeType
      }
    });
  }

  if (referenceImage) {
    parts.push({
      inlineData: {
        data: stripBase64Prefix(referenceImage.base64),
        mimeType: referenceImage.mimeType
      }
    });
  }

  const castNotes = characters
    .map((c) => `${c.name}: ${c.description}`)
    .join("; ");
  const system = `${getStyleInstructions(visualStyle, characterStyle)} CAST DNA: ${castNotes}. DO NOT change background unless prompted.`;

  // DO add comment: Style Injection. Prepended visual medium to the user prompt to ensure the model doesn't drift into realism during edits.
  const stylePrefix = `VISUAL MEDIUM: [${visualStyle}]. `;
  parts.push({ text: stylePrefix + editPrompt });

  try {
    const response: GenerateContentResponse = await withRetry(
      () =>
        ai.models.generateContent({
          model: imageModel || "gemini-3-pro-image-preview",
          contents: { parts },
          config: {
            systemInstruction: system,
            imageConfig: { aspectRatio: aspectRatio as any }
          }
        }),
      undefined,
      signal
    );

    if (response.candidates?.[0]?.finishReason === "SAFETY") {
      return { src: null, error: "BLOCK_SAFETY_GENERAL" };
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return { src: part.inlineData.data, error: null };
    }
    return { src: null, error: "No image generated." };
  } catch (e: any) {
    const msg = e.message?.toLowerCase() || "";
    if (msg.includes("minor")) return { src: null, error: "BLOCK_MINOR" };
    if (msg.includes("safety") || msg.includes("blocked"))
      return { src: null, error: "BLOCK_SAFETY_GENERAL" };
    return { src: null, error: e.message };
  }
}

export async function generateSingleImage(
  prompt: string,
  aspectRatio: string,
  characterStyle: string,
  visualStyle: string,
  genre: string,
  characters: Character[],
  model: string = "gemini-3-pro-image-preview",
  referenceImage?: string | null,
  historyImage?: string | null,
  signal?: AbortSignal
): Promise<{ src: string | null; error: string | null }> {
  const ai = getAiClient();
  const parts: Part[] = [];

  if (referenceImage) {
    parts.push({
      inlineData: {
        data: stripBase64Prefix(referenceImage),
        mimeType: "image/png"
      }
    });
  }
  if (historyImage) {
    parts.push({
      inlineData: {
        data: stripBase64Prefix(historyImage),
        mimeType: "image/png"
      }
    });
  }

  const castNotes = characters
    .map((c) => `${c.name}: ${c.description}`)
    .join("; ");
  const system = `${getStyleInstructions(visualStyle, characterStyle)} CAST DNA: ${castNotes}. GENRE: ${genre}.`;

  // DO add comment: Master Style Enforcer. Injected a hard style-lock prefix into the user prompt to override model's photorealistic bias in storyboard mode.
  const styleEnforcement = `STRICT VISUAL MEDIUM: [${visualStyle}]. STYLE LOCK: GENERATE ${visualStyle.toUpperCase()} ONLY. NO PHOTOREALISM. NO REAL SKIN. `;
  parts.push({ text: styleEnforcement + prompt });

  try {
    const response: GenerateContentResponse = await withRetry(
      () =>
        ai.models.generateContent({
          model: model,
          contents: { parts },
          config: {
            systemInstruction: system,
            imageConfig: { aspectRatio: aspectRatio as any }
          }
        }),
      undefined,
      signal
    );

    if (response.candidates?.[0]?.finishReason === "SAFETY") {
      return { src: null, error: "BLOCK_SAFETY_GENERAL" };
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return { src: part.inlineData.data, error: null };
    }
    return { src: null, error: "No image generated." };
  } catch (e: any) {
    const msg = e.message?.toLowerCase() || "";
    if (msg.includes("minor")) return { src: null, error: "BLOCK_MINOR" };
    if (msg.includes("safety") || msg.includes("blocked"))
      return { src: null, error: "BLOCK_SAFETY_GENERAL" };
    return { src: null, error: e.message };
  }
}

export async function generateCharacterVisual(
  character: Character,
  uiSelectedStyle: string,
  characterStyle: string,
  selectedCountry: string,
  signal?: AbortSignal
): Promise<{ src: string | null; error: string | null }> {
  const customNotes = character.customInstruction
    ? ` INSTRUCTION: ${character.customInstruction}.`
    : "";

  const isAfro = characterStyle === "Afro-toon";
  const ethnicityMandate = isAfro
    ? "ETHNICITY MANDATE: The subject MUST be a person of African descent (Black person) with authentic features."
    : `ETHNICITY CONTEXT: The subject should match the predominant ethnicity of ${selectedCountry}.`;

  const hasClothingInstruction =
    character.customInstruction?.toLowerCase().includes("shirt") ||
    character.customInstruction?.toLowerCase().includes("clothes") ||
    character.customInstruction?.toLowerCase().includes("wear") ||
    character.customInstruction?.toLowerCase().includes("outfit");

  let casualWearPrompt = "";
  if (!hasClothingInstruction) {
    if (selectedCountry === "Nigeria") {
      casualWearPrompt =
        "WARDROBE: Contemporary Nigerian casual wear (e.g., a modern Ankara-print shirt or a stylish modern Kaftan shirt).";
    } else if (selectedCountry === "USA") {
      casualWearPrompt =
        "WARDROBE: Modern American casual wear (e.g., high-quality jeans and a stylish t-shirt).";
    } else if (selectedCountry === "UK") {
      casualWearPrompt =
        "WARDROBE: Modern British casual wear (e.g., a smart jumper or stylish hoodie).";
    } else {
      casualWearPrompt = `WARDROBE: Modern casual wear appropriate for the culture of ${selectedCountry}.`;
    }
  }

  const studioPrompt = `
        STRICT STUDIO PRODUCTION MANDATE:
        - SUBJECT: ${character.name}.
        - IDENTITY VARIABLE: ${character.description}.
        - ${ethnicityMandate}
        - ${casualWearPrompt}
        - VIEW: ABSOLUTE FULL-BODY PORTRAIT. HEAD-TO-TOE VIEW. THE FEET MUST BE VISIBLE.
        - COMPOSITION: Entire character visible. Wide margins.
        - BACKGROUND: PURE WHITE (#FFFFFF). NO GRADIENTS. NO FURNITURE. NO SHADOWS.
        - MEDIUM: Transform identity to target style [${uiSelectedStyle}].
        - STYLE LOCK: If 3D Render is requested, generate Pixar-style CGI animation ONLY. STRICTLY NON-PHOTOGRAPHIC.
        ${customNotes}
    `;

  if (character.originalImageBase64) {
    return editImage({
      imageBase64: character.originalImageBase64,
      mimeType: character.originalImageMimeType || "image/png",
      editPrompt: studioPrompt,
      aspectRatio: "3:4",
      visualStyle: uiSelectedStyle,
      genre: "General",
      characters: [character],
      signal: signal,
      imageModel: "gemini-3-pro-image-preview"
    });
  } else {
    return generateSingleImage(
      studioPrompt,
      "3:4",
      "General",
      uiSelectedStyle,
      "General",
      [],
      "gemini-3-pro-image-preview",
      null,
      null,
      signal
    );
  }
}

export async function generateVideoFromScene(
  scene: any,
  aspectRatio: string,
  prompt: string,
  image: string | null,
  style: string,
  characterStyle: string,
  model: string,
  resolution: "720p" | "1080p",
  cameraMovement: string,
  onRetry?: (msg: string) => void,
  characters?: Character[]
): Promise<{ videoUrl: string | null; videoObject: any }> {
  const ai = getAiClient();
  const castNotes =
    characters?.map((c) => `${c.name}: ${c.description}`).join("; ") || "";

  // DO add comment: Style Fidelity in Video. Forced visual medium prefix into video generation prompts to prevent the "photorealistic video" shift.
  const fullPrompt = `STYLE: ${style}. Visual Medium: [${style}]. Character Context: ${castNotes}. Action: ${prompt}. Camera: ${cameraMovement}.`;

  const imagePart = scene.src
    ? {
        imageBytes: stripBase64Prefix(scene.src),
        mimeType: "image/png"
      }
    : undefined;

  try {
    let operation = await ai.models.generateVideos({
      model: model || "veo-3.1-fast-generate-preview",
      prompt: fullPrompt,
      image: imagePart,
      config: {
        numberOfVideos: 1,
        resolution,
        aspectRatio: aspectRatio === "16:9" ? "16:9" : "9:16"
      }
    });

    while (!operation.done) {
      await delay(5000);
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadLink) {
      const fetchUrl = `${downloadLink}&key=${process.env.API_KEY}`;
      return {
        videoUrl: fetchUrl,
        videoObject: operation.response?.generatedVideos?.[0]?.video
      };
    }
    return { videoUrl: null, videoObject: null };
  } catch (e) {
    throw e;
  }
}

export async function generateStructuredStory(
  idea: string,
  title: string,
  characters: Character[],
  includeDialogue: boolean,
  characterStyle: string,
  genre: string,
  movieStyle: string,
  numScenes: string,
  history: string,
  isMusicVideo: boolean,
  songLyrics: string,
  country: string
): Promise<any> {
  const ai = getAiClient();
  const castNotes = characters
    .map((c) => `${c.name}: ${c.description}`)
    .join("; ");
  const system = `You are a professional ${movieStyle} screenwriter. Generate a story set in ${country} in ${genre} style.
    CAST: ${castNotes}. ${includeDialogue ? "Include speaker-prefixed dialogue." : "No dialogue."}
    Return JSON with 'title', 'storyNarrative', and 'scenes' (array of {imageDescription, script}).
    Scene script MUST follow "Name: Dialogue" format. Dialogue must be spoken within 8 seconds.`;

  const response: GenerateContentResponse = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Prompt: ${idea}. Title: ${title}. History: ${history}. Generate ${numScenes} scenes.`,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json"
      }
    })
  );

  return JSON.parse(extractJson(response.text || "{}"));
}

export async function generateScenesFromNarrative(
  narrative: string,
  characters: Character[],
  includeDialogue: boolean,
  characterStyle: string,
  movieStyle: string,
  country: string
): Promise<any[]> {
  const ai = getAiClient();
  const castNotes = characters
    .map((c) => `${c.name}: ${c.description}`)
    .join("; ");
  const system = `Parse this ${narrative} into 8-second production scenes for ${movieStyle} production in ${country}.
    CAST: ${castNotes}.
    Return JSON: { scenes: [{imageDescription, script}] }. Scene script MUST begin with "Name:".`;

  const response: GenerateContentResponse = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: narrative,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json"
      }
    })
  );

  const parsed = JSON.parse(extractJson(response.text || "{}"));
  return parsed.scenes || [];
}

export async function regenerateSceneVisual(
  script: string,
  characters: Character[]
): Promise<string> {
  const ai = getAiClient();
  const castNotes = characters
    .map((c) => `${c.name}: ${c.description}`)
    .join("; ");
  const prompt = `Based on this script: "${script}" and CAST: ${castNotes}, generate a detailed imageDescription (Visual DNA) for an AI image generator. Focus on framing, lighting, and performance.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });

  return response.text || "";
}

export async function generatePromptFromAudio(
  base64: string,
  mimeType: string
): Promise<string> {
  const ai = getAiClient();
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      { inlineData: { data: base64, mimeType } },
      {
        text: "Transcribe this audio into a clear story concept. Return only the verbatim transcription text, nothing else. Do not add analysis or instructions."
      }
    ]
  });
  return response.text || "";
}

export async function generateSpeech(
  text: string,
  country: string,
  voice: string,
  expression: string
): Promise<string> {
  const ai = getAiClient();
  const prompt = `Say in a ${expression} expression with ${country} linguistic flavor: ${text}`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice || "Kore" }
        }
      }
    }
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
}
