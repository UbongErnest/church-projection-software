/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_PAYSTACK_PUBLIC_KEY?: string;
  [key: string]: unknown;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  [key: string]: unknown;
}

declare module "react-paystack" {
  import { Reference } from "react-paystack/dist/types";

  export interface PaystackProps {
    reference: string;
    email: string;
    amount: number;
    publicKey: string;
    currency?: string;
    metadata?: Record<string, unknown>;
    channels?: string[];
    label?: string;
    plan?: string;
    quantity?: number;
    subaccount?: string;
    splitCode?: string;
    onSuccess?: (reference: Reference) => void;
    onClose?: () => void;
  }

  export interface Reference {
    message: string;
    reference: string;
    status: string;
    transactionReference: string;
    trace: string;
  }

  export function usePaystackPayment(config: PaystackProps): (configOverride?: { onSuccess?: (reference: Reference) => void; onClose?: () => void }) => void;

  export { usePaystackPayment };
}
