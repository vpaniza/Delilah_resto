/////////////////// PRODUCT RELATED ENDPOINTS ///////////////////

const express = require("express");
const server = express();
const sequelize = require("./../../mysql");
const {check, validationResult} = require("express-validator");
const config = require("./../../config");

////////////////////////  MIDDLEWARES  ////////////////////////

const authMiddleware = require("./../../middlewares/authentication");
const adminMiddleware = require("../../middlewares/adminAuth");

////////////////////////  ENDPOINTS  /////////////////////////

// Get all products from 'products" table
server.get('/', async (req,res)=>{
    const sql = 'SELECT * FROM products WHERE stock > 0';
    try{    
        const data = await sequelize.query(sql, 
            { type: sequelize.QueryTypes.SELECT })
        res.status = 200;
        res.send({
            status: 200,
            data: data
        });
    } catch(error){
        res.status(500).send(error);
    }
});

// Get product by ID -- only by administrator
server.get('/:id', authMiddleware, adminMiddleware, async (req,res)=>{
    const sql = `SELECT * FROM products WHERE id = ${req.params.id}`;
    try{    
        const data = await sequelize.query(sql, 
            { type: sequelize.QueryTypes.SELECT} );
        if(data[0]){
            res.status = 200;
            res.send({
                status: 200,
                data: data[0]
            });
        }
        else{
            res.status = 404;
            res.send({
                status: 404,
                message: "El ID del producto no existe"
            });
        }
    } catch(error){
        res.status(500).send(error);
    } 
});

// Add product -- only by administrator
server.post('/', authMiddleware, adminMiddleware, [
    check('name', 'Missing/invalid product name')
        .not().isEmpty(),
    check('description')
        .optional(),
    check('price', 'Missing/invalid product price')
        .not().isEmpty()
        .isInt(),
    check('stock', 'Missing/invalid product stock')
        .not().isEmpty()
        .isInt(),
    check('picture', 'Missing/invalid picture URL')
        .not().isEmpty()
        .isURL(),
    ], 
    async (req,res) => {
        const {name, description, price, stock, picture} = req.body;
        const validationErrors = validationResult(req);

        if(!validationErrors.isEmpty()){
            config.errorSemantic(res,validationErrors);
            return;
        }
        else{
            const sql = `INSERT INTO products (name, description, price, stock, picture) 
                        VALUES (?, ?, ?, ?, ?) `;
            try{
                await sequelize.query(sql, 
                    {
                        replacements: [name, description, price, stock, picture]
                    }
                )
                res.status = 200;
                res.send({
                    status: 200,
                    message: "Producto agregado satisfactoriamente"
                });
            } catch(error){
                res.status(500).send(error);
            }
        }  
    }
);

// Update product by id
server.put('/:id', authMiddleware, adminMiddleware, [
    check('name', 'Missing/invalid product name')
        .not().isEmpty(),
    check('description')
        .optional(),
    check('price', 'Missing/invalid product price')
        .not().isEmpty()
        .isInt(),
    check('stock', 'Missing/invalid product stock')
        .not().isEmpty()
        .isInt(),
    check('picture', 'Missing/invalid picture URL')
        .not().isEmpty()
        .isURL(),
    ], 
    async (req,res)=>{
        const {name, description, price, stock, picture} = req.body;
        const validationErrors = validationResult(req);

        if(!validationErrors.isEmpty()){
            config.errorSemantic(res,validationErrors);
            return;
        }
        else{
            const sql = `UPDATE products 
                         SET 
                            name = ?, 
                            description = ?, 
                            price = ?, 
                            stock = ?, 
                            picture = ? 
                         WHERE id = ${req.params.id}`;
            try{
                const data = await sequelize.query(sql, 
                    {
                        replacements: [name, description, price, stock, picture]
                    }
                )
                if(data[0].info.startsWith("Rows matched: 1")){
                    res.send({
                        status: 200,
                        message: "Producto actualizado correctamente"
                    });
                }
                else if(data[0].info.startsWith("Rows matched: 0")){
                    res.status = 404;
                    res.send({
                        status: 404,
                        message: "El producto que se quiere actualizar no existe"
                    });
                }
            } catch(error){
                res.status(500).send(error);
            }
        }
    }
);

//Delete product by id
server.delete('/delete/:id', authMiddleware, adminMiddleware, async (req,res)=>{
    const sql = `DELETE FROM products WHERE id = :id`;
    try{
        const data = await sequelize.query(sql, 
            {
                replacements: {id: req.params.id}
            }
        )
        if(data[0].affectedRows){
            res.status = 200;
            res.send({
                status: 200,
                message: "Producto eliminado"
            });
        }
        else{
            res.status = 404;
            res.send({
                status: 404,
                message: "El producto a eliminar no existe"
            });
        }
    } catch(error){
        res.status(500).send(error);
    }
});

module.exports = server;