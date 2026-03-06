const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text, pdfBuffer, fileName = "file.pdf") => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `RADNUS <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,

    attachments: [
  {
    filename: fileName,
    content: pdfBuffer,
  },
],
  });
};

module.exports = sendEmail;
