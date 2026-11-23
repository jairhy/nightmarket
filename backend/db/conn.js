const { Sequelize } = require('sequelize')
require('dotenv').config()

const db = new Sequelize(
    process.env.DB_NAME || process.env.MYSQLDATABASE || 'dc_pecas',
    process.env.DB_USER || process.env.MYSQLUSER || 'root',
    process.env.DB_PASS || process.env.MYSQLPASSWORD || '',
    {
        dialect: 'mysql',
        host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
        port: process.env.DB_PORT || process.env.MYSQLPORT || 3306,
        logging: false
    }
)

module.exports = db
