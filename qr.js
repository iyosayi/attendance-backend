// generate.js
const QRCode = require("qrcode");

const url = "https://nycattendance.helplinenation.org/self-register";

QRCode.toFile("qr.png", url, { width: 600 }, (err) => {
  if (err) throw err;
  console.log("QR created: qr.png");
});
