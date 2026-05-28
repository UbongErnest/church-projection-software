import { useState, useCallback, useMemo } from "react";
import { SubscriptionPlan, PaymentVerificationResult } from "../server/payments";
import { mapProfileFromDB } from "../supabase";
import { supabase } from "../supabase";

interface UseFlutterwavePaymentResult {
  initializePayment: () => void;
  isProcessing: boolean;
  paymentError: string | null;
  paymentSuccess: boolean;
  reset: () => void;
}

export function useFlutterwavePaymentHook(
  email: string,
  plan: SubscriptionPlan,
  userId: string,
  onSubscriptionUpdate?: () => void
): UseFlutterwavePaymentResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [processingReference, setProcessingReference] = useState<string | null>(null);

  const publicKey = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY;

  const handleVerifyPayment = useCallback(async (reference: string) => {
    try {
      const response = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.details || "Verification failed");
      }

      if (data?.success) {
        setPaymentSuccess(true);
        setIsProcessing(false);
        
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
          const profileResponse = await fetch("/api/profile", {
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          });
          const profileData = await profileResponse.json();
          if (onSubscriptionUpdate) {
            onSubscriptionUpdate();
          }
        }
        
        setTimeout(() => {
          alert("Payment successful! Your subscription has been activated.");
        }, 500);
      } else {
        const flutterwaveStatus = data?.flutterwaveStatus || data?.status;
        if (["pending", "processing"].includes(flutterwaveStatus)) {
          setTimeout(() => handleVerifyPayment(reference), 3000);
        } else {
          throw new Error(data?.message || "Payment verification failed");
        }
      }
    } catch (error: any) {
      setPaymentError(error.message || "Payment verification failed");
      setIsProcessing(false);
    }
  }, [onSubscriptionUpdate]);

  const initializePayment = useCallback(async () => {
    if (!publicKey) {
      setPaymentError("Flutterwave not configured. Please contact support.");
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const response = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          plan,
          userId,
        }),
      });

      const initializeData = await response.json();

      if (!response.ok) {
        throw new Error(initializeData?.details || initializeData?.error || "Failed to initialize payment.");
      }

      const paymentLink = initializeData.paymentLink;
      if (!paymentLink) {
        throw new Error("Payment link not returned from server.");
      }

      window.location.assign(paymentLink);
    } catch (error: any) {
      setPaymentError(error.message || "Payment initialization failed.");
      setIsProcessing(false);
    }
  }, [email, plan, userId, publicKey]);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setPaymentError(null);
    setPaymentSuccess(false);
    setProcessingReference(null);
  }, []);

  return {
    initializePayment,
    isProcessing,
    paymentError,
    paymentSuccess,
    reset,
  };
}