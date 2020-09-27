/////////////////// ORDERS RELATED ENDPOINTS ///////////////////

const express = require("express");
const server = express();
const sequelize = require("./../../mysql");
const {check, validationResult} = require("express-validator");
const config = require("./../../config");

////////////////////////  MIDDLEWARES  ////////////////////////

const authMiddleware = require("./../../middlewares/authentication");
const adminMiddleware = require("../../middlewares/adminAuth");

////////////////////////  ENDPOINTS  /////////////////////////

// Get all orders
server.get('/', authMiddleware, adminMiddleware, async (req,res) => {
    const sql = `SELECT orders.id, orders.placed_time, users.username AS username, users.address AS address, 
                 payment_method.name AS payment_method, order_status.name AS status_name, 
                 GROUP_CONCAT(products.name) AS products, SUM(products.price) AS total_price FROM orders

                 JOIN order_status ON orders.status_id = order_status.id
                 JOIN order_products ON orders.id = order_products.order_id
                 JOIN users ON orders.user_id = users.id
                 JOIN payment_method ON orders.payment_method_id = payment_method.id
                 JOIN products ON order_products.product_id = products.id

                 GROUP BY orders.id`;
    try{
        const data = await sequelize.query(sql,
            { type: sequelize.QueryTypes.SELECT }
        )
        res.status = 200;
        res.send({
            status: 200,
            orders: data
        })
    } catch(error){
        res.status(500).send(error);
    }
});

// Get order by ID
server.get('/:id', authMiddleware, adminMiddleware, async (req,res) => {
    const sql = `SELECT orders.id, orders.placed_time, users.username AS username, users.address AS address, 
                 payment_method.name AS payment_method, order_status.name AS status_name, 
                 GROUP_CONCAT(products.name) AS product, SUM(products.price) AS total_price FROM orders

                 JOIN order_status ON orders.status_id = order_status.id
                 JOIN order_products ON orders.id = order_products.order_id
                 JOIN users ON orders.user_id = users.id
                 JOIN payment_method ON orders.payment_method_id = payment_method.id
                 JOIN products ON order_products.product_id = products.id
                 
                 WHERE orders.id = ${req.params.id}`;
    try{
        const data = await sequelize.query(sql,
            { type: sequelize.QueryTypes.SELECT }
        )
        res.status = 200;
        res.send({
            status: 200,
            order_details: data[0]
        })
    } catch(error){
        res.status(500).send(error);
    }
});

// Get full order details by ID
server.get('/:id/detail', authMiddleware, adminMiddleware, async (req,res) => {
    const sql = `SELECT users.username AS username, users.fullname AS fullname, users.address AS address, 
                 users.phone AS phone, users.email AS email, payment_method.name AS payment_method, 
                 order_status.name AS status_name, GROUP_CONCAT(products.name) AS products, 
                 GROUP_CONCAT(products.price) AS product_price, SUM(products.price) AS total_price FROM orders
    
                 JOIN order_status ON orders.status_id = order_status.id
                 JOIN order_products ON orders.id = order_products.order_id
                 JOIN users ON orders.user_id = users.id
                 JOIN payment_method ON orders.payment_method_id = payment_method.id
                 JOIN products ON order_products.product_id = products.id
                     
                 WHERE orders.id = ${req.params.id}`;

    try{
        const data = await sequelize.query(sql,
            { type: sequelize.QueryTypes.SELECT }
        )
        res.status = 200;
        res.send({
            status: 200,
            order_details: data[0]
        })
    } catch(error){
        res.status(500).send(error);
    }
});

// Add new order to "orders" table & products to corresponding order -- by admin
server.post('/', authMiddleware, adminMiddleware, [
    check('user_id', 'Missing/invalid user ID')
        .not().isEmpty()
        .isInt(),
    check('payment_method_id', 'Missing/invalid payment method ID')
        .not().isEmpty()
        .isInt(),
    check('status_id', 'Missing/invalid status ID')
        .not().isEmpty()
        .isInt(),
    check('order_products_id', 'Missing/invalid order products IDs')
        .not().isEmpty(),
    ],
    async (req,res) => {
        const{ user_id, payment_method_id, status_id, order_products_id } = req.body;
        const validationErrors = validationResult(req);

        if(!validationErrors.isEmpty()){
            config.errorSemantic(res,validationErrors);
            return;
        }
        else{
            const sqlOrders = `INSERT INTO orders (user_id, payment_method_id, status_id, order_products_id) 
                               VALUES (?,?,?,?) `;

            // First check user existence:
            const userExistence = await checkUserExistenceByID(user_id);

            if(!userExistence.exists[0]){
                res.status = 404;
                res.send({
                    status: 404,
                    message: "El usuario no existe"
                });
            }
            else{
                // Now check products existence:
                const orderProductsID = JSON.parse(order_products_id);
                const productsExistenceObj = await checkProductsExistence(orderProductsID);

                if(productsExistenceObj.status === 200){
                    try{ 
                        await sequelize.query(sqlOrders, 
                            { replacements: [user_id, payment_method_id, status_id, order_products_id] }
                        );
                        const orderDetails = await getOrderProductDetails();
                        
                        if(orderDetails.status === 200){
                            const orderProducts = JSON.parse(orderDetails.data[0].order_products_id);
                            const orderProductsUnique = [...new Set(orderProducts)];
                            let statusArray = [];
                            for (product of orderProductsUnique){
                                let quantity = getOccurrence(orderProducts, product);
                                const insertProductsObj = await fillOrderProductsTable(orderDetails.data[0].id, product, quantity);
                                statusArray.push(insertProductsObj.status)
                            }
                
                            statusArray.forEach(element =>{
                                // If at least one of the products can be loaded correctly 
                                if(element === 500){
                                    res.send({
                                        status: element,
                                        message: "Error al agregar los productos"
                                    })
                                }
                            })
                            res.status = 200;
                            res.send({
                                status: 200,
                                message: "Orden generada."
                            })
                        }
                        else{
                            // Server ERR when retrieving data
                            res.send({
                                status: orderDetails.status,
                                message: orderDetails.message
                            })
                        }
                    } catch(error){
                        res.status(500).send(error);
                    }
                } 
                else{
                    // Product does not exist -- ERR 404
                    res.send({
                        status: productsExistenceObj.status,
                        message: productsExistenceObj.message
                    })
                }
            }
        }
    }
);

function getOccurrence(array, value) {
    return array.filter((v) => (v === value)).length;
}

async function getOrderProductDetails() {
    const sql = `SELECT id, order_products_id FROM orders
                 WHERE id = LAST_INSERT_ID()`;
    
    let statusObject = new Object;
    try{
        const data = await sequelize.query(sql,
            { type: sequelize.QueryTypes.SELECT } 
        );
        statusObject = {
            status: 200,
            data: data
        }
    } catch(error){
        statusObject = {
            status: 500,
            message: "Error al obtener información de la orden"
        }
    }
    return statusObject;
}

async function fillOrderProductsTable(orderID,productID, quantity){
    const sql = `INSERT INTO order_products (order_id, product_id, quantity) 
                 VALUES (?, ?, ?) `;
    
    let statusObject = new Object;             
    try{
        const data = await sequelize.query(sql,
            { replacements: [orderID, productID, quantity] }
        );
        statusObject = {
            status: 200,
            data: data,
            message: "Productos agregados correctamente"
        }
    } catch(error){
        statusObject = {
            status: 500,
            message: "Error al agregar los productos"
        }
    }
    return statusObject;
}

async function checkProductsExistence(productsObj){
    const sql = `SELECT id FROM products`;

    let statusObject = new Object;
    try{
        const productsIDs = await sequelize.query(sql,
            { type: sequelize.QueryTypes.SELECT }
        );
        
        let productIDArr = [];
        productsIDs.forEach(element => {
            productIDArr.push(element.id)
        });
        let containsAll = productsObj.every(i => productIDArr.includes(i));
        if(containsAll){
            statusObject = {
                status: 200,
                message: "Todos los productos existen en la base de datos"
            }
        }
        else{
            statusObject = {
                status: 404,
                message: "Alguno de los productos ingresados no existe"
            }
        }
    } catch(error) {
        statusObject = {
            status: 500,
            message: "Error al cargar los productos"
        }
    }
    return statusObject;
}

async function checkUserExistenceByID(userID){
    const sql = `SELECT EXISTS((SELECT * FROM users 
                 WHERE id = ?))`;
    let responseObj;
    try{
        const userExistence = await sequelize.query(sql,
            { 
                type: sequelize.QueryTypes.SELECT,
                replacements: [userID]
            }
        );
        responseObj = {
            status: 200,
            exists: Object.values(userExistence[0])
        }
    } catch(error){
        responseObj = {
            status: 500,
            message: error
        }
    }
    return responseObj;
}

// Create new order -- by client
server.post('/:username/create', authMiddleware, [
    check('payment_method_id', 'Missing/invalid payment method ID')
        .not().isEmpty()
        .isInt(),
    check('order_products_id', 'Missing/invalid order products IDs')
        .not().isEmpty(),
    ],
    async (req,res) => {
        const{ payment_method_id, order_products_id } = req.body;
        const validationErrors = validationResult(req);

        if(!validationErrors.isEmpty()){
            config.errorSemantic(res,validationErrors);
            return;
        }
        else {
            const sql = `SELECT id,username,fullname, address, phone, email FROM users
                        WHERE username = ?`;
            
            const sqlAddOrder = `INSERT INTO orders (user_id, payment_method_id, order_products_id) 
                                VALUES (?,?,?) `

            if(res.locals.username === req.params.username){
                try{ 
                    const userData = await sequelize.query(sql,
                        {
                            replacements: [req.params.username],
                            type: sequelize.QueryTypes.SELECT
                        }
                    )
                    await sequelize.query(sqlAddOrder, 
                        { replacements: [userData[0].id, payment_method_id, order_products_id] }
                    );

                    const orderProductsDetails = await getOrderProductDetails();
                    if(orderProductsDetails.status === 200){
                        const orderProducts = JSON.parse(orderProductsDetails.data[0].order_products_id);
                        const orderProductsUnique = [...new Set(orderProducts)];
                        let statusArray = [];
                        for (product of orderProductsUnique){
                            let quantity = getOccurrence(orderProducts, product);
                            const insertProductsObj = await fillOrderProductsTable(orderDetails.data[0].id, product, quantity);
                            statusArray.push(insertProductsObj.status)
                        }
            
                        statusArray.forEach(element =>{
                            if(element === 500){
                                res.send({
                                    status: element,
                                    message: "Error al agregar los productos"
                                })
                            }
                        });

                        let orderObject = {
                            user_details: userData[0],
                            payment_method: payment_method_id,
                            order_products: orderProducts
                        }

                        res.status = 200;
                        res.send({
                            status: 200,
                            message: "Orden generada.",
                            order_details: orderObject
                        })
                    }
                    else{
                        res.send({
                            status: orderProductsDetails.status,
                            message: orderProductsDetails.message
                        })
                    }
                } catch(error){
                    res.status(500).send(error);
                }
            }
            else{
                res.status = 401;
                res.send({
                    status: 401,
                    message: "Primero debes iniciar sesión"
                });
            } 
        }
    }   
);

// Update order status by id
server.put('/status/:id', authMiddleware, adminMiddleware, [
    check('status_id', 'Missing/invalid status ID')
        .not().isEmpty()
        .isInt()
    ],
    async (req,res)=>{
        const validationErrors = validationResult(req);

        if(!validationErrors.isEmpty()){
            config.errorSemantic(res,validationErrors);
            return;
        }
        else{
            const sql = `UPDATE orders 
                         SET status_id = ? 
                         WHERE id= ?`;
            try{
                const data = await sequelize.query(sql, 
                    { replacements: [req.body.status_id, req.params.id] }
                )
                if(data[0].info.startsWith("Rows matched: 1")){
                    res.status = 200;
                    res.send({
                        status: 200,
                        message: "Estado de orden actualizado correctamente"
                    });
                }
                else if(data[0].info.startsWith("Rows matched: 0")){
                    res.status = 404;
                    res.send({
                        status: 404,
                        message: "ID de orden o estado de orden inválido"
                    }); 
                }
            } catch(error){
                res.status(500).send(error);
            }
        }
    }
);

//Delete order by id
server.delete('/delete/:id', authMiddleware, adminMiddleware, async (req,res)=>{
    const sqlDeleted = `INSERT INTO deleted_orders
                        SELECT orders.* FROM orders
                        WHERE id = :id`;
    const sqlFK = `DELETE FROM order_products WHERE order_id = :id`;
    const sql = `DELETE FROM orders WHERE id = :id`;
    try{
        const dataDeleted = await sequelize.query(sqlDeleted, 
            {
                replacements: {id: req.params.id}
            }
        )
        if(dataDeleted){
            const dataFK = await sequelize.query(sqlFK, 
                {
                    replacements: {id: req.params.id}
                }
            )
            if(dataFK[0].affectedRows){
                const data = await sequelize.query(sql, 
                    {
                        replacements: {id: req.params.id}
                    }
                )
                if(data[0].affectedRows){
                    res.status = 200;
                    res.send({
                    status: 200,
                    message: "Orden eliminada"
                    });
                }
            }
        }
        else{
            res.status = 404;
            res.send({
                status: 404,
                message: "La orden a eliminar no existe"
            });
        }
    } catch(error){
        res.status(500).send(error);
    }
});

module.exports = server;