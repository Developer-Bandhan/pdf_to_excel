const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");

function pdfToImages(pdfPath, outputDir) {
  return new Promise((resolve, reject) => {
    const outputPrefix = path.join(outputDir, "page");
    const command = `pdftoppm -png -r 200 "${pdfPath}" "${outputPrefix}"`;

    exec(command, async (error) => {
      if (error) return reject(error);

      try {
        const files = await fs.readdir(outputDir);
        const images = files
          .filter((f) => f.endsWith(".png"))
          .sort()
          .map((f) => path.join(outputDir, f));

        resolve(images);
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = pdfToImages;
