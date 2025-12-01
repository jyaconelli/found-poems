import sharedPreset from "@found-poems/tailwind-config/preset";
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  presets: [sharedPreset],
} satisfies Config;
