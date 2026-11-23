const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { Op } = require('sequelize')
const Usuario = require('../models/Usuario')
const validaCpf = require('../utils/validaCpf')
const buscarEnderecoPorCep = require('../utils/viaCep')

const AVATAR_MAX = 700000

const adminLogado = (req) => {
    try {
        const [, token] = (req.headers['authorization'] || '').split(' ')
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        return payload.tipo === 'ADMIN'
    } catch (e) {
        return false
    }
}

const cadastrar = async (req, res) => {
    const { nome, email, senha, cpf, cep, numero, tipo } = req.body

    try {
        let tipoFinal = 'CLIENTE'
        if (tipo === 'ADMIN') {
            const existeAdmin = await Usuario.count({ where: { tipo: 'ADMIN' } })
            if (adminLogado(req) || existeAdmin === 0) tipoFinal = 'ADMIN'
            else return res.status(403).json({ message: 'Apenas administradores podem criar contas ADMIN' })
        }

        if (!nome || !email || !senha || !cpf || !cep) {
            return res.status(400).json({ message: 'Campos obrigatórios: nome, email, senha, cpf, cep' })
        }

        if (!validaCpf(cpf)) {
            return res.status(400).json({ message: 'CPF inválido' })
        }

        const jaExiste = await Usuario.findOne({
            where: { [Op.or]: [{ email }, { cpf: cpf.replace(/\D/g, '') }] }
        })
        if (jaExiste) {
            return res.status(409).json({ message: 'E-mail ou CPF já cadastrado' })
        }

        const endereco = await buscarEnderecoPorCep(cep)
        const senhaHash = await bcrypt.hash(senha, 10)

        const novoUsuario = await Usuario.create({
            nome,
            email,
            senha: senhaHash,
            cpf: cpf.replace(/\D/g, ''),
            cep: cep.replace(/\D/g, ''),
            numero,
            rua: endereco.rua,
            bairro: endereco.bairro,
            cidade: endereco.cidade,
            uf: endereco.uf,
            tipo: tipoFinal
        })

        const { senha: _omit, ...usuarioSemSenha } = novoUsuario.toJSON()
        res.status(201).json({ message: 'Usuário cadastrado com sucesso', usuario: usuarioSemSenha })
    } catch (err) {
        console.error('Erro ao cadastrar usuário', err)
        res.status(500).json({ message: 'Erro ao cadastrar usuário' })
    }
}

const listar = async (req, res) => {
    try {
        const usuarios = await Usuario.findAll({ attributes: { exclude: ['senha', 'avatar'] } })
        res.status(200).json(usuarios)
    } catch (err) {
        console.error('Erro ao listar usuários', err)
        res.status(500).json({ message: 'Erro ao listar usuários' })
    }
}

const buscarPorId = async (req, res) => {
    const { id } = req.params
    try {
        const usuario = await Usuario.findByPk(id, { attributes: { exclude: ['senha'] } })
        if (!usuario) return res.status(404).json({ message: 'Usuário não encontrado' })
        res.status(200).json(usuario)
    } catch (err) {
        console.error('Erro ao buscar usuário', err)
        res.status(500).json({ message: 'Erro ao buscar usuário' })
    }
}

const buscarPorNome = async (req, res) => {
    const { nome } = req.query
    try {
        const usuarios = await Usuario.findAll({
            where: { nome: { [Op.like]: `%${nome}%` } },
            attributes: { exclude: ['senha'] }
        })
        res.status(200).json(usuarios)
    } catch (err) {
        console.error('Erro ao buscar usuário por nome', err)
        res.status(500).json({ message: 'Erro ao buscar usuário por nome' })
    }
}

const atualizar = async (req, res) => {
    const { id } = req.params
    try {
        const ehAdmin = req.usuario.tipo === 'ADMIN'
        if (!ehAdmin && Number(id) !== Number(req.usuario.codUsuario)) {
            return res.status(403).json({ message: 'Você só pode editar o seu próprio perfil' })
        }

        const usuario = await Usuario.findByPk(id)
        if (!usuario) return res.status(404).json({ message: 'Usuário não encontrado' })

        const permitidos = ['nome', 'email', 'senha', 'cep', 'numero', 'avatar']
        if (ehAdmin) permitidos.push('tipo', 'cpf')
        const dados = {}
        permitidos.forEach(k => { if (req.body[k] !== undefined) dados[k] = req.body[k] })

        if (dados.nome !== undefined && !String(dados.nome).trim()) {
            return res.status(400).json({ message: 'Nome não pode ficar vazio' })
        }
        if (dados.email && dados.email !== usuario.email) {
            const emUso = await Usuario.findOne({ where: { email: dados.email, codUsuario: { [Op.ne]: usuario.codUsuario } } })
            if (emUso) return res.status(409).json({ message: 'E-mail já cadastrado' })
        }
        if (dados.cpf) {
            if (!validaCpf(dados.cpf)) return res.status(400).json({ message: 'CPF inválido' })
            dados.cpf = dados.cpf.replace(/\D/g, '')
        }
        if (dados.tipo && !['CLIENTE', 'ADMIN'].includes(dados.tipo)) delete dados.tipo
        if (dados.senha) dados.senha = await bcrypt.hash(dados.senha, 10)
        else delete dados.senha

        if (dados.avatar) {
            if (!/^data:image\/(jpeg|png|webp);base64,/.test(dados.avatar) || dados.avatar.length > AVATAR_MAX) {
                return res.status(400).json({ message: 'Imagem inválida ou muito grande' })
            }
        } else if (dados.avatar !== undefined) {
            dados.avatar = null
        }

        if (dados.cep !== undefined) {
            const cepLimpo = String(dados.cep).replace(/\D/g, '')
            if (cepLimpo !== usuario.cep || !usuario.rua) {
                try {
                    const endereco = await buscarEnderecoPorCep(cepLimpo)
                    Object.assign(dados, endereco)
                } catch (e) {
                    if (cepLimpo !== usuario.cep) return res.status(400).json({ message: e.message })
                }
            }
            dados.cep = cepLimpo
        }

        await usuario.update(dados)
        res.status(200).json({ message: 'Usuário atualizado com sucesso' })
    } catch (err) {
        console.error('Erro ao atualizar usuário', err)
        res.status(500).json({ message: 'Erro ao atualizar usuário' })
    }
}

const atualizarParcial = async (req, res) => {
    // PATCH usa a mesma lógica do PUT aqui, pois .update() já só altera os campos enviados
    return atualizar(req, res)
}

const deletar = async (req, res) => {
    const { id } = req.params
    try {
        const usuario = await Usuario.findByPk(id)
        if (!usuario) return res.status(404).json({ message: 'Usuário não encontrado' })

        await usuario.destroy()
        res.status(200).json({ message: 'Usuário removido com sucesso' })
    } catch (err) {
        console.error('Erro ao remover usuário', err)
        res.status(500).json({ message: 'Erro ao remover usuário' })
    }
}

module.exports = { cadastrar, listar, buscarPorId, buscarPorNome, atualizar, atualizarParcial, deletar }
