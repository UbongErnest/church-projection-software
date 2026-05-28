/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_FLUTTERWAVE_PUBLIC_KEY?: string;
  [key: string]: unknown;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  [key: string]: unknown;
}