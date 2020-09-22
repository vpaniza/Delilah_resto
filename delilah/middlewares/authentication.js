const jwt = require("jsonwebtoken");
const config = require("../config");

const errorHandling = (res) => {
    res.status = 401;
    res.send(
        {
            status: 401,
            message: "No estás autorizado"
        }
    )
}

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if(!authHeader){
        errorHandling(res);
    }

    const token = authHeader && authHeader.split(' ')[1];
    const authenticationData = jwt.verify(token, config.firma); //Devuelve el objeto guardado en el momento del login
    res.locals.roleID = authenticationData.role;
    res.locals.username = authenticationData.username

    if(authenticationData){
        return next();
    }

    errorHandling(res);
}