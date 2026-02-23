const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const ExcelJS = require("exceljs");

const pdfToImages = require("../services/pdfToImages.js");
// const excelExport = require("../services/excelExport");
const { prepareExtractionContext, extractWithPlan } = require("../services/geminiExtract");
const openaiExtract = require("../services/openaiExtract.js")
const { sendEvent } = require("../utils/progress");
const PdfDocument = require("../models/PdfDocumentSchema.js");

// const ProductRow = require("../models/ProductRow");

const {
  ProductRowRun1,
  ProductRowRun2,
  ProductRowVerified
} = require("../models/ProductRow");





const router = express.Router();
const upload = multer({ dest: "uploads/" });


function normalize(v) {
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function buildRowSignature(row) {
  return [
    row.brand_name,
    row.product_code,
    row.product_name,
    row.design,
    row.length_cm,
    row.breath_cm,
    row.height_cm,
    row.seat_height_cm,
    row.cbm,
    row.price,
    row.currency,
    row.upholstery
  ].map(normalize).join("|");
}


function compareTwoRuns(run1Rows, run2Rows) {
  const map = new Map();

  for (const row of run1Rows) {
    const sig = buildRowSignature(row);
    map.set(sig, (map.get(sig) || 0) + 1);
  }

  const verified = [];

  for (const row of run2Rows) {
    const sig = buildRowSignature(row);

    if (map.has(sig) && map.get(sig) > 0) {
      verified.push({
        ...row,
        is_verified: true
      });
      map.set(sig, map.get(sig) - 1);
    }
  }

  return verified;
}


router.post("/process-pdf", upload.single("pdf"), async (req, res) => {
  let imageDir = "";
  let outputFilePath = "";

  try {
    if (!req.file) return res.status(400).send("PDF file missing");

    const pdfPath = req.file.path;
    imageDir = `temp_images_${Date.now()}`;
    await fs.ensureDir(imageDir);

    // 1) PDF → Images
    sendEvent("log", "Converting PDF to images...");
    const imagePaths = await pdfToImages(pdfPath, imageDir);

    const pdfDoc = await PdfDocument.create({
      file_name: req.file.filename,
      original_name: req.file.originalname,
      total_pages: imagePaths.length,
      status: "PROCESSING"
    })


    sendEvent("log", "Classifying pages...");
    const context = await prepareExtractionContext(imagePaths);

    const isDual = req.body.isDualExtraction === 'true' || req.body.isDualExtraction === true;

    sendEvent("log", "Extraction run 1...");
    const run1Rows = await extractWithPlan({
      imagePaths,
      plan: context.plan,
      brand_name: context.brand_name,
      classifications: context.classifications
    });

    if (run1Rows.length) {
      await ProductRowRun1.insertMany(
        run1Rows.map(r => ({
          ...r,
          pdf_id: pdfDoc._id
        })),
        { ordered: false }
      );
    }

    let run2Rows = [];
    let verifiedRows = [];

    if (isDual) {
      sendEvent("log", "Extraction run 2...");
      run2Rows = await extractWithPlan({
        imagePaths,
        plan: context.plan,
        brand_name: context.brand_name,
        classifications: context.classifications
      });

      if (run2Rows.length) {
        await ProductRowRun2.insertMany(
          run2Rows.map(r => ({
            ...r,
            pdf_id: pdfDoc._id
          })),
          { ordered: false }
        );
      }

      sendEvent("log", "Comparing extraction results...");
      verifiedRows = compareTwoRuns(run1Rows, run2Rows);
    } else {
      // sendEvent("log", "Skipping run 2 (Single Extraction mode)");
      verifiedRows = run1Rows.map(r => ({ ...r, is_verified: true }));
    }

    sendEvent("log", "Verified rows: " + verifiedRows.length);

    if (verifiedRows.length) {
      await ProductRowVerified.insertMany(
        verifiedRows.map(r => ({
          ...r,
          pdf_id: pdfDoc._id,
          is_verified: true
        })),
        { ordered: false }
      );
    }

    await PdfDocument.updateOne(
      { _id: pdfDoc._id },
      {
        status: "COMPLETED",
        run1_rows: run1Rows.length,
        run2_rows: isDual ? run2Rows.length : 0,
        verified_rows: verifiedRows.length
      }
    );

    // Cleanup temp
    await fs.remove(pdfPath);
    await fs.remove(imageDir);

    // sendEvent("log", "Generating Excel file...");

    return res.json({
      message: "Extraction completed and data stored in DB",
      run1_rows: run1Rows.length,
      run2_rows: run2Rows.length,
      verified_rows: verifiedRows.length
    });


  } catch (error) {
    console.error("Processing failed:", error);
    sendEvent("error", { message: error.message });
    return res.status(500).send("Processing failed");
  }
});


// GET all PDFs
router.get("/pdfs", async (req, res) => {
  try {
    const docs = await PdfDocument.find().sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET single PDF
router.get("/pdfs/:id", async (req, res) => {
  try {
    const doc = await PdfDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "PDF not found" });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET rows for a PDF (run1, run2, verified)
router.get("/pdfs/:id/rows", async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // type = 'run1' | 'run2' | 'verified'

    let Model;
    if (type === "run1") Model = ProductRowRun1;
    else if (type === "run2") Model = ProductRowRun2;
    else if (type === "verified") Model = ProductRowVerified;
    else return res.status(400).json({ message: "Invalid type" });

    const rows = await Model.find({ pdf_id: id }).sort({ page_number: 1 });
    res.json(rows);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Download Excel for a PDF
router.get("/pdfs/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // run1, run2, verified, all_verified

    const pdf = await PdfDocument.findById(id);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Extracted Data");

    // Define columns
    const baseColumns = [
      { header: "Pg", key: "page_number", width: 5 },
      { header: "Brand Name", key: "brand_name", width: 22 },
      { header: "Product Name", key: "product_name", width: 35 },
      { header: "Furniture Type", key: "furniture_type", width: 22 },
      { header: "Design", key: "design", width: 22 },
      { header: "Product Code", key: "product_code", width: 22 },
      { header: "System Code", key: "system_code", width: 22 },
      { header: "DIA", key: "DIA", width: 15 },
      { header: "L (cm)", key: "length_cm", width: 14 },
      { header: "B (cm)", key: "breath_cm", width: 14 },
      { header: "H (cm)", key: "height_cm", width: 14 },
      { header: "Seat Height (cm)", key: "seat_height_cm", width: 18 },
      { header: "Finish Code", key: "finish_code", width: 18 },
      { header: "Finish Specification", key: "finish_specification", width: 20 },
      { header: "Currency", key: "currency", width: 12 },
      { header: "Price", key: "price", width: 14 },
      { header: "Other Material (Comments)", key: "other_material_comments", width: 30 },
      { header: "Special Features", key: "special_features", width: 25 },
      { header: "Additional Price (Lowest)", key: "additional_price_lowest", width: 20 },
      { header: "Additional Price (Highest)", key: "additional_price_highest", width: 20 },
      { header: "CBM", key: "cbm", width: 10 },
      { header: "Product Weight (kg)", key: "product_weight_kg", width: 20 },
      { header: "Remark", key: "remark", width: 22 },
      { header: "Initials", key: "initials", width: 12 },
      { header: "Date", key: "date", width: 14 },
    ];

    if (type === "all_verified") {
      // Fetch both run1 and verified rows
      const [run1Rows, verifiedRows] = await Promise.all([
        ProductRowRun1.find({ pdf_id: id }).sort({ page_number: 1 }).lean(),
        ProductRowVerified.find({ pdf_id: id }).sort({ page_number: 1 }).lean()
      ]);

      // Build verified signatures set
      const verifiedSignatures = new Set(
        verifiedRows.map(row => buildRowSignature(row))
      );

      // Add Verified column
      worksheet.columns = [
        ...baseColumns,
        { header: "Verified", key: "verified_status", width: 12 }
      ];

      // Yellow fill for unverified rows
      const yellowFill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF3CD" }
      };

      // Add rows and apply yellow fill to unverified ones
      run1Rows.forEach(row => {
        const isVerified = verifiedSignatures.has(buildRowSignature(row));
        const excelRow = worksheet.addRow({
          ...row,
          verified_status: isVerified ? "✅ Yes" : "❌ No"
        });

        if (!isVerified) {
          excelRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill = yellowFill;
          });
        }
      });

    } else {
      // Original logic for run1, run2, verified
      let Model;
      if (type === "run1") Model = ProductRowRun1;
      else if (type === "run2") Model = ProductRowRun2;
      else if (type === "verified") Model = ProductRowVerified;
      else return res.status(400).json({ message: "Invalid type" });

      const rows = await Model.find({ pdf_id: id }).sort({ page_number: 1 });

      worksheet.columns = baseColumns;

      rows.forEach(row => {
        worksheet.addRow(row);
      });
    }

    // Formatting
    worksheet.getRow(1).font = { bold: false };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };

    const filename = pdf ? `${pdf.original_name.replace(".pdf", "")}_${type}.xlsx` : `extracted_data_${type}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
