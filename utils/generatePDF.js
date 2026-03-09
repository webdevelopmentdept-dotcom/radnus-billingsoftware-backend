const puppeteer = require("puppeteer");

const generatePDF = async (id) => {

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  const page = await browser.newPage();

  await page.goto(
    `${process.env.FRONTEND_URL}/estimate-bill/${id}`,
    {
      waitUntil: "networkidle0",
      timeout: 0
    }
  );

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true
  });

  await browser.close();

  return pdf;
};

module.exports = generatePDF;