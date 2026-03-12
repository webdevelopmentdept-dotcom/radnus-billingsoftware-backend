const path = require("path");
const PDFDocument = require("pdfkit");

const logo = path.join(__dirname, "../assets/logo.png");
const tamilFont = path.join(__dirname, "../assets/NotoSansTamil-Regular.ttf");

const generateInvoicePDF = (job) => {

  return new Promise((resolve) => {

    const doc = new PDFDocument({
      size: "A4",
      margin: 40
    });

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    const service = Number(job.service?.serviceCharge || 0);
    const spare = Number(job.service?.spareCharge || 0);
    const total = service + spare;

    /* ---------------- WATERMARK ---------------- */

    doc.save();
    doc.rotate(-35, { origin: [297, 421] });
    doc.fontSize(120);
    doc.fillOpacity(0.05);
    doc.text("RADNUS", 0, 380, { align: "center" });
    doc.restore();
    doc.fillOpacity(1);

    /* ---------------- HEADER ---------------- */

    doc.fontSize(9)
      .font("Helvetica")
      .text("CASH MEMO / BILL", 40, 40);

    doc.text("PHONE NO : 81222 73355", 420, 40);
    doc.text("EMAIL : radnus@gmail.com", 420, 55);
    doc.text("TIMINGS : 10 AM to 7 PM", 420, 70);

    doc.image(logo, 250, 60, { width: 90 });

    doc.fontSize(16)
      .font("Helvetica-Bold")
      .text("RADNUS COMMUNICATION", 0, 110, { align: "center" });

    doc.fontSize(9)
      .font("Helvetica")
      .text(
        "1st floor Anna Salai opp to Hot and cold restaurant pondicherry",
        0,
        130,
        { align: "center" }
      );

    doc.moveTo(40, 160).lineTo(555, 160).stroke();

    /* ---------------- CUSTOMER ---------------- */

    doc.fontSize(10)
      .font("Helvetica")
      .text(`Customer : ${job.customer?.name || ""}`, 40, 180)
      .text(`Contact : ${job.customer?.contact || ""}`, 40, 195)
      .text(`Address : ${job.customer?.address || ""}`, 40, 210);

    doc.text(`Bill No : ${job.jobSheetNo}`, 380, 180);
    doc.text(`Bill Date : ${new Date().toLocaleDateString()}`, 380, 195);

    /* ---------------- TABLE ---------------- */

    const tableTop = 240;
    const rowHeight = 25;

    doc.rect(40, tableTop, 515, rowHeight).stroke();

    doc.font("Helvetica-Bold");

    doc.text("Make", 55, tableTop + 8);
    doc.text("Model", 120, tableTop + 8);
    doc.text("IMEI", 240, tableTop + 8);
    doc.text("Fault", 300, tableTop + 8);
    doc.text("Service", 430, tableTop + 8);
    doc.text("Spare", 500, tableTop + 8);

    const rowY = tableTop + rowHeight;

    doc.rect(40, rowY, 515, rowHeight).stroke();

    doc.font("Helvetica");

    doc.text(job.device?.make || "-", 55, rowY + 8);

    doc.text(job.device?.model || "-", 120, rowY + 8);

    doc.text(job.device?.imei || "-", 240, rowY + 8);

    doc.text(
      (job.visualIssues || []).join(", "),
      300,
      rowY + 8,
      { width: 120 }
    );

    doc.text(`₹ ${service}`, 440, rowY + 8);

    doc.text(`₹ ${spare}`, 505, rowY + 8);

    /* ---------------- TOTAL ---------------- */

    doc.font("Helvetica")
      .text(`Sub Total : ₹${total}`, 420, rowY + 45);

    doc.font("Helvetica-Bold")
      .text(`Grand Total : ₹${total.toFixed(2)}`, 420, rowY + 60);

    /* ---------------- TERMS BOX ---------------- */

    const termsY = rowY + 100;

    doc.fontSize(9)
      .font("Helvetica-Bold")
      .text("TERMS & CONDITIONS", 220, termsY);

    doc.roundedRect(60, termsY + 20, 475, 90, 5).stroke();

    doc.font("Helvetica");

    const terms = [
      "Replaced parts will not be returned.",
      "Data may be lost during repair/software upgradation.",
      "Company bears no responsibility if equipment not collected within 45 days.",
      "Remove SIM card and memory card before repair.",
      "No delivery without customer copy.",
      "Additional faults during service are not responsibility.",
      "Warranty only for services and spares used."
    ];

    terms.forEach((t, i) => {
      doc.text(`${i + 1}. ${t}`, 80, termsY + 30 + (i * 12));
    });

    /* ---------------- TAMIL TERMS ---------------- */

    const tamilY = termsY + 130;

    doc.fontSize(10)
      .font(tamilFont)
      .text("விதிமுறைகள்", 250, tamilY);

    doc.roundedRect(60, tamilY + 20, 475, 110, 5).stroke();

    const tamil = [
      "மாற்றப்பட்ட உதிரிப்பாகங்கள் திருப்பி வழங்கப்படமாட்டாது.",
      "பழுது பார்க்கும்போது தகவல்கள் இழக்க நேரிடலாம்.",
      "45 நாட்களுக்குள் பொருள் பெறப்படாவிட்டால் நிறுவனம் பொறுப்பல்ல.",
      "சிம் மற்றும் மெமரி கார்டை அகற்றி வழங்கவும்.",
      "வேலை ஒப்பந்த நகல் இல்லாமல் பொருள் வழங்கப்படமாட்டாது.",
      "புதிய குறைகள் ஏற்பட்டால் நிறுவனம் பொறுப்பல்ல.",
      "சேவை மற்றும் உதிரிப்பாகங்களுக்கு மட்டுமே உத்தரவாதம்."
    ];

    tamil.forEach((t, i) => {
      doc.text(`${i + 1}. ${t}`, 80, tamilY + 35 + (i * 13));
    });

    /* ---------------- SIGNATURE ---------------- */

    doc.font("Helvetica")
      .text("Authorized Signature", 420, 760);

    doc.end();

  });

};

module.exports = generateInvoicePDF;