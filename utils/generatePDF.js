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

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument({
      size: "A4",
      margin: 40
    });

    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));

    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    /* HEADER */

    doc.fontSize(18)
       .text("RADNUS COMMUNICATION", { align: "center" });

    doc.moveDown();

    doc.fontSize(12)
       .text(`Job Sheet No: ${job.jobSheetNo}`)
       .text(`Date: ${new Date().toLocaleDateString()}`);

    doc.moveDown();

    /* CUSTOMER */

    doc.text(`Customer Name: ${job.customer?.name || "NIL"}`);
    doc.text(`Phone: ${job.customer?.contact || "NIL"}`);
    doc.text(`Email: ${job.customer?.email || "NIL"}`);

    doc.moveDown();

    /* DEVICE */

    doc.text(`Device Brand: ${job.device?.make || "NIL"}`);
    doc.text(`Model: ${job.device?.model || "NIL"}`);
    doc.text(`IMEI: ${job.device?.imei || "NIL"}`);

    doc.moveDown();

    const service = Number(job.service?.serviceCharge || 0);
    const spare = Number(job.service?.spareCharge || 0);
    const total = service + spare;

    /* ESTIMATE */

    doc.text(`Service Charge: ₹ ${service}`);
    doc.text(`Spare Charge: ₹ ${spare}`);

    doc.moveDown();

    doc.fontSize(14)
       .text(`Total Estimate: ₹ ${total}`, { underline: true });

    doc.moveDown();
    doc.moveDown();

    doc.text("Customer Signature __________________");

    doc.end();

  });

};

module.exports = generatePDF;