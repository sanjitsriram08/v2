// logger.js
require('dotenv').config();
const winston = require('winston');
const sendEmail = require('../utils/sendEmail');

const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    logFormat
  ),
  transports: [
    new winston.transports.Console({ format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()) }),
    new winston.transports.File({ filename: 'app.log' }),
  ],
});

module.exports = logger;