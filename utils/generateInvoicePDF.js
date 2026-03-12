// const PDFDocument = require("pdfkit");
// const JobSheet = require("../models/JobSheet");

// const generateInvoicePDF = async (jobId) => {
//   return new Promise(async (resolve, reject) => {

//     try {

//       const job = await JobSheet.findById(jobId);

//       if (!job) {
//         return reject("Job not found");
//       }

//       const doc = new PDFDocument();
//       const buffers = [];

//       doc.on("data", buffers.push.bind(buffers));

//       doc.on("end", () => {
//         const pdfData = Buffer.concat(buffers);
//         resolve(pdfData);
//       });

//       doc.fontSize(20).text("RADNUS COMMUNICATION", { align: "center" });

//       doc.moveDown();

//       doc.fontSize(14).text(`Invoice No: ${job.jobSheetNo}`);
//       doc.text(`Customer: ${job.customer?.name}`);
//       doc.text(`Phone: ${job.customer?.contact}`);

//       doc.moveDown();

//       const service = Number(job.service?.serviceCharge || 0);
//       const spare = Number(job.service?.spareCharge || 0);
//       const total = service + spare;

//       doc.text(`Service Charge: ₹${service}`);
//       doc.text(`Spare Charge: ₹${spare}`);

//       doc.moveDown();

//       doc.fontSize(16).text(`Total Amount: ₹${total}`);

//       doc.end();

//     } catch (err) {

//       reject(err);

//     }

//   });
// };

// module.exports = generateInvoicePDF;