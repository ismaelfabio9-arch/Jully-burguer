import { useState } from "react";
import { Link } from "react-router-dom";
import {
  suportaWebBluetooth,
  conectarImpressora,
  desconectarImpressora,
  listarServicosECaracteristicas,
  encontrarCaracteristicaGravavel,
  enviarTesteTexto,
} from "../../utils/bluetoothPrinter";
import "../../styles/Garcom/Config.css";
import "../../styles/Garcom/ConectarImpressoraBluetooth.css";

function ConectarImpressoraBluetooth() {
  const [status, setStatus] = useState("desconectado"); // desconectado | conectando | conectado | erro
  const [nomeDispositivo, setNomeDispositivo] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [servicos, setServicos] = useState([]);
  const [caracteristicaEncontrada, setCaracteristicaEncontrada] = useState(null);
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState("");

  async function handleConectar() {
    setMensagemErro("");
    setStatus("conectando");

    try {
      const dispositivo = await conectarImpressora();
      setNomeDispositivo(dispositivo.nome);

      const listaServicos = await listarServicosECaracteristicas();
      setServicos(listaServicos);

      const candidata = encontrarCaracteristicaGravavel(listaServicos);
      setCaracteristicaEncontrada(candidata);

      setStatus("conectado");
    } catch (erro) {
      console.error("Erro ao conectar impressora via Bluetooth:", erro);
      setMensagemErro(erro.message || "Não foi possível conectar.");
      setStatus("erro");
    }
  }

  function handleDesconectar() {
    desconectarImpressora();
    setStatus("desconectado");
    setNomeDispositivo("");
    setServicos([]);
    setCaracteristicaEncontrada(null);
    setResultadoTeste("");
  }

  async function handleTestarImpressao() {
    setTestando(true);
    setResultadoTeste("");

    try {
      await enviarTesteTexto(
        caracteristicaEncontrada.caracteristica,
        "TESTE JULLY BURGUER"
      );
      setResultadoTeste(
        "Comando enviado sem erro. Confira a impressora: se saiu algo (mesmo que estranho), me avise o que apareceu. Se não saiu nada, esse não é o protocolo certo."
      );
    } catch (erro) {
      console.error("Erro ao testar impressão via Bluetooth:", erro);
      setResultadoTeste(`Erro ao enviar: ${erro.message}`);
    }

    setTestando(false);
  }

  return (
    <div className="container">
      <Link to="/config/impressora" className="voltar">
        ← Voltar
      </Link>

      <div className="config-header">
        <div>
          <span>🔗 Bluetooth</span>
          <h1>Conectar impressora direto no sistema</h1>
          <p>Sem instalar nenhum app — conexão via navegador.</p>
        </div>
      </div>

      {!suportaWebBluetooth() && (
        <div className="bt-aviso bt-aviso-erro">
          Este navegador não suporta Web Bluetooth. Use o Chrome no Android,
          Windows ou Mac (não funciona no Safari/iPhone nem no Firefox).
        </div>
      )}

      <div className="bt-aviso">
        Isso conecta com a impressora
      </div>

      {status === "desconectado" && suportaWebBluetooth() && (
        <button className="btn-verde bt-btn-largo" onClick={handleConectar}>
          🔵 Conectar impressora
        </button>
      )}

      {status === "conectando" && (
        <button className="btn-verde bt-btn-largo" disabled>
          Conectando...
        </button>
      )}

      {status === "erro" && (
        <>
          <div className="bt-aviso bt-aviso-erro">{mensagemErro}</div>
          <button className="btn-verde bt-btn-largo" onClick={handleConectar}>
            Tentar novamente
          </button>
        </>
      )}

      {status === "conectado" && (
        <>
          <div className="pedido-card bt-status-card">
            <div>
              <strong>✅ Conectado</strong>
              <p>{nomeDispositivo}</p>
            </div>
            <button className="btn-cinza" onClick={handleDesconectar}>
              Desconectar
            </button>
          </div>

          {caracteristicaEncontrada ? (
            <div className="pedido-card">
              <h3>Canal de impressão encontrado</h3>
              <p className="bt-mono">
                Serviço: {caracteristicaEncontrada.servicoUuid}
                <br />
                Característica: {caracteristicaEncontrada.caracteristica.uuid}
              </p>

              <button
                className="btn-verde bt-btn-largo"
                onClick={handleTestarImpressao}
                disabled={testando}
              >
                {testando ? "Enviando..." : "🖨️ Testar impressão (experimental)"}
              </button>

              {resultadoTeste && (
                <p className="bt-resultado-teste">{resultadoTeste}</p>
              )}
            </div>
          ) : (
            <div className="bt-aviso bt-aviso-erro">
              Não encontrei nenhuma característica gravável fora dos serviços
              padrão do Bluetooth. Veja a lista completa abaixo — pode ser que
              o serviço de impressão real não esteja na nossa lista de
              candidatos. Me manda um print desta tela.
            </div>
          )}

          <div className="pedido-card">
            <h3>Tudo que foi encontrado</h3>
            <p className="categorias-dica">
              Isso é o diagnóstico completo. Se o teste acima não funcionar,
              essa lista é o que eu preciso ver para escrever o protocolo de
              impressão correto.
            </p>

            {servicos.map((servico) => (
              <div key={servico.servicoUuid} className="bt-servico-bloco">
                <p className="bt-mono bt-servico-titulo">
                  {servico.padraoBluetooth ? "⚙️ " : "🖨️ "}
                  {servico.servicoUuid}
                  {servico.padraoBluetooth ? " (serviço padrão)" : ""}
                </p>

                {servico.caracteristicas.map((c) => (
                  <p key={c.uuid} className="bt-mono bt-caracteristica">
                    &nbsp;&nbsp;↳ {c.uuid} —{" "}
                    {Object.entries(c.propriedades)
                      .filter(([, ativo]) => ativo)
                      .map(([nome]) => nome)
                      .join(", ") || "sem propriedades"}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ConectarImpressoraBluetooth;
