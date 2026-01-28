const ExcelJS = require("exceljs");
const fs = require("fs-extra");

function setColumns(sheet) {
  sheet.columns = [
    { header: "Brand Name", key: "brand_name", width: 20 },
    { header: "Product Code", key: "product_code", width: 18 },
    { header: "Product Name", key: "product_name", width: 30 },
    { header: "Product Type", key: "product_type", width: 18 },
    { header: "Description", key: "description", width: 50 },

    { header: "Variant Code", key: "variant_code", width: 18 },
    { header: "Variant Details", key: "variant_details", width: 30 },
    { header: "Upholstery", key: "upholstery", width: 20 },
    { header: "Materials", key: "materials", width: 25 },

    { header: "Height Value", key: "height_value", width: 12 },
    { header: "Height Unit", key: "height_unit", width: 10 },
    { header: "Length Value", key: "length_value", width: 12 },
    { header: "Length Unit", key: "length_unit", width: 10 },
    { header: "Breadth Value", key: "breadth_value", width: 12 },
    { header: "Breadth Unit", key: "breadth_unit", width: 10 },
    { header: "Seat Height Value", key: "seat_height_value", width: 14 },
    { header: "Seat Height Unit", key: "seat_height_unit", width: 12 },
    { header: "Diameter Value", key: "diameter_value", width: 12 },
    { header: "Diameter Unit", key: "diameter_unit", width: 10 },
    { header: "Weight Value", key: "weight_value", width: 12 },
    { header: "Weight Unit", key: "weight_unit", width: 10 },
    { header: "Volume Value", key: "volume_value", width: 12 },
    { header: "Volume Unit", key: "volume_unit", width: 10 },

    { header: "Currency", key: "currency", width: 10 },
    { header: "Price", key: "price", width: 14 },
    { header: "Page Number", key: "page_number", width: 12 },
  ];
}

async function excelExportSingle(rows, filePrefix) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  setColumns(sheet);

  rows.forEach((row) => sheet.addRow(row));

  await fs.ensureDir("outputs");
  const outputFilePath = `outputs/${filePrefix}_${Date.now()}.xlsx`;
  await workbook.xlsx.writeFile(outputFilePath);

  return outputFilePath;
}

module.exports = excelExportSingle;
