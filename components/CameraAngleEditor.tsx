import React, { useState, useRef, useEffect } from "react";
import { CameraIcon, XIcon, CheckIcon, UserPlusIcon } from "./Icons";
import { CAMERA_ANGLE_OPTIONS } from "../services/geminiService";
import type { Character } from "../services/geminiService";

interface CameraAngleEditorProps {
  isOpen: boolean;
  characters: Character[];
  consumeCredits: (action: string) => Promise<boolean>;
  onApply: (angle: string, subject?: string) => void;
  onClose: () => void;
}

export const CameraAngleEditor: React.FC<CameraAngleEditorProps> = ({
  isOpen,
  characters,
  consumeCredits,
  onApply,
  onClose
}) => {
  const [selectedAngle, setSelectedAngle] = useState("");
  const [focusSubject, setFocusSubject] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [creditError, setCreditError] = useState(false);
  const [isCreditLocked, setIsCreditLocked] = useState(false);
  const applyButtonRef = useRef<HTMLButtonElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAngle("");
      setFocusSubject("");
      setIsConfirming(false);
      setCreditError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = async () => {
    // prevent spam click while locked
    if (isCreditLocked) return;

    // first click → enter confirm mode
    if (!isConfirming) {
      setCreditError(false);
      setIsConfirming(true);
      return;
    }

    // second click → attempt credit deduction
    setIsCreditLocked(true);

    let success = false;

    try {
      success = await consumeCredits("IMAGE_CAMERA_ANGLE_PRO");
    } catch {
      success = false;
    }

    // CREDIT FAILED → show red button and DO NOT close modal
    if (!success) {
      setCreditError(true);

      // stay in confirm mode so button stays visible and red
      // DO NOT call onApply
      // DO NOT call onClose

      setTimeout(() => {
        setCreditError(false);
        setIsConfirming(false);
        setIsCreditLocked(false);
      }, 5000);

      return;
    }

    // CREDIT SUCCESS → apply angle normally
    setCreditError(false);
    setIsConfirming(false);
    setIsCreditLocked(false);

    onApply(selectedAngle, focusSubject);

    // optional: DO NOT auto close, let parent decide
  };
    
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="font-bold text-white flex items-center gap-2">
            <CameraIcon className="w-5 h-5" /> Camera Angles
          </h2>
          <button onClick={onClose} className="p-2">
            <XIcon className="w-5 h-5 text-gray-500 hover:text-white" />
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-6">
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block mb-3">
              Sync Character (Focus Actor)
            </label>
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setFocusSubject(char.name)}
                  className={`shrink-0 w-12 h-12 rounded-full border-2 transition-all relative group ${focusSubject === char.name ? "border-indigo-500 scale-110 ring-4 ring-indigo-500/20" : "border-gray-800 opacity-40 grayscale hover:opacity-100 hover:grayscale-0"}`}
                  title={char.name}
                >
                  {char.imagePreview ? (
                    <img
                      src={char.imagePreview}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-full">
                      <UserPlusIcon className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                  {focusSubject === char.name && (
                    <div className="absolute -top-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5 shadow-lg animate-in zoom-in">
                      <CheckIcon className="w-2 h-2" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[8px] text-gray-600 font-bold  mt-2 tracking-widest italic">
              Locks visual identity to specific actor
            </p>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500  tracking-[0.2em] block mb-3">
              Select Shot
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CAMERA_ANGLE_OPTIONS.map((angle) => (
                <button
                  key={angle.key}
                  onClick={() => setSelectedAngle(angle.name)}
                  className={`p-2 text-left rounded-lg border transition-all ${selectedAngle === angle.name ? "bg-indigo-900/50 border-indigo-500 text-white shadow-lg" : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-600 hover:bg-gray-900"}`}
                >
                  <div className="text-[11px] font-black  tracking-tight">
                    {angle.name}
                  </div>
                  <div className="text-[8px] opacity-60 leading-tight mt-0.5 font-bold">
                    {angle.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-800 flex justify-end items-center gap-3 bg-[#0a0f1d]">
          {isConfirming && (
            <span className="text-[10px] font-black text-gray-500 tracking-widest">
              Cost: 2 Credits
            </span>
          )}

          {isConfirming && (
            <button
              onClick={() => setIsConfirming(false)}
              className="text-[10px] font-black text-gray-500 hover:text-gray-300 tracking-widest mr-2"
            >
              Cancel
            </button>
          )}

          <button
            ref={applyButtonRef}
            onClick={handleApply}
            disabled={!selectedAngle}
            className={`px-6 py-2.5 text-white text-[10px] font-black tracking-widest rounded-xl shadow-2xl transition-all flex items-center justify-center gap-2 active:scale-95 border ${
              creditError
                ? "bg-red-600 border-red-500 animate-pulse"
                : isConfirming
                  ? "bg-green-600 border-green-400 hover:bg-green-700"
                  : "bg-indigo-600 border-indigo-500 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-500"
            }`}
          >
            {creditError ? (
              "INSUFFICIENT CREDIT"
            ) : isConfirming ? (
              <>
                <CheckIcon className="w-4 h-4" />
                Confirm Shot
              </>
            ) : (
              <>
                <CameraIcon className="w-4 h-4" />
                Apply Camera Angle
                <span className="ml-1 text-sky-400">2C</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
