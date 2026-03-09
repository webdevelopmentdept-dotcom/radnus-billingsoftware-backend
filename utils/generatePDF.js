const PDFDocument = require("pdfkit");
const JobSheet = require("../models/JobSheet");

const generatePDF = async (jobId) => {

  const job = await JobSheet.findById(jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument();

    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));

    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    doc.on("error", reject);

    /* HEADER */

    doc
      .fontSize(20)
      .text("RADNUS COMMUNICATION", { align: "center" });

    doc.moveDown();

    /* JOB INFO */

    doc.fontSize(14).text(`Estimate No: ${job.jobSheetNo}`);
    doc.text(`Customer: ${job.customer?.name || "-"}`);
    doc.text(`Phone: ${job.customer?.contact || "-"}`);

    doc.moveDown();

    /* SERVICE */

    const service = Number(job.service?.serviceCharge || 0);
    const spare = Number(job.service?.spareCharge || 0);

    const total = service + spare;

    doc.text(`Service Charge: ₹${service}`);
    doc.text(`Spare Charge: ₹${spare}`);

    doc.moveDown();

    doc
      .fontSize(16)
      .text(`Total Estimate: ₹${total}`);

    doc.end();

  });

};

module.exports = generatePDF;