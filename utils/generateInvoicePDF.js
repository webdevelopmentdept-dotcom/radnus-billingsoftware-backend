const puppeteer = require("puppeteer");

const generateInvoicePDF = async (id) => {

  const browser = await puppeteer.launch({
    headless: true,

    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  const page = await browser.newPage();

  await page.goto(`${process.env.FRONTEND_URL}/invoice/${id}`, {
    waitUntil: "networkidle0",
  });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
  });

  await browser.close();

  return pdf;
};

module.exports = generateInvoicePDF;