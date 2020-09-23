////////////////////////  IMPORTS  ////////////////////////

const express = require("express");
const bodyParser = require("body-parser");
const server = express();

server.use(bodyParser.json());

//////////////////////  ROUTES IMPORT  ///////////////////////

const productRoutes = require("./routes/products");
server.use("/products", productRoutes);

const orderRoutes = require("./routes/orders");
server.use("/orders", orderRoutes);

const userRoutes = require("./routes/user");
server.use("/user", userRoutes);

//////////////////// SERVER INITIALIZE  /////////////////////

server.listen(3001, () => console.log("Servidor iniciado..."));
