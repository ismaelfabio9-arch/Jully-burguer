import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import {
  CONFIG_IMPRESSORA_PADRAO,
} from "../../hooks/useConfigImpressora";
import { gerarComandaHTML, imprimir } from "../../utils/print";
import "../../styles/Garcom/Config.css";
import "../../styles/Garcom/ConfiguracaoImpressora.css";

function ConfiguracaoImpressora() {
  const [config, setConfig] = useState(CONFIG_IMPRESSORA_PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    const cancelar = onSnapshot(doc(db, "configuracoes", "impressora"), (snap) => {
      if (snap.exists()) {
        setConfig({ ...CONFIG_IMPRESSORA_PADRAO, ...snap.data() });
      }
    });

    return () => cancelar();
  }, []);

  function mostrarMensagem(texto) {
    setMensagem(texto);
    setTimeout(() => setMensagem(""), 2500);
  }

  function atualizarCampo(campo, valor) {
    setConfig((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    setSalvando(true);
    try {
      await setDoc(
        doc(db, "configuracoes", "impressora"),
        {
          ...config,
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );
      mostrarMensagem("Configurações salvas!");
    } catch (erro) {
      console.error("Erro ao salvar configuração da impressora:", erro);
      mostrarMensagem("Erro ao salvar.");
    }
    setSalvando(false);
  }

  async function imprimirTeste() {
    const html = gerarComandaHTML({
      numeroPedido: "TESTE",
      mesa: "1",
      cliente: "",
      itens: [
        { nome: "X-Bacon", qtd: 2, preco: 25.9 },
        { nome: "Coca-Cola", qtd: 1, preco: 6 },
      ],
      total: 22,
      observacoes: "Impressão de teste do sistema.",
      config,
    });

    await imprimir(html, config.larguraPapel);
  }

  return (
    <div className="container">
      {mensagem && <div className="toast">{mensagem}</div>}

      <Link to="/config" className="voltar">
        ← Voltar
      </Link>

      <div className="config-header">
        <div>
          <span>🖨️ Impressora</span>
          <h1>Configuração de impressão</h1>
          <p>Ajuste como comandas e comprovantes são impressos.</p>
        </div>
      </div>

      <Link to="/config/impressora/bluetooth" style={{ textDecoration: "none" }}>
        <div className="config-card">
          <div className="config-icon">🔗</div>
          <div>
            <h2>Conectar via Bluetooth</h2>
            <strong>Abrir conexão Bluetooth</strong>
          </div>
        </div>
      </Link>

      <div className="config-card impressora-card">
        <div className="config-icon">🔌</div>
        <div style={{ flex: 1 }}>
          <h2>Impressão habilitada</h2>
          <p>Liga ou desliga toda a função de impressão no sistema.</p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={config.habilitada}
            onChange={(e) => atualizarCampo("habilitada", e.target.checked)}
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="config-card impressora-card">
        <div className="config-icon">🧾</div>
        <div style={{ flex: 1 }}>
          <h2>Imprimir comanda automaticamente</h2>
          <p>Ao salvar um pedido na mesa, imprime a comanda sem precisar tocar em nada.</p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={config.autoImprimirPedido}
            disabled={!config.habilitada}
            onChange={(e) => atualizarCampo("autoImprimirPedido", e.target.checked)}
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="config-card impressora-card">
        <div className="config-icon">💳</div>
        <div style={{ flex: 1 }}>
          <h2>Sugerir comprovante ao encerrar</h2>
          <p>Deixa a opção "Emitir comprovante" pré-selecionada ao fechar a mesa.</p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={config.autoImprimirComprovante}
            disabled={!config.habilitada}
            onChange={(e) =>
              atualizarCampo("autoImprimirComprovante", e.target.checked)
            }
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="pedido-card impressora-form">
        <h3 style={{ marginBottom: "12px" }}>Papel e dados do estabelecimento</h3>

        <label className="impressora-campo">
          <span>Largura do papel</span>
          <select
            value={config.larguraPapel}
            onChange={(e) => atualizarCampo("larguraPapel", e.target.value)}
          >
            <option value="58mm">58mm</option>
            <option value="80mm">80mm</option>
          </select>
        </label>

        <label className="impressora-campo">
          <span>Nome do estabelecimento</span>
          <input
            value={config.nomeEstabelecimento}
            onChange={(e) => atualizarCampo("nomeEstabelecimento", e.target.value)}
          />
        </label>

        <label className="impressora-campo">
          <span>Endereço</span>
          <input
            value={config.endereco}
            onChange={(e) => atualizarCampo("endereco", e.target.value)}
            placeholder="Opcional"
          />
        </label>

        <label className="impressora-campo">
          <span>Telefone</span>
          <input
            value={config.telefone}
            onChange={(e) => atualizarCampo("telefone", e.target.value)}
            placeholder="Opcional"
          />
        </label>

        <label className="impressora-campo">
          <span>Mensagem de rodapé (comprovante)</span>
          <input
            value={config.mensagemRodape}
            onChange={(e) => atualizarCampo("mensagemRodape", e.target.value)}
          />
        </label>
      </div>

      <div className="impressora-acoes">
        <button className="btn-cinza" onClick={imprimirTeste} disabled={!config.habilitada}>
          🖨️ Testar impressão
        </button>

        <button className="btn-verde" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>

      <div className="menu-inferior">
        <Link to="/" style={{ textDecoration: "none" }}>
          ▦
          <span>Painel</span>
        </Link>

        <Link to="/pedidos" style={{ textDecoration: "none" }}>
          ▤
          <span>Pedidos</span>
        </Link>

        <Link to="/mesas" style={{ textDecoration: "none" }}>
          ▥
          <span>Mesas</span>
        </Link>

        <Link to="/config" className="ativo" style={{ textDecoration: "none" }}>
          ⚙
          <span>Config.</span>
        </Link>
      </div>
    </div>
  );
}

export default ConfiguracaoImpressora;
