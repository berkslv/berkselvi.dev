const colors = require("tailwindcss/colors");

(colors.blueGray = {
  ...colors.blueGray,
  750: "#3c3c4d",
  751: "#383847",
  780: "#323240",
  950: "#262630",
  1000: "#202029",
  1100: "#1c1c24",
}),
  (module.exports = {
    purge: ["./src/**/*.html", "./src/**/*.js"],
    darkMode: false, // or 'media' or 'class'
    theme: {
      extend: {},
      colors: {
        ...colors,
        prime: colors.blueGray,
      },
    },
    variants: {
      extend: {},
    },
    plugins: [],
  });
