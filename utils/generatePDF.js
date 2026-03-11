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

    /* ── WATERMARK ── */
    doc.save();
    doc.rotate(-30, { origin: [300, 400] })
       .fontSize(80).fillColor("#e6e6e6")
       .text("RADNUS", 120, 360);
    doc.restore();
    doc.fillColor("#000");

    /* ── HEADER LEFT ── */
    doc.fontSize(16).font("Helvetica-Bold").text("RADNUS COMMUNICATION", 40, 40);
    doc.fontSize(10).font("Helvetica")
       .text("242, Sinnaya Plaza, MG Road,", 40, 60)
       .text("Puducherry - 605001",           40, 75)
       .text("Phone: 81222 73355",            40, 90)
       .text("Mon–Sat (10AM–7PM)",            40, 105)
       .text("Website: www.radnus.in",        40, 120);

    /* ── LOGO (centred) ── */
    doc.image(logoPath, 240, 42, { width: 100 });

    /* ── HEADER RIGHT – JOB SHEET ── */
    const rX = 400;
    doc.fontSize(14).font("Helvetica-Bold").text("JOB SHEET", rX, 40);

    const jobRows = [
      ["Job No",   job.jobSheetNo],
      ["Created",  new Date().toISOString().slice(0, 10)],
      ["Delivery", job.service?.deliveryDate || "NIL"],
      ["Engineer", job.service?.engineer    || "NIL"],
    ];
    let jY = 70;
    jobRows.forEach(([label, value]) => {
      doc.fontSize(11).font("Helvetica-Bold").text(label, rX, jY);
      doc.font("Helvetica").text(`:  ${value}`, rX + 75, jY, { width: 130 });
      jY += 18;
    });

    /* ── DIVIDER ── */
    doc.moveTo(40, 148).lineTo(555, 148).lineWidth(1).stroke();

    /* ── SECTION TITLE HELPER ── */
    const sectionTitle = (text, x, y) => {
      doc.rect(x - 8, y + 2, 4, 14).fill("#000");
      doc.fillColor("#000").fontSize(12).font("Helvetica-Bold").text(text, x, y);
    };

    /* ── CUSTOMER & DEVICE ── */
    let cy = 158;
    sectionTitle("CUSTOMER", 40,  cy);
    sectionTitle("DEVICE",   310, cy);

    cy += 20;
    // Customer box
    doc.roundedRect(40, cy, 250, 90, 6).fillAndStroke("#f5f5f5", "#cfcfcf");
    doc.fillColor("#000").fontSize(10).font("Helvetica")
       .text(`Name: ${job.customer?.name    || "NIL"}`, 55, cy + 10, { width: 220 })
       .text(`Phone: ${job.customer?.contact || "NIL"}`)
       .text(`Email: ${job.customer?.email   || "NIL"}`)
       .text(`Address: ${job.customer?.address || "NIL"}`, { width: 220 });

    // Device box
    doc.roundedRect(310, cy, 245, 90, 6).fillAndStroke("#f5f5f5", "#cfcfcf");
    doc.fillColor("#000").fontSize(10).font("Helvetica")
       .text(`Brand: ${job.device?.make  || "NIL"}`, 325, cy + 20, { width: 215 })
       .text(`Model: ${job.device?.model || "NIL"}`)
       .text(`IMEI: ${job.device?.imei   || "NIL"}`);

    /* ── ISSUE ── */
    let iy = cy + 100;
    sectionTitle("ISSUE", 40, iy);
    iy += 20;
    doc.roundedRect(40, iy, 515, 45, 6).fillAndStroke("#f5f5f5", "#cfcfcf");
    doc.fillColor("#000").fontSize(10).font("Helvetica")
       .text(job.service?.issue || "NIL", 55, iy + 10, { width: 490 });

    /* ── MOBILE CONDITION ── */
    let mc = iy + 55;
    sectionTitle("MOBILE CONDITION", 40, mc);
    mc += 20;

    const cond = job.service?.condition || {};
    const condRows = [
      ["Charger",      cond.charger     || "NIL", "Pattern / PIN", cond.patternPin  || "NIL"],
      ["Back",         cond.back        || "NIL", "Memory Card",   cond.memoryCard  || "NIL"],
      ["SIM",          cond.sim         || "NIL", "",              ""],
    ];

    const colWidths = [110, 100, 130, 100];
    const tableX    = 40;
    const rowH      = 28;

    // header row background
    doc.rect(tableX, mc, 515, rowH).fillAndStroke("#e0e0e0", "#cfcfcf");
    ["Charger", "", "Pattern / PIN", ""].forEach((h, i) => {
      if (h) {
        doc.fillColor("#000").fontSize(10).font("Helvetica-Bold")
           .text(h, tableX + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 8, mc + 8);
      }
    });

    condRows.forEach((row, ri) => {
      const rowY = mc + rowH * (ri + 1);
      const bg   = ri % 2 === 0 ? "#ffffff" : "#f9f9f9";
      doc.rect(tableX, rowY, 515, rowH).fillAndStroke(bg, "#cfcfcf");

      let cx2 = tableX;
      row.forEach((cell, ci) => {
        const isLabel = ci % 2 === 0;
        doc.fillColor("#000").fontSize(10)
           .font(isLabel ? "Helvetica-Bold" : "Helvetica")
           .text(cell, cx2 + 8, rowY + 8, { width: colWidths[ci] - 10 });
        cx2 += colWidths[ci];
      });
    });

    /* ── ESTIMATE AMOUNT ── */
    let ey = mc + rowH * (condRows.length + 1) + 15;
    sectionTitle("ESTIMATE AMOUNT", 40, ey);
    ey += 20;

    doc.dash(5, { space: 3 }).rect(40, ey, 515, 55).stroke();
    doc.undash();

    doc.fillColor("#000").fontSize(18).font("Helvetica-Bold")
       .text(`₹ ${total}`, 40, ey + 15, { align: "center", width: 515 });

    /* ── TERMS & CONDITIONS ── */
    let ty = ey + 70;
    sectionTitle("TERMS & CONDITIONS", 40, ty);
    ty += 18;

    const terms = [
      "Replaced parts will not be returned.",
      "Data may be lost during repair/software upgradation.",
      "Company bears no responsibility, whatsoever if equipment is not collected within 45 days from the date of receipt.",
      "Please make sure that you have removed your SIM card and/or memory card from your phone. Gadget Hub does not accept responsibility for loss of these items.",
      "No delivery will be made without the customer's copy of the job order.",
      "Company bears no responsibility, if any fault occurs on additional fault findings while servicing on booked complaints.",
      "Only checking warranty for all services and spares used.",
    ];

    doc.roundedRect(40, ty, 515, terms.length * 18 + 16, 6)
       .fillAndStroke("#fafafa", "#cfcfcf");

    terms.forEach((t, i) => {
      doc.fillColor("#000").fontSize(9).font("Helvetica")
         .text(`${i + 1}. ${t}`, 55, ty + 8 + i * 18, { width: 490 });
    });

    /* ── SIGNATURES ── */
    const signY = ty + terms.length * 18 + 35;
    doc.moveTo(60,  signY).lineTo(180, signY).stroke();
    doc.moveTo(230, signY).lineTo(360, signY).stroke();
    doc.moveTo(420, signY).lineTo(550, signY).stroke();

    doc.fontSize(9).font("Helvetica")
       .text("Customer Signature", 65,  signY + 5)
       .text("For RADNUS",         255, signY + 5)
       .text("Authorized Signatory", 425, signY + 5);

    doc.end();
  });
};

module.exports = generatePDF;