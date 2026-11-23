// Troque pela URL do backend publicado no Railway antes do deploy no Vercel.
// Exemplo: const API_URL = 'https://backend-pecas-production.up.railway.app'
const API_URL = 'http://localhost:3000'

// Resolve caminhos de imagem ('/img/produtos/x.jpg') a partir da pasta frontend/,
// funcionando com Live Server, file:// ou páginas dentro de html/.
const FRONTEND_BASE = (document.currentScript && document.currentScript.src)
    ? document.currentScript.src.replace(/js\/config\.js(\?.*)?$/, '')
    : './'
function resolverImagem(caminho) {
    if (!caminho) return ''
    const chave = '/' + caminho.replace(/^\.?\//, '').replace(/^frontend\//, '')
    if (window.IMAGENS_PRODUTOS && window.IMAGENS_PRODUTOS[chave]) return window.IMAGENS_PRODUTOS[chave]
    if (/^(https?:|data:|blob:)/i.test(caminho)) return caminho
    return FRONTEND_BASE + caminho.replace(/^\.?\//, '').replace(/^frontend\//, '')
}
