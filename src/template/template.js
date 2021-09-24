// index.js
const Mustache = require("mustache");
const fs = require("fs");

const MUSTACHE_MAIN_DIR = "./index.mustache";
const DATA = JSON.parse(fs.readFileSync('data.json'));

function generateHTML() {
  fs.readFile(MUSTACHE_MAIN_DIR, (err, data) => {
    if (err) throw err;
    // compile inde.html
    const output_en = Mustache.render(data.toString(), DATA.en);
    fs.writeFileSync("../../index.html", output_en);
    // compile tr.html
    const output_tr = Mustache.render(data.toString(), DATA.tr);
    fs.writeFileSync("../../tr.html", output_tr);
  });
}

generateHTML();
