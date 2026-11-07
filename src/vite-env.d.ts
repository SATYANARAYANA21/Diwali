/// <reference types="vite/client" />

declare module "*.html?raw" {
  const source: string;
  export default source;
}

declare module "*.html?url" {
  const url: string;
  export default url;
}
