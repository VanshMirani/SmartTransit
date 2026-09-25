function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csvCell(value) {
    const text = String(value ?? '');
    // Spreadsheet applications can evaluate quoted cells as formulas too.
    const safe = typeof value === 'string' && /^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
}
export function downloadCsv(filename, headers, rows) {
    const content = [headers, ...rows]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n");
    downloadBlob(new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }), filename);
}
const printableText = (value) => String(value ?? '')
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "");
const pdfText = (value) => value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
export function downloadSimplePdf(filename, title, lines) {
    const visibleLines = lines.flatMap((line) => printableText(line).match(/.{1,96}/g) ?? ['']);
    const pages = Array.from({ length: Math.max(1, Math.ceil(visibleLines.length / 40)) }, (_, index) => visibleLines.slice(index * 40, (index + 1) * 40));
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    pages.forEach((page, pageIndex) => {
        const content = [
            `BT /F1 18 Tf 48 794 Td (${pdfText(printableText(title))}) Tj ET`,
            ...page.map((line, index) => `BT /F1 9 Tf 48 ${768 - index * 17} Td (${pdfText(line)}) Tj ET`),
            `BT /F1 9 Tf 48 48 Td (Page ${pageIndex + 1} of ${pages.length}) Tj ET`,
        ].join('\n');
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + pageIndex * 2} 0 R >>`,
            `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
        .join("");
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    downloadBlob(new Blob([pdf], { type: "application/pdf" }), filename);
}
