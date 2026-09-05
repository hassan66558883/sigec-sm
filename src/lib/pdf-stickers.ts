import PDFDocument from "pdfkit";

// Planche d'autocollants QR imprimable (module paiement QR, section 38).
// pdfkit choisi deliberement (deja evalue vs alternatives — voir memoire
// de session) : generation programmatique pure, pas de navigateur headless
// (puppeteer) a faire tourner pour un simple assemblage grille image+texte.
export type StickerItem = { png: Buffer; label: string; reference: string };

const PAGE_MARGIN = 24;
const COLUMNS = 3;
const CELL_HEIGHT = 190;
const QR_SIZE = 130;

export function generateQrStickerSheetPdf(items: StickerItem[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const usableWidth = doc.page.width - PAGE_MARGIN * 2;
    const cellWidth = usableWidth / COLUMNS;
    const rowsPerPage = Math.floor((doc.page.height - PAGE_MARGIN * 2) / CELL_HEIGHT);

    items.forEach((item, index) => {
      const positionOnPage = index % (COLUMNS * rowsPerPage);
      if (index > 0 && positionOnPage === 0) doc.addPage();
      const col = positionOnPage % COLUMNS;
      const row = Math.floor(positionOnPage / COLUMNS);
      const x = PAGE_MARGIN + col * cellWidth;
      const y = PAGE_MARGIN + row * CELL_HEIGHT;

      doc.rect(x + 4, y + 4, cellWidth - 8, CELL_HEIGHT - 8).stroke("#cccccc");
      doc.image(item.png, x + (cellWidth - QR_SIZE) / 2, y + 12, { width: QR_SIZE, height: QR_SIZE });
      doc
        .fontSize(9)
        .fillColor("#000000")
        .text(item.label, x + 6, y + QR_SIZE + 18, { width: cellWidth - 12, align: "center", height: 26 });
      doc
        .fontSize(7)
        .fillColor("#666666")
        .text(item.reference, x + 6, y + QR_SIZE + 44, { width: cellWidth - 12, align: "center" });
    });

    doc.end();
  });
}
