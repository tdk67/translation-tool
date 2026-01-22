/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // This catches everything in the src folder
    "./src/**/*.{js,ts,jsx,tsx,mdx}", 
  ],
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-animate")],
};