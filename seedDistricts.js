const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();
const mongoose = require("mongoose");
const District = require("./models/District");
const Taluk = require("./models/Taluk");
const TnDistrictData = require("./data/TnDistrictData");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const [district, taluks] of Object.entries(TnDistrictData)) {
    await District.findOneAndUpdate(
      { name: district },
      { name: district },
      { upsert: true }
    );
    for (const taluk of taluks) {
      await Taluk.findOneAndUpdate(
        { name: taluk, district },
        { name: taluk, district },
        { upsert: true }
      );
    }
  }

  console.log("✅ District/Taluk seed done");
  process.exit(0);
}

seed();