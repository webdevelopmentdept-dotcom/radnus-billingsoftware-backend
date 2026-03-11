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

    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });

    const service = Number(job.service?.serviceCharge || 0);
    const spare = Number(job.service?.spareCharge || 0);
    const total = service + spare;

    /* ---------------- HEADER ---------------- */

    doc.fontSize(16).text("RADNUS COMMUNICATION", 40, 40);

    doc.fontSize(10)
      .text("242, Sinnaya Plaza, MG Road,", 40, 60)
      .text("Puducherry - 605001", 40, 75)
      .text("Phone: 81222 73355", 40, 90)
      .text("Mon–Sat (10AM–7PM)", 40, 105)
      .text("Website: www.radnus.in", 40, 120);

    doc.fontSize(12)
      .text("JOB SHEET", 420, 40);

    doc.fontSize(10)
      .text(`Job No: ${job.jobSheetNo}`, 420, 60)
      .text(`Created: ${new Date().toLocaleDateString()}`, 420, 75)
      .text(`Delivery: ${job.service?.deliveryDate || "NIL"}`, 420, 90)
      .text(`Engineer: ${job.service?.engineer || "NIL"}`, 420, 105);

    doc.moveTo(40, 140)
       .lineTo(550, 140)
       .stroke();

    /* ---------------- CUSTOMER BOX ---------------- */

    doc.rect(40, 160, 250, 110).stroke();

    doc.fontSize(11).text("CUSTOMER", 50, 165);

    doc.fontSize(10)
      .text(`Name: ${job.customer?.name || "NIL"}`, 50, 185)
      .text(`Phone: ${job.customer?.contact || "NIL"}`, 50, 200)
      .text(`Email: ${job.customer?.email || "NIL"}`, 50, 215)
      .text(`Address: ${job.customer?.address || "NIL"}`, 50, 230);

    /* ---------------- DEVICE BOX ---------------- */

    doc.rect(300, 160, 250, 110).stroke();

    doc.fontSize(11).text("DEVICE", 310, 165);

    doc.fontSize(10)
      .text(`Brand: ${job.device?.make || "NIL"}`, 310, 185)
      .text(`Model: ${job.device?.model || "NIL"}`, 310, 200)
      .text(`IMEI: ${job.device?.imei || "NIL"}`, 310, 215);

    /* ---------------- ESTIMATE BOX ---------------- */

    doc.rect(40, 290, 510, 110).stroke();

    doc.fontSize(11).text("ESTIMATE AMOUNT", 50, 295);

    doc.fontSize(10)
      .text(`Service Charge`, 50, 320)
      .text(`₹ ${service}`, 500, 320, { align: "right" });

    doc.text(`Spare Charge`, 50, 340)
       .text(`₹ ${spare}`, 500, 340, { align: "right" });

    doc.moveTo(40, 360)
       .lineTo(550, 360)
       .stroke();

    doc.fontSize(11)
      .text(`Total Estimate`, 50, 370)
      .text(`₹ ${total}`, 500, 370, { align: "right" });

    /* ---------------- SIGNATURE ---------------- */

    doc.moveTo(40, 460).lineTo(180, 460).stroke();
    doc.moveTo(240, 460).lineTo(380, 460).stroke();
    doc.moveTo(410, 460).lineTo(550, 460).stroke();

    doc.fontSize(10)
      .text("Customer Signature", 55, 465)
      .text("For RADNUS", 275, 465)
      .text("Authorized Signatory", 430, 465);

    doc.end();

  });

};

module.exports = generatePDF;