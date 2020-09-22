module.exports = (req, res, next) => {
    const roleID = res.locals.roleID; 
    
    if(roleID === 1){
        return next();
    }

    res.status = 401;
    res.send(
        {
            status: 401,
            message: "No posees los permisos de administrador"
        }
    )
}