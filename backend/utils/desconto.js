const FAIXAS = [
    { minimo: 5000, percentual: 10 },
    { minimo: 1000, percentual: 5 }
]

function calcularDesconto(subtotal) {
    const faixa = FAIXAS.find(f => subtotal >= f.minimo)
    const percentual = faixa ? faixa.percentual : 0
    const desconto = Math.round(subtotal * percentual) / 100
    return { subtotal, percentual, desconto, total: Math.round((subtotal - desconto) * 100) / 100 }
}

module.exports = { FAIXAS, calcularDesconto }
