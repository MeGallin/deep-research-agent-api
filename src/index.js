require("dotenv").config();

const { createApp } = require("./app");
const { initDb } = require("./db");

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
const app = createApp();

async function startServer() {
  try {
    await initDb();
    app.listen(port, () => {
      console.log(`[api] listening on ${port}`);
    });
  } catch (error) {
    console.error("[api] failed to initialize database", error);
    process.exit(1);
  }
}

startServer();
