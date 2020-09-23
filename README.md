# Delilah Restó
#### Versión 1.0.0

REST API para manejo de un restaurante. Se pueden crear usuarios nuevos con diferentes permisos, órdenes, y agregar productos nuevos, así como también modificar o eliminar datos existentes. 

## Uso

1. Descargar el archivo SQL para generar las tablas que serán necesarias. Se incluye la creación de algunas entradas a modo de ejemplo. Se recomienda usar alguna herramienta como [phpMyAdmin](https://www.phpmyadmin.net/) para el manejo de la base de datos.

2. Descargar los archivos que se encuentran en la carpeta 'src'. Ahí está la creación de los "endpoints". Se incluye un archivo 'package.json' donde se incluyen todas las dependencias necesarias.

3. Ajustar los parámetros en el archivo 'mysql.js' a modo de poder conectarse con la base de datos. Los valores que se deben obtener según el puerto que se utilice. 

4. Configurar un puerto en el archivo '/index.js' que deberá coincidir con el puerto utilizado en las rutas de navegación (URL).

```javascript
server.listen(PORT_NUMBER, () => console.log("Servidor iniciado..."));
```

5. Utilizando algún programa, [Postman](https://www.postman.com/) por ejemplo, probar las diferentes rutas que se encuentran especificadas en el archivo 'spec.yaml' dentro de la carpeta '/spec'. Al hacer los requests, considerar:
- localhost
- puerto (el mismo que el que se configuró en el paso anterior)


