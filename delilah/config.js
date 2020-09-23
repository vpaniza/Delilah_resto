module.exports = {
    firma: "somefirma",
    errorSemantic: (res, errorsArr) => {
        res.status = 422;
        res.send(
            {
                status: 422,
                message: errorsArr.array()
            }
        )
    }
}