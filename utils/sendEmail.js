const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text, pdfBuffer, fileName) => {

  try {

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

    const mailOptions = {
      from: `"RADNUS" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      text: text,
    };

    /* attach pdf if exists */
    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: fileName || "file.pdf",
          content: pdfBuffer,
        },
      ];
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent:", info.response);

  } catch (error) {

    console.error("EMAIL ERROR:", error);

    throw error;

  }

};

module.exports = sendEmail;