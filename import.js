require("dotenv").config();
const mongoose = require("mongoose");
const csv = require("csvtojson");
const JobSheet = require("./models/JobSheet");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log(err));

async function importData() {
  const data = await csv().fromFile("data.csv");

  const formatted = data.map((item, index) => ({
    jobSheetNo: "JOB" + Date.now() + index,

    customer: {
      name: item.NAME || item.Name,
      contact: String(item.NUMBER || item.Number),
      altContact: "",
      address: "",
      email: "",
    },

    device: {
      make: item.BRAND || item.Brand,
      model: item.MODEL || item.Model,
      imei: "",
      warranty: "",
      pattern: "",
      mobileStatus: "",
    },

    service: {
      engineer: "",
      dealer: "",
      drawer: "",
      serviceCharge: 0,
      spareCharge: 0,
      estimate: "",
      paymentMode: "",
      repairDate: item.DATE ? new Date(item.DATE) : null,
      deliveryDate: null,
      remarks: item.PROBLEM || item.Problem || "",
    },

    physicalCondition: [],
    accessories: [],
    visualIssues: [],
    spareItems: [],

    createdBy: {
      username: "admin",
      role: "admin"
    },

    isInvoiced: false
  }));

  await JobSheet.insertMany(formatted);

  console.log("✅ Data Imported Successfully");
  mongoose.disconnect();
}

importData();