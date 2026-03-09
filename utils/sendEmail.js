const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text, pdfBuffer, fileName = "file.pdf") => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
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

    console.log("Email sent:", info.messageId);
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
};

module.exports = sendEmail;