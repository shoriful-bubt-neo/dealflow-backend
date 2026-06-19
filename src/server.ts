import http from "http";
import { config } from "dotenv";
import app from "./app.js";
import { initializeSocket } from "./sockets/socket.js";

config();

const server = http.createServer(app);
const io = initializeSocket(server);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});