// ============================================================
// utils/print.js
// Geração e disparo de impressão de comandas/comprovantes.
//
// IMPORTANTE — leia antes de alterar:
// A impressora do estabelecimento (Balhuo City) é uma impressora
// térmica portátil que se conecta por Bluetooth clássico (SPP).
// O navegador NÃO tem acesso direto a esse tipo de conexão — a API
// Web Bluetooth só fala com dispositivos BLE (GATT), não com
// Bluetooth clássico/SPP, que é o que esse modelo usa.
//
// Por isso a impressão real acontece via window.print() do navegador,
// formatada para largura de papel térmico. Isso funciona de verdade
// quando o celular/computador tem um serviço de impressão instalado
// que enxerga a impressora pareada como uma impressora do sistema
// (ex: apps genéricos de "Bluetooth Print Service" no Android, comuns
// para esse tipo de impressora). Sem esse serviço instalado, o diálogo
// de impressão do navegador não vai listar a impressora térmica — isso
// depende de configuração do dispositivo, não do código do sistema.
//
// Este módulo NÃO inventa um driver nem finge que a impressão física
// aconteceu: ele gera o documento real e aciona o diálogo de impressão
// nativo do navegador, que é o mecanismo tecnicamente correto e
// disponível para todo navegador, com ou sem impressora térmica.
// ============================================================

import { formatarMoeda } from "./texto";

const CHAVE_SESSAO = "jullyburguer_impressos";

function lerRegistroImpressos() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || "{}");
  } catch {
    return {};
  }
}

/** Evita reimprimir automaticamente o mesmo documento (ex: re-render de snapshot). */
export function jaImprimiu(chave) {
  const registro = lerRegistroImpressos();
  return Boolean(registro[chave]);
}

export function marcarComoImpresso(chave) {
  const registro = lerRegistroImpressos();
  registro[chave] = Date.now();
  try {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(registro));
  } catch {
    // sessionStorage indisponível — segue sem persistir o controle
  }
}

function larguraEmPx(larguraPapel) {
  return larguraPapel === "80mm" ? 302 : 219; // ~58mm e ~80mm a 96dpi
}

function cabecalho(config) {
  return `
    <div class="linha-central negrito grande">${escapeHtml(
      config?.nomeEstabelecimento || "Jully Burguer"
    )}</div>
    ${config?.endereco ? `<div class="linha-central pequeno">${escapeHtml(config.endereco)}</div>` : ""}
    ${config?.telefone ? `<div class="linha-central pequeno">${escapeHtml(config.telefone)}</div>` : ""}
    <div class="separador"></div>
  `;
}

function linhasDeItens(itens) {
  return itens
    .map((item) => {
      const qtd = Number(item.qtd ?? item.quantidade ?? 0);
      const preco = Number(item.preco || 0);
      const subtotal = qtd * preco;
      return `
        <div class="linha-item">
          <span>${qtd}x ${escapeHtml(item.nome)}</span>
          <span>R$ ${formatarMoeda(subtotal)}</span>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Documento 1 — Comanda/Pedido (uso interno: cozinha/atendimento). */
export function gerarComandaHTML({ numeroPedido, mesa, cliente, itens, total, observacoes, config }) {
  const agora = new Date();
  return `
    ${cabecalho(config)}
    <div class="linha-central negrito grande">COMANDA</div>
    ${numeroPedido ? `<div class="linha-central">Pedido #${escapeHtml(numeroPedido)}</div>` : ""}
    <div class="linha-central negrito">MESA ${escapeHtml(mesa)}</div>
    ${cliente ? `<div class="linha-central">Cliente: ${escapeHtml(cliente)}</div>` : ""}
    <div class="separador"></div>
    ${linhasDeItens(itens)}
    <div class="separador"></div>
    <div class="linha-item negrito grande">
      <span>TOTAL</span>
      <span>R$ ${formatarMoeda(total)}</span>
    </div>
    ${observacoes ? `<div class="separador"></div><div class="pequeno">Obs: ${escapeHtml(observacoes)}</div>` : ""}
    <div class="separador"></div>
    <div class="linha-central pequeno">
      ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR")}
    </div>
  `;
}

/** Documento 2 — Comprovante de consumo (entregue ao cliente). */
export function gerarComprovanteHTML({ mesa, cliente, itens, total, formaPagamento, config }) {
  const agora = new Date();
  return `
    ${cabecalho(config)}
    <div class="linha-central negrito grande">COMPROVANTE DE CONSUMO</div>
    <div class="linha-central negrito">MESA ${escapeHtml(mesa)}</div>
    ${cliente ? `<div class="linha-central">Cliente: ${escapeHtml(cliente)}</div>` : ""}
    <div class="separador"></div>
    ${linhasDeItens(itens)}
    <div class="separador"></div>
    <div class="linha-item negrito grande">
      <span>TOTAL</span>
      <span>R$ ${formatarMoeda(total)}</span>
    </div>
    ${formaPagamento ? `<div class="linha-central">Pagamento: ${escapeHtml(formaPagamento)}</div>` : ""}
    <div class="separador"></div>
    <div class="linha-central pequeno">
      ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR")}
    </div>
    <div class="separador"></div>
    <div class="linha-central pequeno">
      ${escapeHtml(config?.mensagemRodape || "Obrigado pela preferência!")}
    </div>
    <div class="linha-central pequeno" style="margin-top:8px; opacity:.7;">
      Comprovante de consumo — não é documento fiscal.
    </div>
  `;
}

/**
 * Abre a janela de impressão do navegador com o conteúdo formatado
 * para impressora térmica. Retorna uma Promise que resolve quando o
 * diálogo de impressão foi acionado (não garante que a impressão
 * física foi concluída — isso depende do driver do dispositivo).
 */
export function imprimir(conteudoHTML, larguraPapel = "58mm") {
  return new Promise((resolve) => {
    const largura = larguraEmPx(larguraPapel);
    const janela = window.open("", "_blank", "width=380,height=600");

    if (!janela) {
      resolve(false);
      return;
    }

    janela.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Impressão</title>
          <style>
            @page { margin: 0; size: ${largura}px auto; }
            * { box-sizing: border-box; }
            body {
              width: ${largura}px;
              margin: 0 auto;
              padding: 10px 8px 24px;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              color: #000;
              background: #fff;
            }
            .linha-central { text-align: center; }
            .negrito { font-weight: 700; }
            .grande { font-size: 15px; }
            .pequeno { font-size: 10px; }
            .separador {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }
            .linha-item {
              display: flex;
              justify-content: space-between;
              gap: 8px;
              padding: 2px 0;
            }
          </style>
        </head>
        <body>
          ${conteudoHTML}
        </body>
      </html>
    `);

    janela.document.close();

    janela.onload = () => {
      janela.focus();
      janela.print();
      resolve(true);
    };

    // fallback caso onload não dispare em alguns navegadores mobile
    setTimeout(() => {
      try {
        janela.focus();
        janela.print();
        resolve(true);
      } catch {
        resolve(false);
      }
    }, 400);
  });
}
