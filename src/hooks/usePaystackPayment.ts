import { useState, useCallback, useMemo } from "react";
import { usePaystackPayment } from "react-paystack";
import { SubscriptionPlan, PaymentVerificationResult } from "../server/payments";
import { mapProfileFromDB } from "../supabase";
import { supabase } from "../supabase";

interface UsePaystackPaymentResult {
  initializePayment: () => void;
  isProcessing: boolean;
  paymentError: string | null;
  paymentSuccess: boolean;
  reset: () => void;
}

export function usePaystackPaymentHook(
  email: string,
  plan: SubscriptionPlan,
  userId: string,
  onSubscriptionUpdate?: () => void
): UsePaystackPaymentResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [processingReference, setProcessingReference] = useState<string | null>(null);

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  const config = useMemo(() => ({
    reference: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    email,
    amount: plan === "monthly" ? 1000000 : 2500000,
    publicKey: publicKey || "",
    metadata: {
      plan,
      userId,
    },
    currency: "NGN" as const,
  }), [email, plan, userId, publicKey]);

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
        
        // Refresh user profile
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
        // Payment pending - retry
        const paystackStatus = data?.paystackStatus || data?.status;
        if (["pending", "processing"].includes(paystackStatus)) {
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

  const initializePayment = usePaystackPayment(config);

  const startPayment = useCallback(() => {
    if (!publicKey) {
      setPaymentError("Paystack not configured. Please contact support.");
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    initializePayment({
      onSuccess: (reference) => {
        console.log("Payment successful:", reference.reference);
        setProcessingReference(reference.reference);
        handleVerifyPayment(reference.reference);
      },
      onClose: () => {
        console.log("Payment closed");
        setIsProcessing(false);
      },
    });
  }, [initializePayment, handleVerifyPayment, publicKey]);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setPaymentError(null);
    setPaymentSuccess(false);
    setProcessingReference(null);
  }, []);

  return {
    initializePayment: startPayment,
    isProcessing,
    paymentError,
    paymentSuccess,
    reset,
  };
}