// DO add comment above each fix. Fix character likeness: Implemented Identity Preservation Protocol. Enhanced cultural logic for regional storytelling.
// Added Narrative-Cast Sync: Forces AI to map story roles to existing cast members.
// Added Protagonist Mandate: The uploaded character is the absolute lead actor; maps generic roles (e.g. 'man') to cast traits (e.g. 'boy').
// Added Strict Actor Mapping: Narrative text is a plot outline; Characters are the fixed actors. Mapping generic descriptions to specific cast traits is mandatory.
// Added Immersive Narration Protocol: Forbidden meta-mentions of visual styles (Nollywood/Hollywood) in the story text for clean audio playback.
// Added Background Extraction & Body Synthesis: AI now ignores reference backgrounds and automatically completes partial bodies into full-length figures.
// Added Synthesis Mandate: Explicit instructions to prioritize story action/pose over reference image delete while maintaining facial/clothing identity.
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
// ETHNICITY & WARDROBE MANDATE: Implemented "Afro-toon" lock for Afro-toon style and "Smart Casual" wardrobe logic based on country context.
// ADDED SAFETY PARSING PROTOCOL: Intercepts Gemini safety blocks to return blunt, instructive error codes for minor safety and explicit content.

// DO add comment: Gemini removed from frontend. All AI calls now go through backend API routes for security.

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

// REGIONAL IDENTITY PROTOCOL DATABASE
const REGIONAL_IDENTITY_MAP: Record<string, string> = {
  Nigeria:
    "ETHNICITY: West African (Yoruba/Igbo/Hausa features). SKIN: Deep ebony to bronze. WARDROBE: Modern Kaftans or Ankara prints. VIBE: High energy, urban Lagos colors.",
  Kenya:
    "ETHNICITY: East African (Nilotic/Bantu features). SKIN: Radiant dark tones. WARDROBE: Maasai Shuka accents or modern Nairobi street-style. VIBE: Warm savannah lighting.",
  Ghana:
    "ETHNICITY: West African (Akan/Ga features). SKIN: Rich, very dark radiant skin. WARDROBE: Bold Kente cloth patterns. VIBE: Coastal vibrancy, gold accents.",
  Ethiopia:
    "ETHNICITY: Horn of Africa (Habesha features). SKIN: Light to medium bronze, distinct curly hair textures. WARDROBE: White cotton Habesha Kemis with embroidery. VIBE: Ancient stone textures.",
  "South Africa":
    "ETHNICITY: Southern African (Zulu/Xhosa/Rainbow nation diversity). SKIN: Broad range of melanin. WARDROBE: Zulu beadwork accents or Joburg urban-chic. VIBE: Modern cosmopolitan.",
  Tanzania:
    "ETHNICITY: Swahili/Coastal features. SKIN: Deep bronze. WARDROBE: Kanga or Kitenge wraps. VIBE: Zanzibar-style carved wood and oceanic blue tones.",
  Uganda:
    "ETHNICITY: Central/East African. SKIN: Strong ebony tones. WARDROBE: Gomesi or Kanzu textures. VIBE: Lush green banana plantations and red earth.",
  Senegal:
    "ETHNICITY: West African (Wolof features). SKIN: Deepest ebony, tall elegant builds. WARDROBE: Grand Boubou robes. VIBE: Saharan edge, sophisticated fashion.",
  "Ivory Coast":
    "ETHNICITY: West African. SKIN: Medium-to-dark bronze. WARDROBE: Modern Abidjan Pagne fashion. VIBE: Chic tropical lagoon aesthetic.",
  Cameroon:
    "ETHNICITY: Central African. SKIN: Diverse Bantu tones. WARDROBE: Toghu velvet embroidery. VIBE: Dense rainforest canopy lighting.",
  Rwanda:
    "ETHNICITY: East African. SKIN: Smooth bronze tones, tall stature. WARDROBE: Mushanana silky drapes. VIBE: Pristine 'Land of a Thousand Hills' green terraces.",
  Zimbabwe:
    "ETHNICITY: Southern African (Shona/Ndebele features). SKIN: Deep melanin. WARDROBE: Contemporary local designer wear. VIBE: Highveld savannah and stone structures.",
  Zambia:
    "ETHNICITY: Southern African. SKIN: Warm dark tones. WARDROBE: Chitenge patterned outfits. VIBE: Zambezi river mist and floodplain lighting.",
  Morocco:
    "ETHNICITY: North African (Amazigh/Arab features). SKIN: Olive to tan. WARDROBE: Hooded Djellabas and Kaftans. VIBE: Intricate mosaic (Zellige) and desert archways.",
  Egypt:
    "ETHNICITY: North African (Middle Eastern influence). SKIN: Olive to medium bronze. WARDROBE: Galabeya robes or modern Cairo attire. VIBE: Nile greenery vs. golden desert sands."
};

const MEDIUM_HARD_LOCK: Record<string, string> = {
  "3D Render":
    "STRICT MEDIUM LOCK: Pixar/Disney 3D CGI ONLY. FORBIDDEN: No 2D sketches, no flat vectors, no realistic 8K photos. Use volumetric shapes and subsurface scattering.",
  Realistic:
    "STRICT MEDIUM LOCK: Cinematic 8K Photography ONLY. FORBIDDEN: No 3D animation, no vector lines, no cartoons. Use real human skin pores and lens bokeh.",
  Illustrator:
    "STRICT MEDIUM LOCK: Flat 2D Vector Art ONLY. FORBIDDEN: No 3D depth, no realism, no photographic textures. Use clean outlines and solid fills.",
  Anime:
    "STRICT MEDIUM LOCK: Japanese 2D Cel-shaded Anime ONLY. FORBIDDEN: No 3D volume, no realism, no western illustration styles. Use bold lines and expressive large eyes."
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

export const ACCENT_OPTIONS = ["Global (Neutral)", "Nigerian English", "French", "American English", "British English"];

// LANGUAGE MAP: controls dialogue and speech language per country
export const COUNTRY_LANGUAGE_MAP: Record<
  string,
  {
    dialogueLanguage: string;
    speechLanguage: string;
  }
> = {
  Nigeria: {
    dialogueLanguage: "Nigerian Pidgin English",
    speechLanguage: "Nigerian Pidgin English accent"
  },

  USA: {
    dialogueLanguage: "American English",
    speechLanguage: "American English accent"
  },

  UK: {
    dialogueLanguage: "British English",
    speechLanguage: "British English accent"
  },

  France: {
    dialogueLanguage: "French",
    speechLanguage: "French accent speaking French"
  },

  Senegal: {
    dialogueLanguage: "French",
    speechLanguage: "French accent speaking French"
  },

  Cameroon: {
    dialogueLanguage: "French",
    speechLanguage: "French accent speaking French"
  },

  "Ivory Coast": {
    dialogueLanguage: "French",
    speechLanguage: "French accent speaking French"
  },

  Morocco: {
    dialogueLanguage: "French",
    speechLanguage: "French accent speaking French"
  },

  Default: {
    dialogueLanguage: "English",
    speechLanguage: "Neutral English accent"
  }
};

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
    "The camera lens smoothly zooms out, gradually widening the view to reveal more of the setting or context.",
  "Handheld (Organic Shake)":
    "The camera has a natural, handheld aesthetic with subtle organic shakes, adding a realistic and immersive documentary-style feel to the footage."
};

function enhanceCinematicPrompt(
  prompt: string,
  hasReference: boolean,
  hasEndFrame: boolean
): string {
  const lighting = [
    "golden hour cinematic lighting",
    "soft dramatic side lighting",
    "moody cinematic shadows",
    "natural sunlight with film contrast"
  ];

  const lens = [
    "shallow depth of field",
    "cinematic 35mm film lens",
    "cinematic 50mm portrait lens",
    "soft background bokeh"
  ];

  const framing = [
    "wide cinematic establishing shot",
    "medium cinematic shot",
    "dramatic low angle shot",
    "intimate close cinematic shot"
  ];

  const movement = Object.keys(CAMERA_MOVEMENT_PROMPTS);

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (hasReference && hasEndFrame) {
    return `
Create natural cinematic motion between the provided start frame and end frame.
Preserve character identity and environment continuity.

Scene concept:
${prompt}
`;
  }

  if (hasReference) {
    return `
Cinematic scene based on the provided reference image.
Maintain the visual style and identity of the reference.

Scene concept:
${prompt}
`;
  }

  return `
${pick(framing)}, ${pick(movement)}, ${pick(lighting)}, ${pick(lens)}.

Scene concept:
${prompt}
`;
}

// DO add comment: Removed direct Gemini client. Frontend must call backend API instead.

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

// DO add comment: Added DIRECTOR ASSISTANCE ENGINE.
// This function centralizes all "reaction video / director insight" logic
// so UI components never call GoogleGenAI directly.
// It enforces structured JSON output for titles, talking points, and vibe.




// DO add comment: Now calling backend API instead of Gemini directly
export async function generateDirectorAssistance(context: string): Promise<{
  suggestedTitles: string[];
  talkingPoints: string[];
  vibe: string;
} | null> {
  try {
    const response = await fetch("/api/generate-director", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        context: context
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || "Failed to generate director assistance"
      );
    }

    const data = await response.json();

    return {
      suggestedTitles: data.suggestedTitles || [],
      talkingPoints: data.talkingPoints || [],
      vibe: data.vibe || ""
    };
  } catch (error) {
    console.error("Director Assistance Error", error);
    return null;
  }
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
        - [3D Render]: DEPTH MANDATE. Target high-budget stylized CGI animation (Pixar/Dreamworks). 
          * USE: Volumetric lighting, global illumination, ambient occlusion, and subsurface scattering on skin.
          * CHARACTER: Volumetric sculpted forms with rounded 3D depth. Smooth porcelain-like skin textures.
          * FORBIDDEN: You are STRICTLY FORBIDDEN from using flat 2D colors, flat vector outlines, or realistic 8K photos. No 2D sketches. It must have significant Z-depth and dimensional shadows.
        - [Realistic Photo]: TARGET Cinematic 8K photography. Real physics, true human skin texture.
        - [Illustrator]: TARGET Flat vector art. Zero gradients, zero depth, clear solid colors, sharp clean outlines.
        - [Anime]: TARGET 2D Cel-shaded animation. Bold expressive outlines, big eyes, stylized hand-drawn features.
        
        IDENTITY TRANSLATION PROTOCOL:
        - If the target style is [3D Render], translate all character reference traits into stylized CGI forms. Smooth the skin, exaggerate expressions slightly, and use procedural stylized textures.
    `;

  const common = `REPLICATE EXACT facial identity and EXACT outfit from reference assets. ${africanMandate} NO STYLE MIXING. ${transformationProtocol}`;

  switch (style) {
    case "3D Render":
      return `Aesthetic: Stylized dimensional CGI animation. STRICTLY DIMENSIONAL AND VOLUMETRIC. ${common}`;
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

// DO add comment: Now calling backend API instead of Gemini directly (PROMPT PRESERVED)
export async function generateCharacterDescription(
  imageBase64: string,
  mimeType: string,
  signal?: AbortSignal
): Promise<{ description: string; detectedStyle: string }> {
  try {
    const response = await fetch("/api/character-description", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        imageBase64: imageBase64,
        mimeType: mimeType,
        prompt: `Perform a high-fidelity visual analysis for DYNAMIC IDENTITY LOCKING. 
Return JSON with:
'description': a detailed string of EXACT physical tags. You MUST use this structure:
'Who: [Archetype], Age: [Precise Range], Clothes: [Exact description including colors and materials]'. 
Example: 'Who: Determined detective, Age: 40-45, Clothes: Charcoal wool trench coat over a white button-up'.
'detectedStyle': visual style name (e.g., 3D Render, Anime, Realistic).`
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || "Failed to generate character description"
      );
    }

    const data = await response.json();

    return {
      description: data.description || "",
      detectedStyle: data.detectedStyle || "Realistic"
    };
  } catch (error) {
    console.error("Character Description Error", error);
    return {
      description: "",
      detectedStyle: "Realistic"
    };
  }
}

// DO add comment: Now calling backend API instead of Gemini directly (FULL LOGIC PRESERVED)
export async function editImage(
  params: EditImageParams
): Promise<{ src: string | null; error: string | null }> {
  try {
    const response = await fetch("/api/edit-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
        editPrompt: params.editPrompt,
        aspectRatio: params.aspectRatio,
        visualStyle: params.visualStyle,
        characterStyle: params.characterStyle,
        characters: params.characters,
        hasVisualMasks: params.hasVisualMasks,
        imageModel: params.imageModel,
        overlayImage: params.overlayImage,
        referenceImage: params.referenceImage
      })
    });

    if (!response.ok) {
      let errorMessage = "Failed to edit image";
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {}
      throw new Error(errorMessage);
    }

    const data = await response.json();

    return {
      src: data.src ? data.src : null,
      error: data.error ? data.error : null
    };
  } catch (error: any) {
    console.error("Edit Image Error:", error);

    return {
      src: null,
      error: error && error.message ? error.message : "Unknown error"
    };
  }
}

// DO add comment: Now calling backend API instead of Gemini directly (FULL LOGIC PRESERVED)
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
  secondaryReferenceImage?: string | null,
  signal?: AbortSignal
): Promise<{ src: string | null; error: string | null }> {
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt,
        aspectRatio: aspectRatio,
        characterStyle: characterStyle,
        visualStyle: visualStyle,
        genre: genre,
        characters: characters,
        model: model,
        referenceImage: referenceImage,
        historyImage: historyImage,
        secondaryReferenceImage: secondaryReferenceImage
      })
    });

    if (!response.ok) {
      let errorMessage = "Failed to generate image";
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {}
      throw new Error(errorMessage);
    }

    const data = await response.json();

    return {
      src: data.src ? data.src : null,
      error: data.error ? data.error : null
    };
  } catch (error: any) {
    console.error("Generate Image Error:", error);

    return {
      src: null,
      error: error && error.message ? error.message : "Unknown error"
    };
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
      null,
      signal
    );
  }
}
// DO add comment: Dialogue Performance Converter. Converts "Name: Dialogue" into mandatory spoken instruction with identity binding.
function convertDialogueToPerformance(script: string, characters?: Character[]): string {

  if (!script) return "";

  const match = script.match(/^([^:]+):\s*(.+)$/);

  if (!match) {
    return `
MANDATORY PERFORMANCE:
The character performs the described action.
Script:
${script}
`;
  }

  const speakerName = match[1].trim();
  const dialogue = match[2].trim();

  const characterMatch = characters?.find(
  (c) => c.name.toLowerCase() === speakerName.toLowerCase()
);

  const identity = characterMatch?.description || speakerName;

  return `
IDENTITY LOCK: ${speakerName}
IDENTITY DNA: ${identity}

MANDATORY SPEECH PERFORMANCE:
${speakerName} MUST speak the following dialogue aloud clearly and audibly.

MANDATORY LIP SYNC:
The mouth movement MUST match the spoken words exactly.

MANDATORY ACTOR BINDING:
This exact character MUST deliver the line. No character substitution allowed.

DIALOGUE TO SPEAK:
"${dialogue}"

PERFORMANCE INSTRUCTION:
Show the character physically speaking while delivering the dialogue naturally.
`;
}

// DO add comment: Performance Parser. Separates action and dialogue for precise cinematic execution.
function parsePerformance(script: string, characters?: Character[]) {

  if (!script) {
    return {
      action: "",
      dialogue: "",
      speaker: ""
    };
  }

  const lines = script.split("\n").map(l => l.trim()).filter(Boolean);

  let actionLines: string[] = [];
  let speaker = "";
  let dialogue = "";

  for (const line of lines) {

    const match = line.match(/^([^:]+):\s*(.+)$/);

    if (match) {
      speaker = match[1].trim();
      dialogue = match[2].trim();
    } else {
      actionLines.push(line);
    }
  }

  return {
    action: actionLines.join(" "),
    dialogue,
    speaker
  };
}

export async function generateVideoFromScene(
  scene: any,
  aspectRatio: string,
  prompt: string,
  image: string | null,
  endImage: string | null, // NEW: end frame support
  style: string,
  characterStyle: string,
  model: string,
  resolution: "720p" | "1080p",
  cameraMovement: string,
  onRetry?: (msg: string) => void,
  characters?: Character[]
): Promise<{ videoUrl: string | null; videoObject: any }> {
  const castNotes =
    characters?.map((c) => `${c.name}: ${c.description}`).join("; ") || "";

  // DO add comment: Style Fidelity in Video. Forced visual medium prefix into video generation prompts to prevent the "photorealistic video" shift.
  // DO add comment: Dialogue Binding Protocol. Forces Veo to bind spoken dialogue to the correct character identity.
  // DO add comment: Structured Actor Performance Protocol. Correctly separates action and dialogue and binds both to the same character identity.
  const perf = parsePerformance(prompt, characters);

  let identityDNA = "";
  if (perf.speaker && characters) {
    const match = characters.find(
      (c) => c.name.toLowerCase() === perf.speaker.toLowerCase()
    );
    if (match) {
      identityDNA = match.description || "";
    }
  }

  const startImagePart = scene.src
    ? {
        imageBytes: stripBase64Prefix(scene.src),
        mimeType: "image/png"
      }
    : undefined;

  const endImagePart = endImage
    ? {
        imageBytes: stripBase64Prefix(endImage),
        mimeType: "image/png"
      }
    : undefined;

  const enhancedVideoPrompt = enhanceCinematicPrompt(
    prompt,
    !!image,
    !!endImage
  );

  const fullPrompt = `
STRICT CINEMATIC VIDEO GENERATION PROTOCOL

CHARACTER CAST DNA:
${castNotes}

IDENTITY LOCK:
${perf.speaker || "Primary Character"}

IDENTITY DNA:
${identityDNA}

ACTION PERFORMANCE:
${enhancedVideoPrompt}

${
  perf.dialogue
    ? `
MANDATORY SPEECH PERFORMANCE:
${perf.speaker} MUST speak the following words aloud clearly:

"${perf.dialogue}"

MANDATORY LIP SYNC:
The character's mouth MUST visibly match the spoken dialogue.

MANDATORY ACTOR BINDING:
This exact character MUST deliver the dialogue.
`
    : `
SILENT PERFORMANCE MODE:
Character performs action with natural cinematic motion.
`
}

CAMERA MOVEMENT:
${cameraMovement}

STYLE LOCK:
${style}

VISUAL CONSISTENCY RULE:
The same character from the source image MUST perform the scene.

${
  endImagePart
    ? `
TRANSITION LOCK PROTOCOL:
The video MUST begin exactly matching the FIRST image.
The video MUST end exactly matching the SECOND image.
Maintain identity and cinematic continuity.
`
    : ""
}

FORBIDDEN:
Do not create new characters.
Do not transfer dialogue to another character.
Do not ignore dialogue if present.
`;

  try {
    const response = await fetch("/api/generate-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fullPrompt,
        aspectRatio,
        resolution,
        model,
        startImage: startImagePart,
        endImage: endImagePart,
        duration: scene?.videoLength === 6 ? 6 : 8
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || "Failed to generate video");
    }

    const data = await response.json();

    return {
      videoUrl: data.videoUrl || null,
      videoObject: data.videoObject || null
    };
  } catch (e) {
    console.error("Video generation failed", e);
    return { videoUrl: null, videoObject: null };
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
  try {
    const response = await fetch("/api/generate-story", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        idea,
        title,
        characters,
        includeDialogue,
        characterStyle,
        genre,
        movieStyle,
        numScenes,
        history,
        isMusicVideo,
        songLyrics,
        country
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || "Failed to generate story"
      );
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Story Generation Error", error);
    return null;
  }
}

// DO add comment: Added genre parameter to enable Bible narration protocol detection.
export async function generateScenesFromNarrative(
  narrative: string,
  characters: Character[],
  includeDialogue: boolean,
  characterStyle: string,
  movieStyle: string,
  country: string,
  genre?: string
): Promise<any[]> {
  try {
    const response = await fetch("/api/generate-scenes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        narrative,
        characters,
        includeDialogue,
        characterStyle,
        movieStyle,
        country,
        genre
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || "Failed to generate scenes"
      );
    }

    const data = await response.json();

    return data.scenes || [];
  } catch (error) {
    console.error("Scene Generation Error", error);
    return [];
  }
}

export async function regenerateSceneVisual(
  script: string,
  characters: Character[]
): Promise<string> {
  try {
    const response = await fetch("/api/regenerate-scene-visual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        script,
        characters
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || "Failed to regenerate scene visual"
      );
    }

    const data = await response.json();

    return data.imageDescription || "";
  } catch (error) {
    console.error("Regenerate Scene Visual Error", error);
    return "";
  }
}

export async function generateSpeech(
  text: string,
  country: string,
  voice: string,
  expression: string
): Promise<string> {
  try {
    const response = await fetch("/api/generate-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        country,
        voice,
        expression
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || "Failed to generate speech"
      );
    }

    const data = await response.json();

    return data.audio || "";
  } catch (error) {
    console.error("Speech Generation Error", error);
    return "";
  }
}

// DO add comment: Added THOUGHT PARTNER PROTOCOL: Generates directorial insights and script suggestions based on scene context.

  export async function getWritingSuggestions(
  lastScript: string,
  allScenes: any[],
  characters: Character[]
): Promise<string[]> {
  try {
    const response = await fetch("/api/get-writing-suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        lastScript,
        allScenes,
        characters
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || "Failed to get suggestions"
      );
    }

    const data = await response.json();

    return data.suggestions || [];
  } catch (error) {
    console.error("Writing suggestions failed", error);
    return [];
  }
}
/**
 * MAGIC WRITING: Polish and enrich a script beat with cinematic depth.
 * This is the 'Thought Partner' function that transforms simple notes into professional writing.
 */
export async function enrichScript(
  script: string,
  characters: Character[],
  style: string
): Promise<string> {
  try {
    const response = await fetch("/api/enrich-script", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        script,
        characters,
        style
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || "Failed to enrich script"
      );
    }

    const data = await response.json();

    return data.script || script;
  } catch (error) {
    console.error("Enrich script failed", error);
    return script;
  }
}

