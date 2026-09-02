/**
 * Minimal pure-JS PDF writer (A4 portrait, Helvetica).
 * Supports titles, text lines, bordered tables, and footers.
 * No external dependencies. Latin/WinAnsi text only.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

function escapeText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' '); // strip non-Latin chars (no font embedding)
}

class PdfWriter {
  constructor() {
    this.pages = [];
    this.current = [];
    this.y = PAGE_H - MARGIN;
    this.pageNo = 1;
    this.footerText = '';
  }

  _ensureSpace(needed) {
    if (this.y - needed < MARGIN) {
      this._newPage();
    }
  }

  _newPage() {
    this.pages.push(this.current);
    this.current = [];
    this.y = PAGE_H - MARGIN;
    this.pageNo += 1;
  }

  title(text) {
    this._ensureSpace(40);
    this.current.push(`BT /F2 20 Tf ${MARGIN} ${this.y} Td (${escapeText(text)}) Tj ET`);
    this.y -= 28;
    this.current.push(`${MARGIN} ${this.y} ${PAGE_W - 2 * MARGIN} 0.8 re S`);
    this.y -= 22;
  }

  subtitle(text) {
    this._ensureSpace(24);
    this.current.push(`BT /F1 11 Tf ${MARGIN} ${this.y} Td (${escapeText(text)}) Tj ET`);
    this.y -= 18;
  }

  text(text, size = 10, bold = false) {
    this._ensureSpace(18);
    const font = bold ? '/F2' : '/F1';
    this.current.push(`BT ${font} ${size} Tf ${MARGIN} ${this.y} Td (${escapeText(text)}) Tj ET`);
    this.y -= 15;
  }

  blank(lines = 1) {
    this.y -= lines * 12;
  }

  /**
   * Render a table with borders.
   * @param {string[]} headers
   * @param {Array<Array<string|number>>} rows
   * @param {object} [opts] - { colWidths: number[] (pt), fontSize: number }
   */
  table(headers, rows, opts = {}) {
    const fontSize = opts.fontSize || 8;
    const colWidths = opts.colWidths || this._autoColWidths(headers.length);
    const rowHeight = fontSize + 8;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const x0 = MARGIN;

    const drawRow = (cells, isHeader) => {
      this._ensureSpace(rowHeight + 4);
      const yTop = this.y;
      const yBottom = yTop - rowHeight;
      // cells
      let x = x0;
      cells.forEach((cell, i) => {
        const w = colWidths[i] || 60;
        this.current.push(`${x} ${yBottom} ${w} ${rowHeight} re S`);
        const text = String(cell === undefined || cell === null ? '' : cell);
        const clipped = text.length > Math.floor(w / (fontSize * 0.5)) ? text.slice(0, Math.floor(w / (fontSize * 0.5)) - 1) + '…' : text;
        const font = isHeader ? '/F2' : '/F1';
        this.current.push(`BT ${font} ${fontSize} Tf ${x + 4} ${yBottom + 3.5} Td (${escapeText(clipped)}) Tj ET`);
        x += w;
      });
      this.y = yBottom;
    };

    drawRow(headers, true);
    rows.forEach(row => drawRow(row, false));
    this.y -= 6;
  }

  _autoColWidths(count) {
    const usable = PAGE_W - 2 * MARGIN;
    const base = Math.floor(usable / count);
    return Array(count).fill(base);
  }

  setFooter(text) {
    this.footerText = text;
  }

  /**
   * Queue a JPEG image (DCTDecode — no re-encoding needed).
   * Drawn at (x,y) bottom-left, size w×h in points.
   * Images are embedded once and shared across pages.
   */
  imageJPEG(buf, x, y, w, h) {
    this.images = this.images || [];
    const idx = this.images.length;
    this.images.push({ buf, x, y, w, h, idx });
    this.current.push(`q ${w} 0 0 ${h} ${x} ${y} cm /Im${idx} Do Q`);
    return idx;
  }

  render() {
    this.pages.push(this.current);
    this.current = [];

    // Build objects
    const objects = [];
    const addObj = (content) => {
      objects.push(content);
      return objects.length; // 1-based
    };

    // Fonts
    const font1 = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const font2 = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    // Images (JPEG/DCTDecode) — binary safe via latin1 assembly
    const imageIds = [];
    (this.images || []).forEach(img => {
      const dict = `<< /Type /XObject /Subtype /Image /Width ${img.wPx || Math.round(img.w)} /Height ${img.hPx || Math.round(img.h)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.buf.length} >>\nstream\n`;
      // store marker; binary appended during assembly
      objects.push({ __binary__: img.buf, dict });
      imageIds.push(objects.length); // 1-based id
    });
    const xobjRes = imageIds.length
      ? ` /XObject << ${imageIds.map((id, i) => `/Im${i} ${id} 0 R`).join(' ')} >>`
      : '';

    const pageRefs = [];
    this.pages.forEach((ops, idx) => {
      const footerOp = this.footerText
        ? `BT /F1 8 Tf ${MARGIN} 36 Td (${escapeText(this.footerText)} - Page ${idx + 1}) Tj ET`
        : `BT /F1 8 Tf ${MARGIN} 36 Td (Page ${idx + 1}) Tj ET`;
      const stream = ops.join('\n') + '\n' + footerOp;
      const contentId = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageId = addObj(`<< /Type /Page /Parent 1 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >>${xobjRes} >> /Contents ${contentId} 0 R >>`);
      pageRefs.push(pageId);
    });

    const pagesObj = addObj(`<< /Type /Pages /Kids [${pageRefs.map(r => `${r} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`);

    // Assemble — supports binary image objects ({ __binary__, dict })
    const chunks = [];
    const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    chunks.push(Buffer.from(header, 'latin1'));
    const realOffsets = [0];
    let pos = Buffer.byteLength(header, 'latin1');
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const idStr = `${i + 1} 0 obj\n`;
      realOffsets.push(pos);
      if (obj && obj.__binary__) {
        const head = Buffer.from(idStr + obj.dict, 'latin1');
        const tail = Buffer.from('\nendobj\n', 'latin1');
        chunks.push(head, obj.buf, tail);
        pos += head.length + obj.buf.length + tail.length;
      } else {
        const s = Buffer.from(`${idStr}${obj}\nendobj\n`, 'latin1');
        chunks.push(s);
        pos += s.length;
      }
    }
    const startxref = pos;
    let xrefBody = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      xrefBody += String(realOffsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${pagesObj} 0 R >>\nstartxref\n${startxref}\n%%EOF`;
    chunks.push(Buffer.from(xrefBody + trailer, 'latin1'));

    return Buffer.concat(chunks);
  }
}

module.exports = { PdfWriter, PAGE_W, PAGE_H };
