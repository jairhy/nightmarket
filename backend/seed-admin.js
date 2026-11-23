const fs = require('fs')
const path = require('path')
const bcrypt = require('bcrypt')
require('dotenv').config()
const conn = require('./db/conn')
require('./models/rel')
const Usuario = require('./models/Usuario')
const validaCpf = require('./utils/validaCpf')
const buscarEnderecoPorCep = require('./utils/viaCep')

async function seedAdmin() {
    try {
        const { ADMIN_NOME, ADMIN_EMAIL, ADMIN_SENHA, ADMIN_CPF, ADMIN_CEP, ADMIN_NUMERO } = process.env

        if (!ADMIN_EMAIL || !ADMIN_SENHA || !ADMIN_CPF || !ADMIN_CEP) {
            throw new Error('Defina ADMIN_EMAIL, ADMIN_SENHA, ADMIN_CPF e ADMIN_CEP no arquivo .env')
        }
        if (ADMIN_SENHA.length < 8) throw new Error('ADMIN_SENHA deve ter ao menos 8 caracteres')
        if (!validaCpf(ADMIN_CPF)) throw new Error('ADMIN_CPF inválido')

        const endereco = await buscarEnderecoPorCep(ADMIN_CEP)
        const foto = fs.readFileSync(path.join(__dirname, 'assets', 'admin.jpg')).toString('base64')
        const avatar = `data:image/jpeg;base64,${foto}`

        const existente = await Usuario.findOne({ where: { email: ADMIN_EMAIL } })
        if (existente) {
            await existente.update({
                nome: ADMIN_NOME || existente.nome,
                senha: await bcrypt.hash(ADMIN_SENHA, 10),
                cpf: ADMIN_CPF.replace(/\D/g, ''),
                cep: ADMIN_CEP.replace(/\D/g, ''),
                numero: ADMIN_NUMERO || existente.numero,
                ...endereco,
                tipo: 'ADMIN',
                avatar
            })
            console.log('Admin já existia: senha redefinida, foto atualizada e tipo garantido como ADMIN.')
        } else {
            await Usuario.create({
                nome: ADMIN_NOME || 'Administrador',
                email: ADMIN_EMAIL,
                senha: await bcrypt.hash(ADMIN_SENHA, 10),
                cpf: ADMIN_CPF.replace(/\D/g, ''),
                cep: ADMIN_CEP.replace(/\D/g, ''),
                numero: ADMIN_NUMERO || 's/n',
                ...endereco,
                tipo: 'ADMIN',
                avatar
            })
            console.log(`Admin criado: ${ADMIN_EMAIL}`)
        }
    } catch (err) {
        console.error('Erro ao criar admin:', err.message)
        process.exitCode = 1
    } finally {
        await conn.close()
    }
}

seedAdmin()
