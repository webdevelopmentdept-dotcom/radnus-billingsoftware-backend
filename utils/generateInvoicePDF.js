const path = require("path");
const PDFDocument = require("pdfkit");

const logoPath = path.join(__dirname, "../assets/logo.png");

const generateInvoicePDF = (job) => {

  return new Promise((resolve) => {

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    const service = Number(job.service?.serviceCharge || 0);
    const spare = Number(job.service?.spareCharge || 0);
    const total = service + spare;

    /* WATERMARK */

    doc.save();
    doc.rotate(-35, { origin: [300, 400] })
      .fontSize(110)
      .fillColor("#cccccc")
      .fillOpacity(0.15)
      .text("RADNUS", 0, 350, { align: "center" });
    doc.restore();
    doc.fillOpacity(1);

    /* HEADER */

    doc.fontSize(14)
      .font("Helvetica-Bold")
      .text("RADNUS COMMUNICATION", 40, 40);

    doc.fontSize(9)
      .font("Helvetica")
      .text("1st floor Anna Salai", 40, 60)
      .text("Pondicherry", 40, 72)
      .text("Phone : 81222 73355", 40, 84)
      .text("Email : radnus@gmail.com", 40, 96);

    doc.image(logoPath, 450, 40, { width: 80 });

    doc.moveTo(40, 130).lineTo(555, 130).stroke();

    /* CUSTOMER */

    doc.fontSize(10).font("Helvetica-Bold")
      .text("Customer :", 40, 150);

    doc.font("Helvetica")
      .text(job.customer?.name || "", 120, 150)
      .text(`Phone : ${job.customer?.contact || ""}`, 120, 165)
      .text(`Address : ${job.customer?.address || ""}`, 120, 180);

    /* BILL INFO */

    doc.font("Helvetica-Bold")
      .text("Bill No :", 380, 150);

    doc.font("Helvetica")
      .text(job.jobSheetNo || "", 450, 150)
      .text("Bill Date :", 380, 170)
      .text(new Date().toLocaleDateString(), 450, 170);

    /* TABLE HEADER */

    const tableTop = 220;

    doc.font("Helvetica-Bold");

    doc.text("Make", 40, tableTop);
    doc.text("Model", 120, tableTop);
    doc.text("IMEI", 200, tableTop);
    doc.text("Fault", 300, tableTop);
    doc.text("Service", 420, tableTop);
    doc.text("Spare", 480, tableTop);

    doc.moveTo(40, tableTop + 15)
      .lineTo(555, tableTop + 15)
      .stroke();

    /* TABLE DATA */

    doc.font("Helvetica");

    doc.text(job.device?.make || "-", 40, tableTop + 25);
    doc.text(job.device?.model || "-", 120, tableTop + 25);
    doc.text(job.device?.imei || "-", 200, tableTop + 25);
    doc.text((job.visualIssues || []).join(", "), 300, tableTop + 25);
    doc.text(`₹${service}`, 420, tableTop + 25);
    doc.text(`₹${spare}`, 480, tableTop + 25);

    /* TOTAL */

    doc.font("Helvetica-Bold");

    doc.text(`Sub Total : ₹${total}`, 380, tableTop + 70);

    doc.fontSize(12)
      .text(`Grand Total : ₹${total}`, 380, tableTop + 90);

    /* TERMS */

    const termsY = tableTop + 140;

    doc.fontSize(11)
      .text("TERMS & CONDITIONS", 40, termsY);

    const terms = [
      "Replaced parts will not be returned.",
      "Data may be lost during repair/software upgrade.",
      "Device must be collected within 45 days.",
      "Remove SIM and memory card before repair.",
      "No delivery without customer copy.",
      "Additional faults during service are not responsibility.",
      "Warranty only for service and spares."
    ];

    doc.fontSize(9);

    terms.forEach((t, i) => {
      doc.text(`${i + 1}. ${t}`, 40, termsY + 20 + i * 14);
    });

    /* SIGNATURE */

    doc.text("Authorized Signature", 420, 750);

    doc.end();

  });

};

module.exports = generateInvoicePDF;