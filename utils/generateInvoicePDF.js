const puppeteer = require("puppeteer");

const generateInvoicePDF = async (id) => {
  const browser = await puppeteer.launch({
    headless: "new",
  });

  const page = await browser.newPage();

  // 🔥 invoice URL
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