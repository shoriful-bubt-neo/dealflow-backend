import http from "http";
import { config } from "dotenv";
import cron from "node-cron";
import app from "./app.js";
import { initializeSocket } from "./sockets/socket.js";
import { autoReleaseDeliveredDeals } from "./api/v1/deal/deal.room.service.js";

config();

const server = http.createServer(app);
const io = initializeSocket(server);

// Auto-release delivered deals when buyer does not confirm within 24h.
cron.schedule("*/5 * * * *", async () => {
  try {
    const releasedCount = await autoReleaseDeliveredDeals();
    if (releasedCount > 0) {
      console.log(`Auto-released ${releasedCount} delivered deal(s) after buyer timeout.`);
    }
  } catch (error) {
    console.error("Auto-release job failed:", error);
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});