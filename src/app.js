const express = require("express");
const cors = require("cors");

function parseAllowedOrigins(value) {
  if (!value) {
    return ["http://localhost:5173"];
  }
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isTruthy(value) {
  if (!value) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function createApp() {
  const app = express();

  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS);
  const allowAllOrigins = allowedOrigins.includes("*");
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: isTruthy(process.env.CORS_CREDENTIALS),
    maxAge: 86400
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(express.json());

  return app;
}

module.exports = { createApp };
