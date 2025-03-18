// Load environment variables from .env file
require("dotenv").config();

const { Sequelize } = require("sequelize");
const { Pool } = require("pg");

// Create a new PostgreSQL connection pool using pg
const client = new Pool({
  connectionString: process.env.DATABASE_URL, // Database URL from environment variables
  max: Number.MAX_VALUE, // Sets an extremely high max connection limit (should be optimized)
  // idleTimeoutMillis: Math.pow(2, 31) - 1 // (Commented out) Would define idle timeout in milliseconds
});

// Create a new Sequelize instance for PostgreSQL ORM interactions
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  define: {
    timestamps: false, // Disables automatic createdAt and updatedAt columns
    noPrimaryKey: true, // Allows tables without a primary key
    freezeTableName: true, // Prevents Sequelize from pluralizing table names
  },
  dialect: "postgres", // Specifies PostgreSQL as the database dialect
  timezone: "+09:00", // Sets the timezone to Japan Standard Time (JST)
  dialectOptions: {
    useUTC: false, // Disables automatic UTC conversion, keeping timestamps in local time
    keepAlive: true, // Keeps the database connection alive
  },
  pool: {
    max: 10, // Maximum number of database connections in the pool
    min: 0, // Allows the number of active connections to drop to 0 when idle
    acquire: 30000, // Maximum time (in ms) to wait for a connection before throwing an error
    idle: 10000, // Time (in ms) after which an idle connection is closed
  },
  retry: {
    match: [
      /ECONNRESET/, // Retry on connection reset error
      /SequelizeConnectionError/, // Generic connection error
      /SequelizeConnectionRefusedError/, // Retry if connection is refused
      /SequelizeHostNotFoundError/, // Retry if the database host is not found
      /SequelizeHostNotReachableError/, // Retry if the database host is unreachable
      /SequelizeInvalidConnectionError/, // Retry on an invalid connection error
      /SequelizeConnectionTimedOutError/, // Retry on connection timeout
      /ConnectionAcquireTimeoutError/, // Retry on connection acquisition timeout
    ],
    max: 5, // Maximum number of retry attempts for failed connections
  },
  logging:false, // Disables SQL query logging in the console
});

// Export both the pg client (for direct queries) and Sequelize instance (for ORM)
module.exports = { client, sq: sequelize };

