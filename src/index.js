require("dotenv").config();

const { createApp } = require("./app");

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
const app = createApp();

app.listen(port, () => {
  console.log(`[api] listening on ${port}`);
});
