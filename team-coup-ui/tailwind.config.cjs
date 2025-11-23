module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        table: {
          bg: "#0b1020",
          card: "#171c32",
          accent: "#f5c46b",
          accentSoft: "#f5e1b8",
        },
      },
      boxShadow: {
        card: "0 18px 45px rgba(0,0,0,0.45)",
      },
      borderRadius: {
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
