const ExcelJS = require("exceljs");
const fs = require("fs-extra");


async function excelExport(rows, tokenUsage = null) {
  if (!Array.isArray(rows)) {
    throw new Error("excelExport expects rows to be an array");
  }

  const workbook = new ExcelJS.Workbook();


  const productSheet = workbook.addWorksheet("Products");

  productSheet.columns = [
    { header: "Brand Name", key: "brand_name", width: 22 },
    { header: "Product Name", key: "product_name", width: 35 },
    { header: "Furniture Type", key: "furniture_type", width: 22 },
    { header: "Design", key: "design", width: 18 },
    { header: "Product Code", key: "product_code", width: 18 },
    { header: "System Code", key: "system_code", width: 18 },
    { header: "Length (cm)", key: "length_cm", width: 14 },
    { header: "Breath (cm)", key: "breath_cm", width: 14 },
    { header: "Height (cm)", key: "height_cm", width: 14 },
    { header: "Seat Height (cm)", key: "seat_height_cm", width: 18 },
    { header: "Upholstery", key: "upholstery", width: 20 },
    { header: "Currency", key: "currency", width: 12 },
    { header: "Price", key: "price", width: 14 },
    { header: "Other Material (Comments)", key: "other_material_comments", width: 30 },
    { header: "Special Feature", key: "special_feature", width: 22 },
    { header: "Additional Price", key: "additional_price", width: 18 },
    { header: "CBM", key: "cbm", width: 10 },
    { header: "Product Weight (Kg)", key: "product_weight_kg", width: 20 },
    { header: "Remark", key: "remark", width: 22 },
    { header: "Initials", key: "initials", width: 12 },
    { header: "Date", key: "date", width: 14 },
  ];

  for (const row of rows) {
    productSheet.addRow({
      brand_name: row.brand_name ?? "",
      product_name: row.product_name ?? "",
      furniture_type: row.furniture_type ?? "",
      design: row.design ?? "",
      product_code: row.product_code ?? "",
      system_code: row.system_code ?? "",
      length_cm: row.length_cm ?? "",
      breath_cm: row.breath_cm ?? "",
      height_cm: row.height_cm ?? "",
      seat_height_cm: row.seat_height_cm ?? "",
      upholstery: row.upholstery ?? "",
      currency: row.currency ?? "",
      price: row.price ?? "",
      other_material_comments: row.other_material_comments ?? "",
      special_feature: row.special_feature ?? "",
      additional_price: row.additional_price ?? "",
      cbm: row.cbm ?? "",
      product_weight_kg: row.product_weight_kg ?? "",
      remark: row.remark ?? "",
      initials: row.initials ?? "",
      date: row.date ?? "",
    });
  }

  await fs.ensureDir("outputs");
  const outputPath = `outputs/Data_${Date.now()}.xlsx`;

  await workbook.xlsx.writeFile(outputPath);

  return outputPath;
}

module.exports = excelExport;
