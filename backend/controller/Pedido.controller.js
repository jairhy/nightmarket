const db = require('../db/conn')
const Pedido = require('../models/Pedido')
const ItemPedido = require('../models/ItemPedido')
const Produto = require('../models/Produto')
const Estoque = require('../models/Estoque')
const Entrega = require('../models/Entrega')
const Usuario = require('../models/Usuario')
const { Op } = require('sequelize')
const { calcularDesconto } = require('../utils/desconto')

// POST /pedidos - checkout: recebe { itens: [{ idProduto, quantidade }] }
const cadastrar = async (req, res) => {
    const { itens } = req.body
    const idUsuario = req.usuario.codUsuario // vem do token JWT (rota protegida)

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ message: 'O pedido precisa ter ao menos um item' })
    }

    const transacao = await db.transaction()

    try {
        let valorTotal = 0
        const itensValidados = []
        const itensAgregados = new Map()

        // 1. valida estoque de cada item ANTES de criar qualquer coisa
        for (const item of itens) {
            const idProduto = Number(item.idProduto)
            const quantidade = Number(item.quantidade)
            if (!Number.isInteger(idProduto) || idProduto <= 0) {
                throw new Error('idProduto inválido')
            }
            if (!Number.isInteger(quantidade) || quantidade <= 0) {
                throw new Error('Quantidade inválida')
            }
            itensAgregados.set(idProduto, (itensAgregados.get(idProduto) || 0) + quantidade)
        }

        for (const [idProduto, quantidade] of itensAgregados) {
            const produto = await Produto.findByPk(idProduto, { transaction: transacao, lock: transacao.LOCK.UPDATE })
            if (!produto) {
                throw new Error(`Produto ${idProduto} não encontrado`)
            }

            const estoque = await Estoque.findOne({ where: { idProduto }, transaction: transacao, lock: transacao.LOCK.UPDATE })
            if (!estoque || estoque.quantidade < quantidade) {
                throw new Error(`Estoque insuficiente para o produto "${produto.nome}"`)
            }

            valorTotal += Number(produto.preco) * quantidade
            itensValidados.push({ produto, estoque, quantidade })
        }

        // 2. cria o pedido
        const calculo = calcularDesconto(valorTotal)
        const pedido = await Pedido.create({
            idUsuario,
            valorTotal: calculo.total,
            valorDesconto: calculo.desconto,
            status: 'PAGO'
        }, { transaction: transacao })

        // 3. cria os itens e deduz o estoque
        for (const { produto, estoque, quantidade } of itensValidados) {
            await ItemPedido.create({
                idPedido: pedido.codPedido,
                idProduto: produto.codProduto,
                quantidade,
                precoUnitario: produto.preco
            }, { transaction: transacao })

            await estoque.update(
                { quantidade: estoque.quantidade - quantidade },
                { transaction: transacao }
            )
        }

        // 4. cria a entrega inicial
        await Entrega.create({
            idPedido: pedido.codPedido,
            status: 'PROCESSANDO'
        }, { transaction: transacao })

        await transacao.commit()
        res.status(201).json({ message: 'Pedido realizado com sucesso', codPedido: pedido.codPedido, subtotal: calculo.subtotal, percentualDesconto: calculo.percentual, valorDesconto: calculo.desconto, valorTotal: calculo.total })
    } catch (err) {
        await transacao.rollback()
        console.error('Erro ao cadastrar pedido', err)
        res.status(400).json({ message: err.message || 'Erro ao cadastrar pedido' })
    }
}

const listar = async (req, res) => {
    try {
        const pedidos = await Pedido.findAll({
            include: [{ model: ItemPedido, include: [Produto] }, Entrega, { model: Usuario, attributes: ['codUsuario', 'nome', 'email'] }],
            order: [['codPedido', 'DESC']]
        })
        res.status(200).json(pedidos)
    } catch (err) {
        console.error('Erro ao listar pedidos', err)
        res.status(500).json({ message: 'Erro ao listar pedidos' })
    }
}

// GET /pedidos/buscar?nome= - pedidos pelo nome do cliente (admin)
const buscarPorNome = async (req, res) => {
    try {
        const pedidos = await Pedido.findAll({
            include: [
                { model: ItemPedido, include: [Produto] }, Entrega,
                { model: Usuario, attributes: ['codUsuario', 'nome', 'email'], where: { nome: { [Op.like]: `%${req.query.nome || ''}%` } } }
            ],
            order: [['codPedido', 'DESC']]
        })
        res.status(200).json(pedidos)
    } catch (err) {
        console.error('Erro ao buscar pedidos por nome', err)
        res.status(500).json({ message: 'Erro ao buscar pedidos por nome' })
    }
}

// GET /pedidos/meus-pedidos - histórico do usuário logado
const meusPedidos = async (req, res) => {
    try {
        const pedidos = await Pedido.findAll({
            where: { idUsuario: req.usuario.codUsuario },
            include: [{ model: ItemPedido, include: [Produto] }, Entrega]
        })
        res.status(200).json(pedidos)
    } catch (err) {
        console.error('Erro ao buscar histórico de pedidos', err)
        res.status(500).json({ message: 'Erro ao buscar histórico de pedidos' })
    }
}

const buscarPorId = async (req, res) => {
    try {
        const pedido = await Pedido.findByPk(req.params.id, {
            include: [{ model: ItemPedido, include: [Produto] }, Entrega]
        })
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado' })
        if (req.usuario.tipo !== 'ADMIN' && pedido.idUsuario !== req.usuario.codUsuario) {
            return res.status(403).json({ message: 'Acesso negado a este pedido' })
        }
        res.status(200).json(pedido)
    } catch (err) {
        console.error('Erro ao buscar pedido', err)
        res.status(500).json({ message: 'Erro ao buscar pedido' })
    }
}

const atualizar = async (req, res) => {
    try {
        const pedido = await Pedido.findByPk(req.params.id)
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado' })

        await pedido.update(req.body)
        res.status(200).json({ message: 'Pedido atualizado com sucesso' })
    } catch (err) {
        console.error('Erro ao atualizar pedido', err)
        res.status(500).json({ message: 'Erro ao atualizar pedido' })
    }
}

const atualizarParcial = async (req, res) => atualizar(req, res)

const deletar = async (req, res) => {
    try {
        const pedido = await Pedido.findByPk(req.params.id)
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado' })

        await pedido.destroy()
        res.status(200).json({ message: 'Pedido removido com sucesso' })
    } catch (err) {
        console.error('Erro ao remover pedido', err)
        res.status(500).json({ message: 'Erro ao remover pedido' })
    }
}

module.exports = { cadastrar, listar, buscarPorNome, meusPedidos, buscarPorId, atualizar, atualizarParcial, deletar }
