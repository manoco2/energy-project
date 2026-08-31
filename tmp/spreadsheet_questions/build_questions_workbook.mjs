import fs from "node:fs/promises";
import vm from "node:vm";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const workspace = "C:/Users/Pipirai/Desktop/Energy game";
const outputDir = `${workspace}/outputs/01a056fb-4234-7ab0-a47f-a30e27919030`;
const outputPath = `${outputDir}/energijos-zaidimo-klausimai-perziurai.xlsx`;
const previewPath = `${outputDir}/energijos-zaidimo-klausimai-perziurai.png`;

const questionSource = await fs.readFile(`${workspace}/questions.js`, "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(questionSource, sandbox);
const { PROFILE_QUESTIONS, QUESTIONS, CATEGORIES } = sandbox.window.EnergyAssessment;

const conditionLabels = {
  E1: "Rodomas visiems dalyviams",
  E2: "Rodomas visiems dalyviams",
  E3: "Rodomas visiems dalyviams",
  E4: "Rodomas visiems dalyviams",
  E5: "Rodomas visiems dalyviams",
  E6: "Rodomas visiems dalyviams",
  E7: "Rodomas visiems dalyviams",
  E8: "Rodomas visiems dalyviams",
  E9: "Rodomas visiems dalyviams",
  H1: "Kai S2 ≠ „Nežinau“",
  H2: "Kai S2 ≠ „Nežinau“ ir S3 = „Taip“",
  H3: "Kai S2 ≠ „Nežinau“ ir S3 = „Taip“",
  H4: "Kai S2 ≠ „Nežinau“ ir S3 = „Taip“",
  H5: "Kai S2 = „Šildausi pats / individualiai“",
  H6: "Kai S1 = „Daugiabutyje“ ir S2 = „Iš centralizuotų šilumos tinklų“ arba „Vietinė pastato katilinė“",
  H7: "Kai S1 = „Daugiabutyje“ ir S2 = „Iš centralizuotų šilumos tinklų“ arba „Vietinė pastato katilinė“",
  H8: "Kai S1 = „Daugiabutyje“ ir S2 = „Iš centralizuotų šilumos tinklų“ arba „Vietinė pastato katilinė“",
  H9: "Kai S1 = „Daugiabutyje“ ir S2 = „Iš centralizuotų šilumos tinklų“ arba „Vietinė pastato katilinė“",
};

function profileAnswerOptions(question) {
  if (question.options) return question.options.map((option) => option.label).join(" | ");
  if (question.type === "number-or-unknown") return `${question.min}–${question.max} ${question.unit} | ${question.unknownLabel}`;
  return `${question.min}–${question.max} ${question.unit}`;
}

function profileValueMapping(question) {
  if (question.options) return question.options.map((option) => `${option.label} = ${option.value}`).join(" | ");
  if (question.type === "number-or-unknown") return `Sveikasis skaičius arba „Nežinau“ = null`;
  return "Sveikasis skaičius";
}

const rows = [];
rows.push([
  1,
  "Pradinis įsivertinimas",
  "—",
  "Nepriskirta",
  "Kaip pats (-i) įvertintumėte savo energijos vartojimo sąmoningumą?",
  "1 = Labai žemas; 10 = Labai aukštas",
  "Skalė 1–10",
  "1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10",
  "Pasirinkta skaitinė reikšmė 1–10; į testo balą neįtraukiama",
  "Rodomas visiems prieš situacijos klausimus",
  "Ne",
  "Ne",
  "app.js",
  "",
  "",
]);

for (const question of PROFILE_QUESTIONS) {
  rows.push([
    rows.length + 1,
    "Situacijos klausimas",
    question.code,
    "Dalyvio profilis / šakojimas",
    question.text,
    question.code === "S7" ? "Suvartojimas nebus vertinamas kaip „didelis“, „mažas“ ar „normalus“." : "",
    question.type === "choice" ? "Vienas pasirinkimas" : question.type === "number-or-unknown" ? "Sveikasis skaičius arba „Nežinau“" : "Sveikasis skaičius",
    profileAnswerOptions(question),
    profileValueMapping(question),
    "Rodomas visiems; atsakymas gali lemti šildymo klausimų rodymą",
    "Ne",
    question.type === "number-or-unknown" ? "Taip („Nežinau“)" : "Ne",
    "questions.js",
    "",
    "",
  ]);
}

for (const question of QUESTIONS) {
  const commonOptions = "Taip / reguliariai | Kartais / iš dalies | Ne";
  rows.push([
    rows.length + 1,
    "Vertinamas testo klausimas",
    question.code,
    CATEGORIES[question.category].label,
    question.text,
    question.hint || "",
    "3 lygių vertinimo skalė" + (question.allowNA ? " + netaikoma" : ""),
    commonOptions + (question.allowNA ? ` | ${question.naLabel || "Netaikoma"}` : ""),
    "Taip / reguliariai = 2 | Kartais / iš dalies = 1 | Ne = 0" + (question.allowNA ? " | Netaikoma = null (neįtraukiama į maksimumą)" : ""),
    conditionLabels[question.code],
    "Taip",
    question.allowNA ? `Taip (${question.naLabel || "Netaikoma"})` : "Ne",
    "questions.js",
    "",
    "",
  ]);
}

const headers = [
  "Eil. Nr.",
  "Etapas",
  "Kodas",
  "Kategorija",
  "Klausimas",
  "Paaiškinimas / pastaba dalyviui",
  "Atsakymo tipas",
  "Atsakymo variantai",
  "Balai / saugoma reikšmė",
  "Kada rodomas",
  "Įskaičiuojamas į balą",
  "Leidžiama „Netaikoma“ / „Nežinau“",
  "Šaltinis",
  "Kolegos komentaras",
  "Sprendimas",
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Visi klausimai");
sheet.showGridLines = false;

sheet.getRange("A1:O1").merge();
sheet.getRange("A1").values = [["Energijos vartojimo sąmoningumo testo klausimai"]];
sheet.getRange("A2:O2").merge();
sheet.getRange("A2").values = [["Kolegų peržiūrai · 27 naudotojui rodomi klausimai: 1 pradinis įsivertinimas, 8 situacijos ir 18 vertinamų testo klausimų"]];
sheet.getRange("A3:O3").merge();
sheet.getRange("A3").values = [["Šaltiniai: questions.js ir app.js. Tušti stulpeliai „Kolegos komentaras“ ir „Sprendimas“ skirti pastaboms."]];

const headerRow = 5;
const dataStart = headerRow + 1;
const dataEnd = dataStart + rows.length - 1;
sheet.getRange(`A${headerRow}:O${headerRow}`).values = [headers];
sheet.getRange(`A${dataStart}:O${dataEnd}`).values = rows;

sheet.getRange("A1:O1").format = {
  fill: "#146B52",
  font: { bold: true, color: "#FFFFFF", size: 18 },
  verticalAlignment: "center",
};
sheet.getRange("A1:O1").format.rowHeight = 34;
sheet.getRange("A2:O2").format = {
  fill: "#E7F3EE",
  font: { color: "#214F42", size: 11 },
  verticalAlignment: "center",
};
sheet.getRange("A2:O2").format.rowHeight = 27;
sheet.getRange("A3:O3").format = {
  fill: "#F4F7F6",
  font: { color: "#4A5E58", italic: true, size: 10 },
  verticalAlignment: "center",
};
sheet.getRange("A3:O3").format.rowHeight = 25;

const headerRange = sheet.getRange(`A${headerRow}:O${headerRow}`);
headerRange.format = {
  fill: "#1F7A5C",
  font: { bold: true, color: "#FFFFFF", size: 10 },
  wrapText: true,
  verticalAlignment: "center",
  horizontalAlignment: "left",
  borders: { preset: "outside", style: "thin", color: "#155B46" },
};
headerRange.format.rowHeight = 38;

const dataRange = sheet.getRange(`A${dataStart}:O${dataEnd}`);
dataRange.format = {
  font: { color: "#25332F", size: 10 },
  wrapText: true,
  verticalAlignment: "top",
  borders: { insideHorizontal: { style: "thin", color: "#D9E3DF" }, bottom: { style: "thin", color: "#AFC3BB" } },
};
dataRange.format.rowHeight = 64;
sheet.getRange(`A${dataStart}:A${dataEnd}`).format.horizontalAlignment = "center";
sheet.getRange(`C${dataStart}:C${dataEnd}`).format.horizontalAlignment = "center";
sheet.getRange(`K${dataStart}:L${dataEnd}`).format.horizontalAlignment = "center";
sheet.getRange(`M${dataStart}:M${dataEnd}`).format.horizontalAlignment = "center";

sheet.getRange(`A${dataStart}:O${dataStart}`).format.fill = "#F6F0E4";
sheet.getRange(`A${dataStart + 1}:O${dataStart + PROFILE_QUESTIONS.length}`).format.fill = "#EEF5FA";
sheet.getRange(`A${dataStart + PROFILE_QUESTIONS.length + 1}:O${dataEnd}`).format.fill = "#F3F8F5";
sheet.getRange(`N${dataStart}:O${dataEnd}`).format.fill = "#FFF8D9";

sheet.getRange(`O${dataStart}:O${dataEnd}`).dataValidation = {
  rule: { type: "list", values: ["Palikti", "Keisti", "Šalinti", "Reikia aptarti"] },
};

sheet.getRange("A:A").format.columnWidth = 8;
sheet.getRange("B:B").format.columnWidth = 22;
sheet.getRange("C:C").format.columnWidth = 9;
sheet.getRange("D:D").format.columnWidth = 28;
sheet.getRange("E:E").format.columnWidth = 54;
sheet.getRange("F:F").format.columnWidth = 38;
sheet.getRange("G:G").format.columnWidth = 24;
sheet.getRange("H:H").format.columnWidth = 44;
sheet.getRange("I:I").format.columnWidth = 46;
sheet.getRange("J:J").format.columnWidth = 50;
sheet.getRange("K:K").format.columnWidth = 17;
sheet.getRange("L:L").format.columnWidth = 24;
sheet.getRange("M:M").format.columnWidth = 14;
sheet.getRange("N:N").format.columnWidth = 32;
sheet.getRange("O:O").format.columnWidth = 18;

sheet.freezePanes.freezeRows(headerRow);
sheet.freezePanes.freezeColumns(3);
sheet.tables.add(`A${headerRow}:O${dataEnd}`, true, "KlausimuLentele");

await fs.mkdir(outputDir, { recursive: true });
const tableCheck = await workbook.inspect({
  kind: "table",
  range: `Visi klausimai!A1:O${dataEnd}`,
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 15,
  maxChars: 12000,
});
console.log("INSPECT\n" + tableCheck.ndjson);

const errorCheck = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log("ERROR_SCAN\n" + errorCheck.ndjson);

const preview = await workbook.render({ sheetName: "Visi klausimai", range: `A1:O${dataEnd}`, scale: 1, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, previewPath, rowCount: rows.length, dataEnd }, null, 2));
