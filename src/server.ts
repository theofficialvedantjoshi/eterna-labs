import express from "express";
import logger from "jet-logger";
import ENV from "@src/common/constants/ENV";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { TokenService } from "@src/services/TokenService";
import { Scheduler } from "@src/services/Scheduler";
import { createTokenRoutes } from "@src/routes/TokenRoutes";
import path from "path";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
  },
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.resolve(process.cwd(), "public");
app.use(express.static(publicDir));

const port = ENV.Port || 8080;
const tokenService = new TokenService(io);
const scheduler = new Scheduler(tokenService);
app.use(express.json());

app.use("/api/v1/tokens", createTokenRoutes(tokenService));

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

io.on("connection", (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

server.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
  scheduler.start();
  tokenService.refreshTokens().catch(console.error);
});
export default app;
