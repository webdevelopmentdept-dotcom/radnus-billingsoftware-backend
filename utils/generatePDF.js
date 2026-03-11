// const html_to_pdf = require("html-pdf-node");

// const generatePDF = async (jobId) => {

//   const url = `https://service.radnus.in/estimate-bill/${jobId}`;

//   const options = {
//     format: "A4",
//     printBackground: true,
//     args: [
//       "--no-sandbox",
//       "--disable-setuid-sandbox"
//     ]
//   };

//   const file = { url };

//   const pdfBuffer = await html_to_pdf.generatePdf(file, options);

//   return pdfBuffer;
// };

// module.exports = generatePDF;

const path = require("path");
const PDFDocument = require("pdfkit");

const logoPath = path.join(__dirname, "../assets/logo.png");

const generatePDF = (job) => {
  return new Promise((resolve) => {

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    const service = Number(job.service?.serviceCharge || 0);
    const spare   = Number(job.service?.spareCharge   || 0);
    const total   = service + spare;

    /* ─────────────────────────────────────────
       WATERMARK  –  centred diagonal, very light
    ───────────────────────────────────────── */
    doc.save();
    doc.rotate(-35, { origin: [297, 421] })
       .fontSize(110)
       .fillOpacity(0.07)
       .fillColor("#000000")
       .font("Helvetica-Bold")
       .text("RADNUS", 0, 370, { width: 595, align: "center" });
    doc.restore();
    doc.fillOpacity(1).fillColor("#000");

    /* ─────────────────────────────────────────
       HEADER LEFT
    ───────────────────────────────────────── */
    doc.fontSize(15).font("Helvetica-Bold")
       .fillColor("#000")
       .text("RADNUS COMMUNICATION", 40, 40);

    doc.fontSize(9.5).font("Helvetica")
       .text("242, Sinnaya Plaza, MG Road,", 40, 58)
       .text("Puducherry - 605001",           40, 71)
       .text("Phone: 81222 73355",            40, 84)
       .text("Mon–Sat (10AM–7PM)",            40, 97)
       .text("Website: www.radnus.in",        40, 110);

    /* ─────────────────────────────────────────
       LOGO
    ───────────────────────────────────────── */
    doc.image(logoPath, 235, 40, { width: 105 });

    /* ─────────────────────────────────────────
       HEADER RIGHT – JOB SHEET
       Fix: strip timezone from date strings
    ───────────────────────────────────────── */
    const rX = 395;

    doc.fontSize(13).font("Helvetica-Bold")
       .text("JOB SHEET", rX, 40);

    // Safe date formatter – returns only YYYY-MM-DD, never timezone text
    const fmtDate = (val) => {
      if (!val) return "NIL";
      const s = String(val);
      // If already YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      // Try to parse and extract date portion only
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      // Fallback: just take first 10 chars
      return s.slice(0, 10);
    };

    const jobRows = [
      ["Job No",   job.jobSheetNo              || "NIL"],
      ["Created",  fmtDate(new Date())],
      ["Delivery", fmtDate(job.service?.deliveryDate)],
      ["Engineer", job.service?.engineer        || "NIL"],
    ];

    const labelX = rX;
    const colonX = rX + 68;
    const valueX = rX + 78;
    const valueW = 555 - valueX;
    let jY = 62;

    jobRows.forEach(([label, value]) => {
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#000")
         .text(label,  labelX, jY, { lineBreak: false });
      doc.font("Helvetica")
         .text(":",    colonX, jY, { lineBreak: false });
      doc.text(String(value), valueX, jY, { width: valueW, lineBreak: false });
      jY += 17;
    });

    /* ─────────────────────────────────────────
       HORIZONTAL RULE
    ───────────────────────────────────────── */
    doc.moveTo(40, 135).lineTo(555, 135)
       .lineWidth(0.8).strokeColor("#000").stroke();

    /* ─────────────────────────────────────────
       SECTION TITLE HELPER
    ───────────────────────────────────────── */
    const sectionTitle = (text, x, y) => {
      doc.rect(x - 9, y + 1, 3.5, 15).fill("#000");
      doc.fillColor("#000").fontSize(11).font("Helvetica-Bold")
         .text(text, x, y, { lineBreak: false });
    };

    /* ─────────────────────────────────────────
       CUSTOMER  &  DEVICE
    ───────────────────────────────────────── */
    let secY = 145;
    sectionTitle("CUSTOMER", 40,  secY);
    sectionTitle("DEVICE",   305, secY);

    const boxTop = secY + 18;
    const boxH   = 90;

    // Customer box
    doc.roundedRect(40, boxTop, 250, boxH, 5)
       .fillAndStroke("#f5f5f5", "#d0d0d0");
    doc.fillColor("#000").fontSize(9.5).font("Helvetica")
       .text(`Name: ${job.customer?.name      || "NIL"}`, 54, boxTop + 10, { width: 228 })
       .text(`Phone: ${job.customer?.contact   || "NIL"}`,                  { width: 228 })
       .text(`Email: ${job.customer?.email     || "NIL"}`,                  { width: 228 })
       .text(`Address: ${job.customer?.address  || "NIL"}`,                 { width: 228 });

    // Device box
    doc.roundedRect(305, boxTop, 250, boxH, 5)
       .fillAndStroke("#f5f5f5", "#d0d0d0");
    doc.fillColor("#000").fontSize(9.5).font("Helvetica")
       .text(`Brand: ${job.device?.make  || "NIL"}`, 319, boxTop + 18, { width: 228 })
       .text(`Model: ${job.device?.model || "NIL"}`,                   { width: 228 })
       .text(`IMEI: ${job.device?.imei   || "NIL"}`,                   { width: 228 });

    /* ─────────────────────────────────────────
       ISSUE
    ───────────────────────────────────────── */
    let iy = boxTop + boxH + 12;
    sectionTitle("ISSUE", 40, iy);
    iy += 18;

    doc.roundedRect(40, iy, 515, 40, 5)
       .fillAndStroke("#f5f5f5", "#d0d0d0");
    doc.fillColor("#000").fontSize(9.5).font("Helvetica")
       .text(job.service?.issue || "NIL", 54, iy + 12, { width: 492 });

    /* ─────────────────────────────────────────
       MOBILE CONDITION  –  table
    ───────────────────────────────────────── */
    let mc = iy + 52;
    sectionTitle("MOBILE CONDITION", 40, mc);
    mc += 18;

    const cond    = job.service?.condition || {};
    const COL     = [110, 140, 130, 135];   // col widths, total = 515
    const TX      = 40;
    const RH      = 26;

    // Header row
    doc.rect(TX, mc, 515, RH).fillAndStroke("#dedede", "#c8c8c8");
    const hdrLabels = ["Charger", null, "Pattern / PIN", null];
    let hx = TX;
    hdrLabels.forEach((h, i) => {
      if (h) {
        doc.fillColor("#000").fontSize(9.5).font("Helvetica-Bold")
           .text(h, hx + 7, mc + 7, { width: COL[i] - 8, lineBreak: false });
      }
      hx += COL[i];
    });

    // Data rows
    const condRows = [
      ["Charger", cond.charger    || "NIL",  "Pattern / PIN", cond.patternPin  || "NIL"],
      ["Back",    cond.back       || "NIL",  "Memory Card",   cond.memoryCard  || "NIL"],
      ["SIM",     cond.sim        || "NIL",  "",              ""],
    ];

    condRows.forEach((row, ri) => {
      const ry = mc + RH * (ri + 1);
      const bg = ri % 2 === 0 ? "#ffffff" : "#f7f7f7";
      doc.rect(TX, ry, 515, RH).fillAndStroke(bg, "#c8c8c8");
      let cx = TX;
      row.forEach((cell, ci) => {
        doc.fillColor("#000").fontSize(9.5)
           .font(ci % 2 === 0 ? "Helvetica-Bold" : "Helvetica")
           .text(cell, cx + 7, ry + 7, { width: COL[ci] - 8, lineBreak: false });
        cx += COL[ci];
      });
    });

    /* ─────────────────────────────────────────
       ESTIMATE AMOUNT
    ───────────────────────────────────────── */
    let ey = mc + RH * (condRows.length + 1) + 14;
    sectionTitle("ESTIMATE AMOUNT", 40, ey);
    ey += 18;

    doc.dash(5, { space: 4 })
       .rect(40, ey, 515, 50)
       .stroke("#aaaaaa");
    doc.undash();

    doc.fillColor("#000").fontSize(20).font("Helvetica-Bold")
       .text(`\u20B9 ${total}`, 40, ey + 13, { align: "center", width: 515, lineBreak: false });

    /* ─────────────────────────────────────────
       TERMS & CONDITIONS
    ───────────────────────────────────────── */
    let ty = ey + 62;
    sectionTitle("TERMS & CONDITIONS", 40, ty);
    ty += 16;

    const terms = [
      "Replaced parts will not be returned.",
      "Data may be lost during repair/software upgradation.",
      "Company bears no responsibility, whatsoever if equipment is not collected within 45 days from the date of receipt.",
      "Please make sure that you have removed your SIM card and/or memory card from your phone. Gadget Hub does not accept responsibility for loss of these items.",
      "No delivery will be made without the customer's copy of the job order.",
      "Company bears no responsibility, if any fault occurs on additional fault findings while servicing on booked complaints.",
      "Only checking warranty for all services and spares used.",
    ];

    // Draw box placeholder – we'll fill height after measuring text
    const termsBoxY = ty;
    doc.save(); // we'll draw box after writing text to know real height

    let termY = ty + 10;
    terms.forEach((t, i) => {
      doc.fillColor("#000").fontSize(8.5).font("Helvetica")
         .text(`${i + 1}. ${t}`, 54, termY, { width: 490 });
      termY = doc.y + 3;
    });

    const termsBoxH = termY - termsBoxY + 6;
    doc.restore();
    // Draw the box behind text (re-draw outline over content is fine in pdfkit)
    doc.roundedRect(40, termsBoxY, 515, termsBoxH, 5)
       .fillAndStroke("#fafafa", "#d0d0d0");

    // Re-draw text on top of box
    termY = termsBoxY + 10;
    terms.forEach((t, i) => {
      doc.fillColor("#000").fontSize(8.5).font("Helvetica")
         .text(`${i + 1}. ${t}`, 54, termY, { width: 490 });
      termY = doc.y + 3;
    });

    /* ─────────────────────────────────────────
       SIGNATURES
    ───────────────────────────────────────── */
    const signY = termY + 20;

    doc.lineWidth(0.8).strokeColor("#000");
    doc.moveTo(50,  signY).lineTo(175, signY).stroke();
    doc.moveTo(225, signY).lineTo(370, signY).stroke();
    doc.moveTo(415, signY).lineTo(555, signY).stroke();

    doc.fontSize(8.5).font("Helvetica").fillColor("#000")
       .text("Customer Signature", 55,  signY + 5, { lineBreak: false })
       .text("For RADNUS",         255, signY + 5, { lineBreak: false })
       .text("Authorized Signatory", 420, signY + 5, { lineBreak: false });

    doc.end();
  });
};

module.exports = generatePDF;