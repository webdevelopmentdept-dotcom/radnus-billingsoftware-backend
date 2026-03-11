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
    doc.rotate(-30, { origin: [300, 400] })
      .fontSize(80)
      .fillColor("#e6e6e6")
      .text("RADNUS", 120, 360);
    doc.restore();
    doc.fillColor("#000");

    /* ---------------- HEADER ---------------- */

    doc.fontSize(16).font("Helvetica-Bold")
      .text("RADNUS COMMUNICATION", 40, 40);

    doc.fontSize(10).font("Helvetica")
      .text("242, Sinnaya Plaza, MG Road,", 40, 60)
      .text("Puducherry - 605001", 40, 75)
      .text("Phone: 81222 73355", 40, 90)
      .text("Mon–Sat (10AM–7PM)", 40, 105)
      .text("Website: www.radnus.in", 40, 120);

    /* LOGO */

    doc.image(logoPath, 250, 45, {
      width: 90
    });

    doc.fontSize(12).font("Helvetica-Bold")
      .text("JOB SHEET", 450, 40);

    doc.fontSize(10).font("Helvetica")
      .text(`Job No : ${job.jobSheetNo}`, 420, 65)
      .text(`Created : ${new Date().toISOString().slice(0, 10)}`, 420, 80)
      .text(`Delivery : ${job.service?.deliveryDate || "NIL"}`, 420, 95)
      .text(`Engineer : ${job.service?.engineer || "NIL"}`, 420, 110);

    doc.moveTo(40, 140).lineTo(555, 140).stroke();

    /* ---------------- SECTION TITLE STYLE ---------------- */

    const sectionTitle = (text, x, y) => {
      doc.rect(x - 10, y + 4, 4, 16).fill("#000");
      doc.fillColor("#000")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(text, x, y);
    };

    /* ---------------- CUSTOMER ---------------- */

    sectionTitle("CUSTOMER", 200, 160);

    doc.roundedRect(40, 180, 240, 100, 8)
      .fillAndStroke("#f5f5f5", "#cfcfcf");

    doc.fillColor("#000")
      .fontSize(11)
      .font("Helvetica")
      .text(`Name: ${job.customer?.name || "NIL"}`, 60, 200, { align: "center", width: 200 })
      .text(`Phone: ${job.customer?.contact || "NIL"}`, { align: "center" })
      .text(`Email: ${job.customer?.email || "NIL"}`, { align: "center" })
      .text(`Address: ${job.customer?.address || "NIL"}`, { align: "center" });

    /* ---------------- DEVICE ---------------- */

    sectionTitle("DEVICE", 430, 160);

    doc.roundedRect(310, 180, 240, 100, 8)
      .fillAndStroke("#f5f5f5", "#cfcfcf");

    doc.fillColor("#000")
      .fontSize(11)
      .text(`Brand: ${job.device?.make || "NIL"}`, 330, 205, { align: "center", width: 200 })
      .text(`Model: ${job.device?.model || "NIL"}`, { align: "center" })
      .text(`IMEI: ${job.device?.imei || "NIL"}`, { align: "center" });

    /* ---------------- ESTIMATE ---------------- */

    sectionTitle("ESTIMATE AMOUNT", 260, 310);

    doc.dash(5, { space: 3 })
      .rect(40, 330, 510, 120)
      .stroke();

    doc.undash();

    doc.fontSize(12)
      .font("Helvetica")
      .text("Service Charge", 60, 355)
      .text(`₹ ${service}`, 480, 355);

    doc.text("Spare Charge", 60, 380)
      .text(`₹ ${spare}`, 480, 380);

    doc.moveTo(60, 405).lineTo(530, 405).stroke("#cccccc");

    doc.font("Helvetica-Bold")
      .text("Total Estimate", 60, 420)
      .text(`₹ ${total}`, 480, 420);

    /* ---------------- SIGNATURE ---------------- */

    const signY = 520;

    doc.moveTo(60, signY).lineTo(200, signY).stroke();
    doc.moveTo(240, signY).lineTo(380, signY).stroke();
    doc.moveTo(420, signY).lineTo(560, signY).stroke();

    doc.fontSize(10)
      .font("Helvetica")
      .text("Customer Signature", 80, signY + 5)
      .text("For RADNUS", 280, signY + 5)
      .text("Authorized Signatory", 440, signY + 5);

    doc.end();

  });

};

module.exports = generatePDF;