const puppeteer = require("puppeteer");

const generatePDF = async (id) => {

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

  const url = `${process.env.FRONTEND_URL}/estimate-bill/${id}`;

  await page.goto(url, {
    waitUntil: "networkidle0",
    timeout: 0
  });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true
  });

  await browser.close();

  return pdf;
};

module.exports = generatePDF;