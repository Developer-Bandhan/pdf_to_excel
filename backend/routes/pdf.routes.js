const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");

const pdfToImages = require("../services/pdfToImages.js");
const excelExport = require("../services/excelExport");
const geminiExtract = require("../services/geminiExtract");
const openaiExtract = require("../services/openaiExtract.js")

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/process-pdf", upload.single("pdf"), async (req, res) => {
  let imageDir = "";
  let outputFilePath = "";

  try {
    if (!req.file) return res.status(400).send("PDF file missing");

    const pdfPath = req.file.path;
    imageDir = `temp_images_${Date.now()}`;
    await fs.ensureDir(imageDir);

    // 1) PDF → Images
    const imagePaths = await pdfToImages(pdfPath, imageDir);

    // 2) Gemini Extract
    console.log("Gemini Extracting...");
    const allRows = await geminiExtract(imagePaths);
    
    // 2) OpenAI Extract
    // console.log("OpenAI Extracting...");
    // const allRows = await openaiExtract(imagePaths);

    // 3) Export Excel
    outputFilePath = await excelExport(allRows);

    // Cleanup temp
    await fs.remove(pdfPath);
    await fs.remove(imageDir);

    return res.download(outputFilePath);
  } catch (error) {
    console.error("Processing failed:", error);
    return res.status(500).send("Processing failed");
  }
});

module.exports = router;
