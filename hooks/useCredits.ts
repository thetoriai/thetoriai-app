import { useState, useEffect, useCallback } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

export const CREDIT_ACTIONS = {
  IMAGE_NORMAL: "IMAGE_NORMAL",
  IMAGE_PRO: "IMAGE_PRO",
  IMAGE_EDIT_PRO: "IMAGE_EDIT_PRO",
  IMAGE_CAMERA_ANGLE_PRO: "IMAGE_CAMERA_ANGLE_PRO",

  STORYBOOK_SCENE: "STORYBOOK_SCENE",

  CHARACTER_IMAGE: "CHARACTER_IMAGE",

  VIDEO_FAST: "VIDEO_FAST",
  VIDEO_HQ: "VIDEO_HQ",

  VIDEO_FAST_6S: "VIDEO_FAST_6S",
  VIDEO_FAST_8S: "VIDEO_FAST_8S",

  VIDEO_HQ_6S: "VIDEO_HQ_6S",
  VIDEO_HQ_8S: "VIDEO_HQ_8S",

  VIDEO_ADD_AUDIO: "VIDEO_ADD_AUDIO",

  AUDIO_GENERIC: "AUDIO_GENERIC"
};

export const useCredits = (session: any, supabase: SupabaseClient) => {
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditSettings, setCreditSettings] = useState({
    creditBalance: 0,
    currency: "EUR" as "EUR",
    exchangeRate: 1
  });

  // Fetch initial credits
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchCredits = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", session.user.id)
        .single();

      if (data && !error) {
        setCreditSettings((prev) => ({
          ...prev,
          creditBalance: data.credits
        }));
        setCreditBalance(data.credits);
      }
    };

    fetchCredits();
  }, [session, supabase]);

  // Real-time subscription
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel("credits-sync")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${session.user.id}`
        },
        (payload: any) => {
          const newCredits = payload.new.credits;
          setCreditSettings((prev) => ({
            ...prev,
            creditBalance: newCredits
          }));
          setCreditBalance(newCredits);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, supabase]);

 const consumeCredits = useCallback(
   async (actionType: keyof typeof CREDIT_ACTIONS) => {
     if (!session?.user?.id) return false;

     const { data, error } = await supabase.rpc("consume_credits", {
       p_user_id: session.user.id,
       p_action_type: actionType
     });

     // If the database returns an error
     if (error) {
       console.error("Credit consumption failed:", error);
       throw new Error("INSUFFICIENT_CREDITS");
     }

     // If the function returns false (meaning not enough credits)
     if (!data) {
       throw new Error("INSUFFICIENT_CREDITS");
     }

     return true;
   },
   [session, supabase]
 );

  return {
    creditBalance,
    creditSettings,
    consumeCredits,
    CREDIT_ACTIONS
  };
};
