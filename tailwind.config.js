/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Dynamic Health OS Design System mapped to CSS Variables
        brand: {
          50: "rgba(139, 168, 147, 0.05)",
          100: "rgba(139, 168, 147, 0.1)",
          200: "rgba(139, 168, 147, 0.2)",
          300: "rgba(139, 168, 147, 0.3)",
          400: "var(--brand)", // Sage Green
          500: "var(--brand)",
          600: "var(--brand)",
          700: "var(--brand)",
          800: "var(--brand)",
          900: "var(--brand)",
        },
        surface: {
          DEFAULT: "var(--background)",
          50: "rgba(255, 255, 255, 0.02)",
          100: "rgba(255, 255, 255, 0.04)",
          200: "rgba(255, 255, 255, 0.06)",
          700: "rgba(27, 34, 30, 0.4)",
          800: "rgba(27, 34, 30, 0.5)",
          900: "var(--background)", // moss obsidian
        },
        accent: {
          DEFAULT: "var(--accent)", // Terracotta
          blue: "var(--cyan)",
          purple: "var(--purple)",
          amber: "var(--amber)",
          rose: "var(--rose)",
          cyan: "var(--cyan)",
        },
        // Force standard Tailwind utility mappings to use CSS variables dynamically
        cyan: {
          50: "rgba(139, 168, 147, 0.05)",
          100: "rgba(139, 168, 147, 0.1)",
          200: "rgba(139, 168, 147, 0.2)",
          300: "rgba(139, 168, 147, 0.3)",
          400: "var(--cyan)",
          500: "var(--cyan)",
          600: "var(--cyan)",
          700: "var(--cyan)",
        },
        amber: {
          50: "rgba(200, 122, 83, 0.05)",
          400: "var(--accent)",
          500: "var(--accent)",
          600: "var(--accent)",
        },
        emerald: {
          400: "var(--brand)",
          500: "var(--brand)",
          600: "var(--brand)",
        },
        green: {
          400: "var(--brand)",
          500: "var(--brand)",
          600: "var(--brand)",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "system-ui", "sans-serif"],
        heading: ["'Space Grotesk'", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};
