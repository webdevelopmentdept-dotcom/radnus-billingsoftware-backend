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

const PDFDocument = require("pdfkit");

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
       .fillColor("#eeeeee")
       .text("RADNUS", 100, 350, { align: "center" });
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

    /* JOB SHEET RIGHT SIDE */

    doc.fontSize(12).font("Helvetica-Bold")
       .text("JOB SHEET", 430, 40);

    doc.fontSize(10).font("Helvetica")
       .text(`Job No: ${job.jobSheetNo}`, 420, 65)
       .text(`Created: ${new Date().toLocaleDateString()}`, 420, 80)
       .text(`Delivery: ${job.service?.deliveryDate || "NIL"}`, 420, 95)
       .text(`Engineer: ${job.service?.engineer || "NIL"}`, 420, 110);

    doc.moveTo(40, 140).lineTo(555, 140).stroke();

    /* ---------------- CUSTOMER + DEVICE ---------------- */

    doc.font("Helvetica-Bold").fontSize(11)
       .text("CUSTOMER", 50, 160);

    doc.font("Helvetica")
       .rect(40, 175, 250, 95).stroke();

    doc.fontSize(10)
       .text(`Name: ${job.customer?.name || "NIL"}`, 50, 190)
       .text(`Phone: ${job.customer?.contact || "NIL"}`, 50, 205)
       .text(`Email: ${job.customer?.email || "NIL"}`, 50, 220)
       .text(`Address: ${job.customer?.address || "NIL"}`, 50, 235);

    /* DEVICE */

    doc.font("Helvetica-Bold")
       .text("DEVICE", 310, 160);

    doc.font("Helvetica")
       .rect(300, 175, 250, 95).stroke();

    doc.fontSize(10)
       .text(`Brand: ${job.device?.make || "NIL"}`, 310, 190)
       .text(`Model: ${job.device?.model || "NIL"}`, 310, 205)
       .text(`IMEI: ${job.device?.imei || "NIL"}`, 310, 220);

    /* ---------------- ESTIMATE AMOUNT ---------------- */

    doc.font("Helvetica-Bold")
       .text("ESTIMATE AMOUNT", 50, 290);

    /* dashed box */

    doc.dash(5, { space: 3 })
       .rect(40, 305, 510, 90)
       .stroke();

    doc.undash();

    doc.font("Helvetica").fontSize(11)
       .text("Service Charge", 50, 325)
       .text(`₹ ${service}`, 500, 325, { align: "right" });

    doc.text("Spare Charge", 50, 345)
       .text(`₹ ${spare}`, 500, 345, { align: "right" });

    doc.moveTo(50, 365).lineTo(550, 365).stroke();

    doc.font("Helvetica-Bold")
       .text("Total Estimate", 50, 375)
       .text(`₹ ${total}`, 500, 375, { align: "right" });

    /* ---------------- SIGNATURE ---------------- */

    const signY = 460;

    doc.moveTo(60, signY).lineTo(180, signY).stroke();
    doc.moveTo(240, signY).lineTo(360, signY).stroke();
    doc.moveTo(420, signY).lineTo(540, signY).stroke();

    doc.fontSize(9).font("Helvetica")
       .text("Customer Signature", 65, signY + 5)
       .text("For RADNUS", 270, signY + 5)
       .text("Authorized Signatory", 430, signY + 5);

    doc.end();

  });

};

module.exports = generatePDF;