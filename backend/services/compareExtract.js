function normalizeValue(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizePrice(v) {
  return normalizeValue(v).replace(/[\s,]/g, "");
}

function normalizeUnit(v) {
  return normalizeValue(v).replace(/\./g, "");
}

function normalizeNumber(v) {
  if (v === null || v === undefined) return null;
  const cleaned = String(v).replace(/[^\d.-]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function numberMatch(a, b, tolerance = 0.01) {
  const na = normalizeNumber(a);
  const nb = normalizeNumber(b);

  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;

  return Math.abs(na - nb) <= tolerance;
}

function fuzzyTextMatch(a, b) {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);

  if (!na && !nb) return true;
  if (!na || !nb) return false;
  if (na === nb) return true;

  // allow substring equality (description often differs slightly)
  if (na.includes(nb) || nb.includes(na)) return true;

  return false;
}

/**
 * Key strategy:
 * - first try product_code+variant_code
 * - fallback: page_number + product_name + price
 */
function buildKeyPrimary(row) {
  const p = normalizeValue(row.product_code);
  const v = normalizeValue(row.variant_code);
  if (!p && !v) return "";
  return `${p}__${v}`;
}

function buildKeyFallback(row) {
  const page = normalizeValue(row.page_number);
  const name = normalizeValue(row.product_name);
  const price = normalizePrice(row.price);
  return `${page}__${name}__${price}`;
}

function compareRowFull(gRow, oRow) {
  // schema for all columns
  const schema = [
    { field: "brand_name", type: "norm" },
    { field: "product_code", type: "norm" },
    { field: "product_name", type: "norm" },
    { field: "product_type", type: "norm" },
    { field: "description", type: "fuzzy" },

    { field: "variant_code", type: "norm" },
    { field: "variant_details", type: "fuzzy" },
    { field: "upholstery", type: "norm" },
    { field: "materials", type: "norm" },

    { field: "height_value", type: "num" },
    { field: "height_unit", type: "unit" },
    { field: "length_value", type: "num" },
    { field: "length_unit", type: "unit" },
    { field: "breadth_value", type: "num" },
    { field: "breadth_unit", type: "unit" },
    { field: "seat_height_value", type: "num" },
    { field: "seat_height_unit", type: "unit" },
    { field: "diameter_value", type: "num" },
    { field: "diameter_unit", type: "unit" },
    { field: "weight_value", type: "num" },
    { field: "weight_unit", type: "unit" },
    { field: "volume_value", type: "num" },
    { field: "volume_unit", type: "unit" },

    { field: "currency", type: "norm" },
    { field: "price", type: "price" },
    { field: "page_number", type: "num" },
  ];

  const diffs = [];

  for (const { field, type } of schema) {
    const g = gRow?.[field];
    const o = oRow?.[field];

    let ok = true;

    if (type === "norm") ok = normalizeValue(g) === normalizeValue(o);
    if (type === "price") ok = normalizePrice(g) === normalizePrice(o);
    if (type === "unit") ok = normalizeUnit(g) === normalizeUnit(o);
    if (type === "num") ok = numberMatch(g, o);
    if (type === "fuzzy") ok = fuzzyTextMatch(g, o);

    if (!ok) {
      diffs.push({
        field,
        gemini: g ?? "",
        openai: o ?? "",
      });
    }
  }

  return { ok: diffs.length === 0, diffs };
}

function compareExtractsFull(geminiRows, openaiRows) {
  const gMap = new Map();
  const oMap = new Map();

  // index rows
  for (const r of geminiRows) {
    const k1 = buildKeyPrimary(r);
    const k2 = buildKeyFallback(r);
    if (k1) gMap.set(k1, r);
    gMap.set(`fallback__${k2}`, r);
  }

  for (const r of openaiRows) {
    const k1 = buildKeyPrimary(r);
    const k2 = buildKeyFallback(r);
    if (k1) oMap.set(k1, r);
    oMap.set(`fallback__${k2}`, r);
  }

  const matched = [];
  const mismatched = [];

  // get candidate key set
  const allKeys = new Set([...gMap.keys(), ...oMap.keys()]);

  for (const key of allKeys) {
    const gRow = gMap.get(key);
    const oRow = oMap.get(key);

    if (!gRow || !oRow) {
      // mismatch due to missing row
      mismatched.push({
        key,
        issue: !gRow ? "missing_in_gemini" : "missing_in_openai",
        gemini: gRow || null,
        openai: oRow || null,
        diffs: [],
      });
      continue;
    }

    const result = compareRowFull(gRow, oRow);

    if (result.ok) {
      matched.push(gRow);
    } else {
      mismatched.push({
        key,
        issue: "full_column_mismatch",
        gemini: gRow,
        openai: oRow,
        diffs: result.diffs,
      });
    }
  }

  // remove duplicates caused by fallback keys
  const uniq = (rows) => {
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      const k = JSON.stringify({
        product_code: normalizeValue(r.product_code),
        variant_code: normalizeValue(r.variant_code),
        product_name: normalizeValue(r.product_name),
        price: normalizePrice(r.price),
        page_number: normalizeValue(r.page_number),
      });
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out;
  };

  return {
    matchedRows: uniq(matched),
    mismatchedRows: mismatched,
  };
}

module.exports = compareExtractsFull;
