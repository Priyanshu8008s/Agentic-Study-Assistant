/** @type {import('tailwindcss').Config} */
export default {
  content: ["./client/index.html", "./client/src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#151826",
        mist: "#eef2ff",
        horizon: "#d7f0ff",
        sand: "#f7e7c6",
        ember: "#b45c3e",
        pine: "#294b4a"
      },
      boxShadow: {
        glow: "0 20px 50px rgba(21, 24, 38, 0.12)"
      }
    }
  },
  plugins: []
};
