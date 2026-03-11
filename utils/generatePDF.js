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

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

const generatePDF = async (jobId) => {

  const url = `https://service.radnus.in/estimate-bill/${jobId}?pdf=true`;

  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: await chromium.executablePath(),
    headless: true
  });

  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle0" });

  // ensure React finished rendering
  await new Promise(resolve => setTimeout(resolve, 1500));

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true
  });

  await browser.close();

  return pdfBuffer;
};

module.exports = generatePDF;