const $ = (id) => document.getElementById(id)
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

let perfil = null
let pedidos = []
let itens = []

const parseData = (s) => { const [a, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d) }
const fmtData = (s) => { const d = parseData(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` }
const chaveDia = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

function imgHTML(produto, alt) {
    if (!produto || !produto.imagem) return '<span class="sem-img">SEM IMAGEM</span>'
    return `<img src="${resolverImagem(produto.imagem)}" alt="${esc(alt)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'sem-img',textContent:'SEM IMAGEM'}))">`
}

function renderAvatar() {
    const foto = perfil && perfil.avatar
    const nome = (perfil && perfil.nome) || 'U'
    $('avatar').innerHTML = foto ? `<img src="${foto}" alt="Foto de perfil">` : `<span>${esc(nome.trim().charAt(0).toUpperCase())}</span>`
}

function redimensionar(file) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
            const t = 320
            const c = document.createElement('canvas')
            c.width = c.height = t
            const lado = Math.min(img.width, img.height)
            c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, t, t)
            URL.revokeObjectURL(url)
            resolve(c.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = reject
        img.src = url
    })
}

function alerta(tipo, msg) {
    $('alerta-area').innerHTML = `<div class="alerta ${tipo}">${esc(msg)}</div>`
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

function agregar() {
    const mapa = new Map()
    pedidos.filter(p => p.status !== 'CANCELADO').forEach(p => {
        (p.itemPedidos || []).forEach(it => {
            const id = it.idProduto
            const a = mapa.get(id) || { id, produto: it.produto, qtd: 0, gasto: 0, ultima: p.dataPedido, pedidos: 0 }
            a.qtd += it.quantidade
            a.gasto += it.quantidade * Number(it.precoUnitario)
            a.pedidos++
            if (p.dataPedido > a.ultima) a.ultima = p.dataPedido
            mapa.set(id, a)
        })
    })
    itens = [...mapa.values()].sort((a, b) => b.ultima.localeCompare(a.ultima))
}

function renderSidebar() {
    $('p-nome').textContent = perfil.nome
    $('p-email').textContent = perfil.email
    $('p-tipo').textContent = perfil.tipo
    const local = [perfil.cidade, perfil.uf].filter(Boolean).join(' / ')
    const cpf = perfil.cpf ? perfil.cpf.replace(/^(\d{3})\d{6}(\d{2})$/, '$1.***.***-$2') : ''
    const linhas = [
        ['LOC', local], ['RUA', [perfil.rua, perfil.numero].filter(Boolean).join(', ')],
        ['BAIRRO', perfil.bairro], ['CEP', perfil.cep], ['CPF', cpf]
    ].filter(l => l[1])
    $('p-info').innerHTML = linhas.map(([k, v]) => `<div><b>${k}</b><span>${esc(v)}</span></div>`).join('')
    renderAvatar()
}

function renderStats() {
    const validos = pedidos.filter(p => p.status !== 'CANCELADO')
    $('s-pedidos').textContent = validos.length
    $('s-itens').textContent = itens.reduce((s, i) => s + i.qtd, 0)
    $('s-unicos').textContent = itens.length
    $('s-gasto').textContent = brl(validos.reduce((s, p) => s + Number(p.valorTotal), 0))
    $('c-itens').textContent = itens.length
    $('c-pedidos').textContent = pedidos.length
}

function renderGeral() {
    const vazio = '<p class="vazio" style="grid-column:1/-1">Nenhuma compra ainda. <a href="./produtos.html" style="color:var(--c-cyan)">Ver catálogo →</a></p>'
    $('g-recentes').innerHTML = itens.length ? itens.slice(0, 6).map(i => `
        <div class="pin">
            <div class="im">${imgHTML(i.produto, i.produto && i.produto.nome)}</div>
            <div class="tx"><strong>${esc(i.produto ? i.produto.nome : `Produto #${i.id}`)}</strong>
            <span>${i.qtd}x · ${fmtData(i.ultima)}</span></div>
        </div>`).join('') : vazio

    const porDia = {}
    pedidos.filter(p => p.status !== 'CANCELADO').forEach(p => { const k = chaveDia(parseData(p.dataPedido)); porDia[k] = (porDia[k] || 0) + 1 })
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const ini = new Date(hoje); ini.setDate(ini.getDate() - 364)
    ini.setDate(ini.getDate() - ini.getDay())
    let html = '', meses = '', ultimoMes = -1, total = 0
    const cursor = new Date(ini)
    for (let col = 0; cursor <= hoje; col++) {
        const mesCol = cursor.getMonth()
        meses += `<span>${mesCol !== ultimoMes ? MESES[mesCol] : ''}</span>`
        ultimoMes = mesCol
        for (let r = 0; r < 7; r++) {
            if (cursor > hoje) { html += '<i class="v"></i>'; } else {
                const n = porDia[chaveDia(cursor)] || 0
                total += n
                html += `<i class="${n ? 'l' + Math.min(n + 1, 4) : ''}" title="${n} pedido(s) em ${cursor.toLocaleDateString('pt-BR')}"></i>`
            }
            cursor.setDate(cursor.getDate() + 1)
        }
    }
    $('heat').innerHTML = html
    $('heat-meses').innerHTML = meses
    $('g-heat-titulo').textContent = `${total} pedido${total === 1 ? '' : 's'} no último ano`

    const ord = [...pedidos].sort((a, b) => b.codPedido - a.codPedido)
    let mesAtual = '', tl = ''
    ord.forEach(p => {
        const d = parseData(p.dataPedido)
        const m = `${MESES_LONGO[d.getMonth()]} ${d.getFullYear()}`
        if (m !== mesAtual) { tl += `<div class="tl-mes">${m}</div>`; mesAtual = m }
        const qtd = (p.itemPedidos || []).reduce((s, i) => s + i.quantidade, 0)
        tl += `<div class="tl-item"><div class="t">Realizou o pedido <em>#${p.codPedido}</em> <span class="badge-status badge-${p.status}">${p.status}</span></div>
            <div class="s">${qtd} item(ns) · ${brl(p.valorTotal)} · ${fmtData(p.dataPedido)}</div></div>`
    })
    $('g-timeline').innerHTML = tl || '<p class="vazio">Sem atividade ainda.</p>'
}

function renderItens(filtro = '') {
    const f = filtro.toLowerCase()
    const lista = itens.filter(i => !f || (i.produto && i.produto.nome.toLowerCase().includes(f)))
    $('lista-itens').innerHTML = lista.length ? lista.map(i => `
        <article class="card-produto card-comprado">
            <span class="qtd-badge">x${i.qtd}</span>
            <div class="thumb">${imgHTML(i.produto, i.produto && i.produto.nome)}</div>
            <div class="info">
                <h3>${esc(i.produto ? i.produto.nome : `Produto #${i.id}`)}</h3>
                <span class="meta">Última compra: ${fmtData(i.ultima)}</span>
                <span class="preco">${brl(i.gasto)}</span>
            </div>
        </article>`).join('') : '<p class="vazio" style="grid-column:1/-1">Nenhum item encontrado.</p>'
}

function renderPedidos() {
    const ord = [...pedidos].sort((a, b) => b.codPedido - a.codPedido)
    $('lista-pedidos').innerHTML = ord.length ? ord.map(p => {
        const e = p.entrega
        const linhas = (p.itemPedidos || []).map(i => `<tr><td>${esc(i.produto ? i.produto.nome : `Produto #${i.idProduto}`)}</td><td>${i.quantidade}</td><td>${brl(i.precoUnitario)}</td><td>${brl(i.precoUnitario * i.quantidade)}</td></tr>`).join('')
        return `<div class="painel mb-24">
            <div class="flex-between mb-16" style="flex-wrap:wrap;gap:10px;">
                <div><p class="eyebrow">PEDIDO #${p.codPedido}</p><p class="muted mono" style="font-size:0.8rem;">Realizado em ${fmtData(p.dataPedido)}</p></div>
                <div class="flex gap-8" style="align-items:center;">
                    <span class="badge-status badge-${p.status}">${p.status}</span>
                    ${e ? `<span class="badge-status badge-${e.status}">${e.status.replace('_', ' ')}</span>` : ''}
                </div>
            </div>
            <div class="tabela-wrap"><table class="tabela-nm"><thead><tr><th>Produto</th><th>Qtd.</th><th>Preço Un.</th><th>Subtotal</th></tr></thead><tbody>${linhas}</tbody></table></div>
            <div class="flex-between mt-16" style="flex-wrap:wrap;gap:8px;">
                <span class="mono muted">${e && e.codigoRastreio ? `Rastreio: ${esc(e.codigoRastreio)}` : 'Sem código de rastreio ainda'}</span>
                <span class="preco" style="font-family:var(--font-mono);color:var(--c-yellow);font-size:1.2rem;">${Number(p.valorDesconto) > 0 ? `<small class="muted" style="font-size:0.75rem;">Desconto: -${brl(p.valorDesconto)} &nbsp;</small>` : ''}Total: ${brl(p.valorTotal)}</span>
            </div></div>`
    }).join('') : '<p class="vazio">Você ainda não fez nenhum pedido. <a href="./produtos.html" style="color:var(--c-cyan)">Ver catálogo →</a></p>'
}

function preencherForm() {
    $('nome').value = perfil.nome || ''
    $('email').value = perfil.email || ''
    $('cpf').value = perfil.cpf || ''
    $('tipo').value = perfil.tipo || ''
    $('cep').value = perfil.cep || ''
    $('numero').value = perfil.numero || ''
    $('rua').value = perfil.rua || ''
    $('bairro').value = perfil.bairro || ''
    $('cidade').value = [perfil.cidade, perfil.uf].filter(Boolean).join(' / ')
}

function abrirTab(nome) {
    document.querySelectorAll('.perfil-tabs .tab-btn').forEach(b => b.classList.toggle('ativo', b.dataset.tab === nome))
    document.querySelectorAll('.tab-painel').forEach(p => p.classList.toggle('ativo', p.id === `tab-${nome}`))
    history.replaceState(null, '', `#${nome}`)
}

async function carregarTudo() {
    try {
        const [rp, rd] = await Promise.all([
            Auth.authFetch(`${API_URL}/usuarios/perfil`),
            Auth.authFetch(`${API_URL}/pedidos/meus-pedidos`)
        ])
        if (rp.ok) perfil = await rp.json()
        const ped = rd.ok ? await rd.json() : []
        pedidos = Array.isArray(ped) ? ped : []
    } catch (err) {
        console.error('Erro ao carregar perfil', err)
        alerta('erro', 'FALHA DE CONEXÃO :: não foi possível carregar seus dados')
    }
    if (!perfil) perfil = { ...Auth.getUsuario() }
    agregar()
    renderSidebar(); renderStats(); renderGeral(); renderItens(); renderPedidos(); preencherForm()
}

document.addEventListener('DOMContentLoaded', () => {
    Auth.exigirLogin()
    carregarTudo().then(() => { const h = location.hash.slice(1); if (['geral', 'itens', 'pedidos', 'config'].includes(h)) abrirTab(h) })

    document.querySelectorAll('.perfil-tabs .tab-btn').forEach(b => b.addEventListener('click', () => abrirTab(b.dataset.tab)))
    document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => abrirTab(b.dataset.goto)))
    $('btn-editar').addEventListener('click', () => { abrirTab('config'); window.scrollTo({ top: 0, behavior: 'smooth' }) })
    $('filtro-itens').addEventListener('input', e => renderItens(e.target.value))

    const escolher = () => $('input-foto').click()
    $('btn-foto').addEventListener('click', escolher)
    $('btn-foto2').addEventListener('click', escolher)
    async function salvarAvatar(valor) {
        const usuario = Auth.getUsuario()
        const resp = await Auth.authFetch(`${API_URL}/usuarios/${usuario.codUsuario}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar: valor })
        })
        const dados = await resp.json()
        if (!resp.ok) throw new Error(dados.message || 'Erro ao salvar foto')
        perfil.avatar = valor || null
        renderAvatar()
    }
    $('input-foto').addEventListener('change', async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
            await salvarAvatar(await redimensionar(file))
            alerta('sucesso', 'Foto atualizada')
        } catch (err) { alerta('erro', err.message || 'Não foi possível usar essa imagem') }
        e.target.value = ''
    })
    $('btn-remover-foto').addEventListener('click', async () => {
        try { await salvarAvatar(''); alerta('sucesso', 'Foto removida') } catch (err) { alerta('erro', err.message) }
    })

    $('form-perfil').addEventListener('submit', async (e) => {
        e.preventDefault()
        $('alerta-area').innerHTML = ''
        const usuario = Auth.getUsuario()
        const btn = $('btn-salvar')
        const payload = {
            nome: $('nome').value.trim(),
            email: $('email').value.trim(),
            cep: $('cep').value.replace(/\D/g, ''),
            numero: $('numero').value.trim()
        }
        const senha = $('senha').value
        if (senha) payload.senha = senha

        btn.disabled = true
        btn.textContent = 'Salvando...'
        try {
            const resp = await Auth.authFetch(`${API_URL}/usuarios/${usuario.codUsuario}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const dados = await resp.json()
            if (resp.ok) {
                usuario.nome = payload.nome
                localStorage.setItem('nm_usuario', JSON.stringify(usuario))
                $('senha').value = ''
                await carregarTudo()
                alerta('sucesso', dados.message || 'Dados atualizados')
            } else {
                alerta('erro', dados.message || 'Erro ao atualizar')
            }
        } catch (err) {
            console.error('Erro ao salvar perfil', err)
            alerta('erro', 'FALHA DE CONEXÃO :: não foi possível salvar')
        } finally {
            btn.disabled = false
            btn.textContent = 'Salvar Alterações'
        }
    })
})
