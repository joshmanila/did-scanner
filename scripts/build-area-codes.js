// One-time script to build area-codes.json from ravisorg dataset
// CSV format: areaCode,city,state,country,lat,lng (no header row)

const fs = require("fs");
const path = require("path");

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const entries = [];
  for (const line of lines) {
    const [areaCode, city, state, country, lat, lng] = parseCSVLine(line);
    if (areaCode && lat && lng) {
      entries.push({
        areaCode,
        city,
        state,
        country,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      });
    }
  }
  return entries;
}

const usEntries = processFile(path.join(__dirname, "us-area-codes.csv"));
const caEntries = processFile(path.join(__dirname, "ca-area-codes.csv"));
const allEntries = [...usEntries, ...caEntries];

// Group by area code, take the first city for each (typically the largest/primary)
const lookup = {};
for (const entry of allEntries) {
  if (!lookup[entry.areaCode]) {
    lookup[entry.areaCode] = {
      lat: entry.lat,
      lng: entry.lng,
      city: entry.city,
      state: entry.state,
      country: entry.country,
    };
  }
}

const outputPath = path.join(__dirname, "..", "src", "lib", "area-codes.json");
fs.writeFileSync(outputPath, JSON.stringify(lookup, null, 2));
console.log(
  `Built area-codes.json with ${Object.keys(lookup).length} area codes`
);
