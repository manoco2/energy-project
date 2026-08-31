(function () {
  const COLORS = {
    green: "#164f56",
    deepGreen: "#0f3e44",
    yellow: "#f1b718",
    blue: "#147db0",
    gray: "#f0f4f7",
    line: "#d8e2e5",
    ink: "#18383c",
    muted: "#617579",
    white: "#ffffff",
  };

  const encoder = new TextEncoder();
  const ascii = (value) => encoder.encode(value);

  function joinBytes(parts) {
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    parts.forEach((part) => { output.set(part, offset); offset += part.length; });
    return output;
  }

  function buildPdfFromJpeg(jpegBytes, imageWidth, imageHeight) {
    const parts = [];
    const offsets = [0];
    let length = 0;
    const push = (part) => { const bytes = typeof part === "string" ? ascii(part) : part; parts.push(bytes); length += bytes.length; };
    const object = (id, bodyParts) => {
      offsets[id] = length;
      push(`${id} 0 obj\n`);
      bodyParts.forEach(push);
      push("\nendobj\n");
    };

    push("%PDF-1.4\n");
    object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
    object(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
    object(3, ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"]);
    object(4, [
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
      jpegBytes,
      "\nendstream",
    ]);
    const content = "q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ";
    object(5, [`<< /Length ${ascii(content).length} >>\nstream\n${content}\nendstream`]);

    const xrefOffset = length;
    push("xref\n0 6\n0000000000 65535 f \n");
    for (let id = 1; id <= 5; id += 1) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
    push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return joinBytes(parts);
  }

  function leafRect(ctx, x, y, width, height, radius = 30) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth, maxLines = Infinity) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        if (lines.length < maxLines) lines.push(line);
        line = word;
      } else line = candidate;
    });
    if (line && lines.length < maxLines) lines.push(line);
    return lines;
  }

  function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
    const lines = wrapLines(ctx, text, maxWidth, maxLines);
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  }

  function formatNumber(value, maximumFractionDigits = 2) {
    return Number(value).toLocaleString("lt-LT", { minimumFractionDigits: 1, maximumFractionDigits });
  }

  function scoreRow(ctx, label, score, x, y, width) {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    ctx.fillStyle = COLORS.ink;
    ctx.font = '700 28px "Segoe UI", Arial, sans-serif';
    ctx.fillText(label, x, y);
    ctx.fillStyle = COLORS.green;
    ctx.font = '800 28px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(safeScore)} / 100`, x + width, y);
    ctx.textAlign = "left";
    ctx.fillStyle = "#dfe8ea";
    ctx.fillRect(x, y + 24, width, 14);
    const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, COLORS.blue);
    gradient.addColorStop(1, COLORS.green);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y + 24, width * safeScore / 100, 14);
  }

  function consumptionValue(value, unit) {
    return Number.isFinite(value) ? `${formatNumber(value)} ${unit}` : "Nenurodyta";
  }

  function loadLogo() {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Nepavyko įkelti LEA logotipo."));
      image.src = "images/LEA-LOGOTIPAS-ŽALIAS.png";
    });
  }

  async function renderCard(data) {
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    const logo = await loadLogo();
    const x = 84;
    const width = 1072;

    ctx.fillStyle = COLORS.gray;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.white;
    leafRect(ctx, 42, 42, 1156, 1670, 48);
    ctx.fill();

    ctx.drawImage(logo, x, 74, 360, 120);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 24px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(`Atlikta: ${data.completedDate}`, x + width, 120);
    ctx.fillText("Energijos vartojimo sąmoningumo testas", x + width, 158);
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(x, 218, width, 12);

    ctx.fillStyle = COLORS.green;
    ctx.font = '800 48px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Jūsų testo rezultatas", x, 295);

    const scoreGradient = ctx.createLinearGradient(x, 0, x + width, 0);
    scoreGradient.addColorStop(0, COLORS.green);
    scoreGradient.addColorStop(1, COLORS.blue);
    ctx.fillStyle = scoreGradient;
    leafRect(ctx, x, 330, width, 250, 44);
    ctx.fill();
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.arc(250, 455, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.deepGreen;
    ctx.beginPath();
    ctx.arc(250, 455, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = "center";
    ctx.font = '900 64px "Segoe UI", Arial, sans-serif';
    ctx.fillText(String(Math.round(Number(data.totalScore))), 250, 466);
    ctx.font = '700 21px "Segoe UI", Arial, sans-serif';
    ctx.fillText("/ 100", 250, 502);
    ctx.textAlign = "left";
    ctx.fillStyle = "#cfe9f1";
    ctx.font = '800 21px "Segoe UI", Arial, sans-serif';
    ctx.fillText("BENDRAS BALAS", 410, 405);
    ctx.fillStyle = COLORS.white;
    ctx.font = '800 37px "Segoe UI", Arial, sans-serif';
    drawWrapped(ctx, "Energijos vartojimo sąmoningumo testo rezultatas", 410, 458, 650, 45, 3);

    ctx.fillStyle = COLORS.green;
    ctx.font = '800 34px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Rezultatas pagal temas", x, 650);
    data.categories.forEach((category, index) => scoreRow(ctx, category.label, category.score, x, 705 + index * 72, width));

    const categoryCount = data.categories.length;
    const comparisonHeadingY = 705 + categoryCount * 72 + 32;
    ctx.fillStyle = COLORS.green;
    ctx.font = '800 34px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Palyginimas su grupe", x, comparisonHeadingY);
    const comparisonBoxY = comparisonHeadingY + 24;
    if (data.scoreComparison.unlocked) {
      ctx.fillStyle = COLORS.green;
      leafRect(ctx, x, comparisonBoxY, width, 132, 28);
      ctx.fill();
      const comparisonColumns = [x + 34, x + 390, x + 746];
      const comparisonLabels = ["Jūsų rezultatas", "Grupės vidurkis", "Aukštesnis rezultatas nei"];
      const comparisonValues = [
        `${data.scoreComparison.ownScore} / 100`,
        `${data.scoreComparison.groupAverage} / 100`,
        data.scoreComparison.percentile > 0 ? `${data.scoreComparison.percentile} % dalyvių` : "—",
      ];
      comparisonColumns.forEach((columnX, index) => {
        ctx.fillStyle = "#cfe5e8";
        ctx.font = '700 20px "Segoe UI", Arial, sans-serif';
        ctx.fillText(comparisonLabels[index], columnX, comparisonBoxY + 42);
        ctx.fillStyle = index === 0 ? COLORS.yellow : COLORS.white;
        ctx.font = '900 34px "Segoe UI", Arial, sans-serif';
        ctx.fillText(comparisonValues[index], columnX, comparisonBoxY + 91);
      });
    } else {
      ctx.fillStyle = COLORS.gray;
      leafRect(ctx, x, comparisonBoxY, width, 132, 28);
      ctx.fill();
      ctx.fillStyle = COLORS.muted;
      ctx.font = '700 24px "Segoe UI", Arial, sans-serif';
      drawWrapped(ctx, "Grupės palyginimas bus rodomas, kai testą baigs bent 5 dalyviai.", x + 28, comparisonBoxY + 56, width - 56, 32, 2);
    }

    const consumptionY = comparisonBoxY + 190;
    ctx.fillStyle = COLORS.green;
    ctx.font = '800 34px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Elektros energijos suvartojimas per mėnesį", x, consumptionY);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '500 21px "Segoe UI", Arial, sans-serif';
    drawWrapped(ctx, "Palyginimas pagal nurodytą būsto plotą, namų ūkio dydį ir vidutinį elektros energijos suvartojimą.", x, consumptionY + 38, width, 28, 2);

    const tableY = consumptionY + 92;
    const columns = [480, 235, 357];
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(x, tableY, width, 58);
    ctx.fillStyle = COLORS.white;
    ctx.font = '700 19px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Rodiklis", x + 22, tableY + 37);
    ctx.fillText("Jūs", x + columns[0] + 22, tableY + 37);
    ctx.fillText("Kiti dalyviai vidutiniškai", x + columns[0] + columns[1] + 22, tableY + 37);

    data.consumptionRows.forEach((row, index) => {
      const rowY = tableY + 58 + index * 88;
      ctx.fillStyle = index % 2 ? COLORS.white : COLORS.gray;
      ctx.fillRect(x, rowY, width, 88);
      ctx.strokeStyle = COLORS.line;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, rowY, width, 88);
      ctx.fillStyle = COLORS.ink;
      ctx.font = '700 21px "Segoe UI", Arial, sans-serif';
      drawWrapped(ctx, row.label, x + 22, rowY + 32, columns[0] - 44, 25, 2);
      ctx.fillStyle = COLORS.green;
      ctx.font = '800 21px "Segoe UI", Arial, sans-serif';
      drawWrapped(ctx, row.own, x + columns[0] + 22, rowY + 32, columns[1] - 40, 25, 2);
      drawWrapped(ctx, row.others, x + columns[0] + columns[1] + 22, rowY + 32, columns[2] - 42, 25, 2);
    });

    const noteY = tableY + 58 + data.consumptionRows.length * 88 + 27;
    ctx.fillStyle = COLORS.blue;
    ctx.font = '600 19px "Segoe UI", Arial, sans-serif';
    drawWrapped(ctx, data.comparisonNote, x, noteY, width, 26, 2);

    ctx.strokeStyle = COLORS.line;
    ctx.beginPath();
    ctx.moveTo(x, 1625);
    ctx.lineTo(x + width, 1625);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '500 20px "Segoe UI", Arial, sans-serif';
    drawWrapped(ctx, "Praktinio mokymų testo rezultatas skirtas apmąstymui, o ne diagnostiniam vertinimui.", x, 1668, width, 28, 2);

    return canvas;
  }

  async function downloadResultPdf(data) {
    const canvas = await renderCard(data);
    const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!jpegBlob) throw new Error("Nepavyko paruošti PDF vaizdo.");
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const pdfBytes = buildPdfFromJpeg(jpegBytes, canvas.width, canvas.height);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `LEA-energijos-testo-rezultatas-${data.fileDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function createResultData({ result, profile, groupComparison, completedAt }) {
    const monthlyKwh = typeof profile.S7 === "number" ? profile.S7 : null;
    const ownPerSquareMetre = monthlyKwh !== null && Number(profile.S4) > 0 ? monthlyKwh / Number(profile.S4) : NaN;
    const ownPerPerson = monthlyKwh !== null && Number(profile.S5) > 0 ? monthlyKwh / Number(profile.S5) : NaN;
    const otherSquare = groupComparison?.other_per_square_metre;
    const otherPerson = groupComparison?.other_per_household_member;
    const groupReady = groupComparison?.unlocked && otherSquare !== null && otherSquare !== undefined && otherPerson !== null && otherPerson !== undefined;
    const completedDate = new Date(completedAt || Date.now());
    const categories = [
      { label: "Pažįstu savo elektros vartojimą", score: result.electricity_awareness_score },
      { label: "Valdau elektros vartojimą", score: result.electricity_management_score },
    ];
    if (result.heating_score !== null && result.heating_score !== undefined) categories.push({ label: "Suprantu savo šilumos vartojimą", score: result.heating_score });
    const scoreComparisonUnlocked = Boolean(groupComparison?.unlocked);
    return {
      totalScore: result.total_score,
      categories,
      scoreComparison: {
        unlocked: scoreComparisonUnlocked,
        ownScore: Math.round(Number(result.total_score)),
        groupAverage: scoreComparisonUnlocked ? Math.round(Number(groupComparison.group_average)) : null,
        percentile: scoreComparisonUnlocked ? Math.round(Number(groupComparison.percentile)) : null,
        completedCount: Number(groupComparison?.completed_count) || 0,
      },
      completedDate: completedDate.toLocaleDateString("lt-LT", { year: "numeric", month: "long", day: "numeric" }),
      fileDate: [completedDate.getFullYear(), String(completedDate.getMonth() + 1).padStart(2, "0"), String(completedDate.getDate()).padStart(2, "0")].join("-"),
      consumptionRows: [
        { label: "Vienam būsto kvadratiniam metrui", own: consumptionValue(ownPerSquareMetre, "kWh/m²"), others: groupReady ? consumptionValue(Number(otherSquare), "kWh/m²") : "Dar nepakanka duomenų" },
        { label: "Vienam namų ūkio nariui", own: consumptionValue(ownPerPerson, "kWh/žm.") , others: groupReady ? consumptionValue(Number(otherPerson), "kWh/žm.") : "Dar nepakanka duomenų" },
      ],
      comparisonNote: groupReady
        ? `Kitų dalyvių vidurkis apskaičiuotas iš ${Number(groupComparison.consumption_comparison_count)} galiojančių atsakymų.`
        : "Kitų dalyvių vidurkis rodomas tik turint bent 4 kitų dalyvių elektro energijos suvartojimo duomenis.",
    };
  }

  function createGroupResultData({ summary, updatedAt, questionByCode }) {
    const updatedDate = new Date(updatedAt || Date.now());
    const mapQuestions = (items = []) => items.map((item) => ({
      code: item.question_code,
      text: questionByCode(item.question_code)?.text || "Klausimo tekstas nerastas",
      score: Math.round(Number(item.score)),
      validN: Number(item.valid_n),
    }));
    return {
      unlocked: Boolean(summary.unlocked),
      overallAverage: summary.overall_average === null || summary.overall_average === undefined ? null : Math.round(Number(summary.overall_average)),
      selfRatingAverage: summary.self_rating_average === null || summary.self_rating_average === undefined ? null : Math.round(Number(summary.self_rating_average)),
      completedCount: Number(summary.completed_count) || 0,
      lowestQuestions: mapQuestions(summary.lowest_questions),
      highestQuestions: mapQuestions(summary.highest_questions),
      updatedLabel: updatedDate.toLocaleString("lt-LT", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
      fileDate: [updatedDate.getFullYear(), String(updatedDate.getMonth() + 1).padStart(2, "0"), String(updatedDate.getDate()).padStart(2, "0")].join("-"),
    };
  }

  function drawGroupQuestion(ctx, item, x, y, width, kind, index) {
    ctx.fillStyle = kind === "strength" ? "#edf6f2" : "#fff8e8";
    leafRect(ctx, x, y, width, 220, 24);
    ctx.fill();
    ctx.fillStyle = kind === "strength" ? COLORS.green : COLORS.yellow;
    leafRect(ctx, x + 20, y + 20, 54, 54, 14);
    ctx.fill();
    ctx.fillStyle = kind === "strength" ? COLORS.white : COLORS.deepGreen;
    ctx.font = '900 26px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(String(index + 1), x + 47, y + 56);
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.green;
    ctx.font = '900 38px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${item.score} / 100`, x + 92, y + 55);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Vidutinis įvertinimas", x + 92, y + 82);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '700 21px "Segoe UI", Arial, sans-serif';
    drawWrapped(ctx, item.text, x + 24, y + 126, width - 48, 27, 3);
    ctx.fillStyle = COLORS.blue;
    ctx.font = '700 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Atsakė: ${item.validN}`, x + 24, y + 199);
  }

  async function renderGroupCard(data) {
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    const logo = await loadLogo();
    const margin = 70;
    const contentWidth = canvas.width - margin * 2;

    ctx.fillStyle = COLORS.gray;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.white;
    leafRect(ctx, 38, 38, 1164, 1678, 48);
    ctx.fill();
    ctx.drawImage(logo, margin, 68, 330, 110);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 21px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(`Rezultatai atnaujinti: ${data.updatedLabel}`, margin + contentWidth, 112);
    ctx.fillText(`Dalyvių skaičius: ${data.completedCount}`, margin + contentWidth, 148);
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(margin, 205, contentWidth, 10);
    ctx.fillStyle = COLORS.green;
    ctx.font = '900 48px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Grupės rezultatai", margin, 280);

    if (!data.unlocked) {
      ctx.fillStyle = COLORS.green;
      ctx.font = '800 38px "Segoe UI", Arial, sans-serif';
      drawWrapped(ctx, "Grupės rezultatai bus rodomi, kai testą baigs bent 5 dalyviai.", margin, 430, contentWidth, 52, 3);
      return canvas;
    }

    const summaryY = 330;
    ctx.fillStyle = COLORS.green;
    leafRect(ctx, margin, summaryY, contentWidth, 235, 36);
    ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.font = '800 25px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Grupės vidurkis pagal testo atsakymus", margin + 42, summaryY + 58);
    ctx.font = '900 78px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${data.overallAverage} / 100`, margin + 42, summaryY + 148);
    ctx.fillStyle = COLORS.yellow;
    ctx.font = '800 25px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Vidutinis dalyvių savęs vertinimas prieš testą", margin + 590, summaryY + 58);
    ctx.font = '900 64px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${data.selfRatingAverage} %`, margin + 590, summaryY + 143);

    const columnGap = 28;
    const columnWidth = (contentWidth - columnGap) / 2;
    const leftX = margin;
    const rightX = margin + columnWidth + columnGap;
    const headingY = 640;
    ctx.fillStyle = COLORS.green;
    ctx.font = '900 32px "Segoe UI", Arial, sans-serif';
    ctx.fillText("Kur turime tobulėti?", leftX, headingY);
    ctx.fillText("Ką geriausiai išmanome?", rightX, headingY);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 17px "Segoe UI", Arial, sans-serif';
    ctx.fillText("3 prasčiausiai įvertinti klausimai", leftX, headingY + 30);
    ctx.fillText("3 geriausiai įvertinti klausimai", rightX, headingY + 30);

    const empty = { text: "Nepakanka bent 5 galiojančių atsakymų.", score: 0, validN: 0 };
    for (let index = 0; index < 3; index += 1) {
      drawGroupQuestion(ctx, data.lowestQuestions[index] || empty, leftX, 700 + index * 245, columnWidth, "improvement", index);
      drawGroupQuestion(ctx, data.highestQuestions[index] || empty, rightX, 700 + index * 245, columnWidth, "strength", index);
    }

    ctx.strokeStyle = COLORS.line;
    ctx.beginPath();
    ctx.moveTo(margin, 1630);
    ctx.lineTo(margin + contentWidth, 1630);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '500 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText("PDF sukurtas iš to paties duomenų snapshot, kuris buvo rodomas rezultatų ekrane.", margin, 1670);
    return canvas;
  }

  async function downloadGroupResultPdf(data) {
    const canvas = await renderGroupCard(data);
    const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!jpegBlob) throw new Error("Nepavyko paruošti PDF vaizdo.");
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const pdfBytes = buildPdfFromJpeg(jpegBytes, canvas.width, canvas.height);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `LEA-grupes-rezultatai-${data.fileDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  window.ResultPdf = { buildPdfFromJpeg, createResultData, downloadResultPdf, createGroupResultData, downloadGroupResultPdf };
})();
