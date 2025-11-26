import type { Config } from "tailwindcss";
import sharedPreset from "@found-poems/tailwind-config/preset";

export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	presets: [sharedPreset],
	theme: {
		extend: {
			fontFamily: {
				sans: ['"Coral Pixels"', "ui-sans-serif", "system-ui"],
			},
		},
	},
} satisfies Config;
