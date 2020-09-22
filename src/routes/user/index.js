/////////////////// USER RELATED ENDPOINTS ///////////////////

const express = require("express");
const {check, validationResult} = require("express-validator");
const server = express();
const sequelize = require("../../mysql");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const config = require("./../../config");

////////////////////////  MIDDLEWARES  ////////////////////////

const authMiddleware = require("../../middlewares/authentication");
const adminMiddleware = require("../../middlewares/adminAuth");

//////////////////////  ERROR HANDLING  ///////////////////////

const errorSemantic = (res, errorsArr) => {
    res.status = 422;
    res.send(
        {
            status: 422,
            message: errorsArr.array()
        }
    )
}

////////////////////////  ENDPOINTS  /////////////////////////

// Login endpoint -- existing users & admin check
server.post('/login', [
    check('password', 'Missing/invalid password: must be at least 6 char long')
        .not().isEmpty()
    ],
    async (req,res)=>{
        const { username, email, password } = req.body;
        const validationErrors = validationResult(req);

        if(!validationErrors.isEmpty()){
            errorSemantic(res,validationErrors);
            return;
        }
        else{
            const sql = `SELECT * FROM users             
                         WHERE (username = ? OR email = ?)`;
            try{
                const data = await sequelize.query(sql,
                    {
                        replacements: [username, email],
                        type: sequelize.QueryTypes.SELECT
                    }
                )
                if(data.length) {
                    bcrypt.compare(password, data[0].password, function(err,result) {
                        if(result){
                            const token = jwt.sign(
                                {
                                    username: data[0].username,
                                    role: data[0].role_id
                                }, config.firma)
                            
                            res.status = 200;
                            res.send({
                                status: 200,
                                message: "Inicio de sesión correcto",
                                username: data[0].username,
                                token
                            });
                        }
                        else{
                            res.status = 401;
                            res.send({
                                status: 401,
                                message: "Usuario o contraseña incorrecto/s."
                            });
                        }
                    })
                }
                else {
                    res.send("Usuario o contraseña incorrecto/s.");
                }
            } catch(error){
                res.status(500).send(error);
            }
        }
    }
);

// Create new user -- Add to database: users
server.post('/register', [
    check('username')
        .not().isEmpty(),
    check('fullname', 'Missing/invalid name and lastname')
        .not().isEmpty(),
    check('password', 'Missing/invalid password: must be at least 6 char long')
        .not().isEmpty()
        .isLength({ min: 6 }),
    check('address', 'Missing/invalid address')
        .not().isEmpty(),
    check('phone', 'Missing/invalid phone number')
        .not().isEmpty()
        .isAlphanumeric(),
    check('email', 'Missing/invalid email')
        .not().isEmpty()
        .isEmail()
    ],
    async (req,res)=>{
        const validationErrors = validationResult(req);
        const { username, fullname, password, address, phone, email } = req.body;
        
        if(!validationErrors.isEmpty()){
            errorSemantic(res,validationErrors);
            return;
        }
        else{
            // First check if user is already registered:
            const userExistenceData = await checkUserExistence(username,email);
            if(userExistenceData.exists[0]){
                res.status = 409;
                res.send({
                    status: 409,
                    message: "El mail y/o nombre de usuario ya existe"
                })
            }
            else{
                const sql = `INSERT INTO users (username, fullname, password, address, phone, email) 
                             VALUES (?,?,?,?,?,?)`;
                try{
                    await bcrypt.hash(password, 10, function(err, hash){
                        if(err) throw err;
                        else{
                            sequelize.query(sql, 
                                { replacements: [username, fullname, hash, address, phone, email] }
                            )
                        }
                    });
                    res.status = 200;
                    res.send({
                        status: 200,
                        message: "Usuario creado correctamente"
                    })
                } catch(error){
                    res.status(500).send(error);
                }
            }
        }
    }
);

async function checkUserExistence(username,email){
    const sql = `SELECT EXISTS((SELECT * FROM users 
                 WHERE (username = ? OR email = ?)))`;
    let responseObj;
    try{
        const userExistence = await sequelize.query(sql,
            { 
                type: sequelize.QueryTypes.SELECT,
                replacements: [username, email]
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

// Update existing user -- must be logged in
server.put('/:username/update', authMiddleware,[
    check('fullname', 'Missing/invalid name and lastname')
        .not().isEmpty(),
    check('password', 'Missing/invalid password: must be at least 6 char long')
        .not().isEmpty()
        .isLength({ min: 6 }),
    check('address', 'Missing/invalid address')
        .not().isEmpty(),
    check('phone', 'Missing/invalid phone number')
        .not().isEmpty()
        .isAlphanumeric()
    ], 
    async (req,res)=>{
        const { fullname, password, address, phone } = req.body;
        const validationErrors = validationResult(req);

        if(!validationErrors.isEmpty()){
            errorSemantic(res,validationErrors);
            return;
        }
        else{
            const sql = `UPDATE users 
                         SET  
                            fullname = ?, 
                            password = ?, 
                            address = ?, 
                            phone = ?
                         WHERE username = ?`;

            if (res.locals.username === req.params.username){
                try{
                    await bcrypt.hash(password, 10, function(err, hash){
                        if(err) throw err;
                        else{
                            sequelize.query(sql, 
                                { replacements: [fullname, hash, address, phone, req.params.username] }
                            )
                        }
                    });
                    res.status = 200;
                    res.send({
                        status: 200,
                        message: "El usuario fue actualizado exitosamente"
                    })
                } catch(error){
                    res.status(500).send(error);
                }
            } else{
                res.status = 401;
                res.send({
                    status: 401,
                    message: "No estas autorizado"
                });
            }
        }
    }
);

// Get user details by username -- must be logged in
server.get('/:username/details', authMiddleware, async (req,res) => {
    const sql = `SELECT username,fullname, address, phone, email FROM users
                 WHERE username = ?`;
    if(res.locals.username === req.params.username){
        try{
            const data = await sequelize.query(sql,
                {
                    type: sequelize.QueryTypes.SELECT,
                    replacements: [res.locals.username]
                }
            );
            res.status = 200;
            res.send({
                status: 200,
                user_details: data
            })
        } catch(error){
            res.status(500).send(error);
        }
    }
    else{
        res.status = 401;
        res.send({
            status: 401,
            message: "Primero debes iniciar sesión"
        })
    } 
})

// Get user details by id -- only administrator can perform this
server.get('/admin/details/:userid', authMiddleware, adminMiddleware, async (req,res) => {
    const sql = `SELECT * FROM users
                 WHERE id = ${req.params.userid}`;

    try{
        const data = await sequelize.query(sql,
            {
                type: sequelize.QueryTypes.SELECT,
                replacements: [req.params.userid]
            }
        );
        res.status = 200;
        res.send({
            status: 200,
            user_details: data
        })
    } catch(error){
        res.status(500).send(error);
    }
})

// Change user role by id -- only administrator can perform this
server.put('/admin/:userid/role', authMiddleware, adminMiddleware, async (req,res) => {
    const sql = `UPDATE users
                 SET role_id = ?
                 WHERE id = ${req.params.userid}`;

    try{
        const data = await sequelize.query(sql,
            { replacements: [req.body.role_id] }
        );
        res.status = 200;
        res.send({
            status: 200,
            operation_details: data[0]
        })
    } catch(error){
        res.status(500).send(error);
    }
});

// Delete user -- only administrator can perform this
server.delete('/admin/delete', authMiddleware, adminMiddleware, [
    check('username')
        .optional(),
    check('id', 'Invalid ID type')
        .optional()
        .isInt()
    ],
    async (req,res)=>{
        const { id, username } = req.body;
        const validationErrors = validationResult(req);

        if(!validationErrors.isEmpty()){
            errorSemantic(res,validationErrors);
            return;
        }
        else {
            const sql = `DELETE FROM users 
                         WHERE (id = ? OR username = ?)`;

            try{
                await sequelize.query(sql,
                    { replacements: [id, username] }
                );
                res.status = 200;
                res.send({
                    status: 200,
                    message: "Se eliminó el usuario correctamente"
                })
            } catch(error){
                res.status(500).send(error);
            }
        }
    }
);

module.exports = server;