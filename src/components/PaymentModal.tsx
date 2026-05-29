import { useState, useCallback, useMemo } from "react";
import { Check, AlertTriangle, RefreshCw, CreditCard } from "lucide-react";
import { SubscriptionPlan } from "../server/payments";
import { PaymentState } from "../types";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: SubscriptionPlan;
  email: string;
  userId: string;
  onSuccess: () => void;
}

export default function PaymentModal({ isOpen, onClose, plan, email, userId, onSuccess }: PaymentModalProps) {
  const [paymentState, setPaymentState] = useState<PaymentState>({
    status: "idle",
    message: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = useCallback(async () => {
    if (!import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY) {
      setPaymentState({
        status: "error",
        message: "Flutterwave public key not configured. Please contact support.",
      });
      return;
    }

    setIsProcessing(true);
    setPaymentState({ status: "loading", message: "Initializing payment..." });

    try {
      const response = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to initialize payment");
      }

      const paymentLink = data.paymentLink;
      if (paymentLink) {
        window.location.assign(paymentLink);
      } else {
        throw new Error("Payment link not returned from server");
      }
    } catch (error: any) {
      setPaymentState({ 
        status: "error", 
        message: error.message || "Payment initialization failed" 
      });
      setIsProcessing(false);
    }
  }, [email, plan, userId, onClose]);

  const handleVerifyPayment = async (reference: string) => {
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
        setPaymentState({ status: "success", message: "Payment verified successfully!" });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else if (data?.flutterwaveStatus === "pending" || data?.status === "pending") {
        setPaymentState({ 
          status: "verifying", 
          message: "Payment is being processed. This may take a few seconds..." 
        });
        
        // Retry verification
        let attempts = 0;
        const maxAttempts = 5;
        const checkInterval = setInterval(async () => {
          attempts++;
          const verifyResponse = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference }),
          });
          const verifyData = await verifyResponse.json();
          
          if (verifyData?.success) {
            clearInterval(checkInterval);
            setPaymentState({ status: "success", message: "Payment verified successfully!" });
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 1500);
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            setPaymentState({ status: "error", message: "Payment verification timed out. Please check your subscription status later." });
            setIsProcessing(false);
          }
        }, 3000);
      } else {
        throw new Error(data?.message || "Payment verification failed");
      }
    } catch (error: any) {
      setPaymentState({ 
        status: "error", 
        message: error.message || "Payment verification failed" 
      });
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setPaymentState({ status: "idle", message: "" });
    setIsProcessing(false);
    handlePayment();
  };

  if (!isOpen) return null;

  const planName = plan === "monthly" ? "Pro Monthly" : "Premium Plan";
  const planPrice = plan === "monthly" ? "₦10,500" : "₦25,500";

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-[#111317] border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-lg text-white">Complete Payment</h3>
        </div>

        <div className="bg-white/5 border border-white/5 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/60 text-xs uppercase">Plan</span>
            <span className="text-white font-bold text-sm">{planName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-xs uppercase">Amount</span>
            <span className="text-amber-400 font-mono font-bold text-lg">{planPrice}</span>
          </div>
        </div>

        {paymentState.status !== "success" && (
          <div className="mb-4">
            {paymentState.status === "loading" && (
              <div className="flex items-center gap-2 text-blue-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Opening Flutterwave...</span>
              </div>
            )}
            {paymentState.status === "verifying" && (
              <div className="flex items-center gap-2 text-amber-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">{paymentState.message}</span>
              </div>
            )}
            {paymentState.status === "error" && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{paymentState.message}</span>
              </div>
            )}
          </div>
        )}

        {paymentState.status === "success" && (
          <div className="flex items-center gap-2 text-green-400 mb-4">
            <Check className="w-5 h-5" />
            <span className="font-bold">Payment successful! Activating subscription...</span>
          </div>
        )}

        {paymentState.status === "error" && (
          <button
            onClick={handleRetry}
            className="w-full mb-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition cursor-pointer"
          >
            Try Again
          </button>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isProcessing && paymentState.status !== "error"}
            className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 rounded-lg transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={isProcessing || !import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-2"
          >
            {isProcessing && paymentState.status !== "success" ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Pay Now"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}