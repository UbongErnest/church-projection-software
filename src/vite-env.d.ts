/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAYSTACK_PUBLIC_KEY: string;
  [key: string]: unknown;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  [key: string]: unknown;
}