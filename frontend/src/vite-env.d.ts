/// <reference types="vite/client" />

interface ImportMetaEnv {
  // URL publica del backend en produccion (Railway); ver frontend/src/api/client.ts.
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
