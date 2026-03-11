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

const html_to_pdf = require("html-pdf-node");

const generatePDF = async (jobId) => {

  try {

    const url = `https://service.radnus.in/estimate-bill/${jobId}?pdf=true`;

    const options = {
      format: "A4",
      printBackground: true,
      waitUntil: "networkidle0",
      args: ["--no-sandbox","--disable-setuid-sandbox"]
    };

    const file = { url };

    const pdfBuffer = await html_to_pdf.generatePdf(file, options);

    return pdfBuffer;

  } catch (error) {

    console.error("PDF GENERATION ERROR:", error);

    throw error;

  }

};

module.exports = generatePDF;