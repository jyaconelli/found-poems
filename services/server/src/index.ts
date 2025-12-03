import "dotenv/config";
import cors from "cors";
import express from "express";
import { prisma } from "./clients/prisma";
import { config } from "./config";
import { healthRouter } from "./routes/health";
import { poemsRouter } from "./routes/poems";
import { publicConfigRouter } from "./routes/publicConfig";
import { rssStreamsRouter } from "./routes/rssStreams";
import { sessionsRouter } from "./routes/sessions";
import { startRssStreamPoller } from "./tasks/rssPoller";
import { startStatusRefresh } from "./tasks/statusRefresh";
import { handleError } from "./utils/handleError";

const app = express();
app.use(cors());
app.use(express.json());

app.use(healthRouter);
app.use(sessionsRouter);
app.use(poemsRouter);
app.use(publicConfigRouter);
app.use(rssStreamsRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    handleError(res, err);
  },
);

const statusInterval = startStatusRefresh();
const rssInterval = startRssStreamPoller();

const server = app.listen(config.port, () => {
  console.log(
    `[server] VERSION: ${config.herokuReleaseVersion}. listening on http://localhost:${config.port}`,
  );
});

const shutdown = async () => {
  clearInterval(statusInterval);
  clearInterval(rssInterval);
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
