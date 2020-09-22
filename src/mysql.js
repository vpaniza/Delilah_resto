const Sequelize = require("sequelize");

const database = "delila_db";
const user = "username";
const host = "192.168.64.2";
const password = "password";
const port = "";

const sequelize = new Sequelize(`mysql://${user}:${password}@${host}:${port}/${database}`);

module.exports = sequelize;