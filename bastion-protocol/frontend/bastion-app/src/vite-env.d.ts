/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_RPC_URL?: string;
  }
}

export {};
