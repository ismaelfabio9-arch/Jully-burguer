import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import "../../styles/Garcom/Pedidos.css";

function HistoricoMesas() {
  const [historico, setHistorico] = useState([]);
  const [mensagem, setMensagem] = useState("");

  function formatarMoeda(valor) {
    return Number(valor).toFixed(2).replace(".", ",");
  }

  function formatarData(data) {
    if (!data) return "";

    return new Date(data).toLocaleString("pt-BR");
  }

  function mostrarMensagem(texto) {
    setMensagem(texto);

    setTimeout(() => {
      setMensagem("");
    }, 2500);
  }

  useEffect(() => {
    const historicoRef = query(
      collection(db, "historicoMesas"),
      orderBy("finalizadoEm", "desc")
    );

    const cancelar = onSnapshot(historicoRef, (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      setHistorico(lista);
    });

    return () => cancelar();
  }, []);

  async function restaurarMesa(mesa) {
    try {
      await addDoc(collection(db, "pedidos"), {
        tipo: mesa.origem || "mesa",
        mesa: mesa.mesa || null,
        titulo: mesa.titulo || `Mesa ${mesa.mesa}`,
        itens: mesa.itens || [],
        total: mesa.total || 0,
        totalItens: mesa.totalItens || 0,
        status: "aberto",
        salvoEm: new Date().toISOString(),
        restauradoEm: new Date().toISOString(),
        criadoEm: serverTimestamp(),
      });

      await deleteDoc(doc(db, "historicoMesas", mesa.id));

      mostrarMensagem("Mesa restaurada com sucesso!");
    } catch (erro) {
      console.error("Erro ao restaurar mesa:", erro);
      mostrarMensagem("Erro ao restaurar mesa.");
    }
  }

  return (
    <div className="container">
      {mensagem && <div className="toast">{mensagem}</div>}

      <Link to="/config" className="voltar">
        ← Voltar
      </Link>

      <div className="pedidos-header">
        <div>
          <span>Mesas finalizadas</span>
          <h1>Histórico de Mesas</h1>
          <p>Consulte mesas finalizadas e pedidos encerrados.</p>
        </div>
      </div>

      {historico.length === 0 ? (
        <div className="card-principal">
          <h2>Nenhuma mesa finalizada</h2>
          <p>Quando finalizar uma mesa, ela aparecerá aqui.</p>
        </div>
      ) : (
        <div className="lista-pedidos">
          {historico.map((mesa) => (
            <div key={mesa.id} className="pedido-card">
              <div className="pedido-topo">
                <div>
                  <span className="pedido-tipo">
                    {mesa.origem === "mesa" ? `Mesa ${mesa.mesa}` : "Viagem"}
                  </span>

                  <h3>{mesa.titulo}</h3>

                  <span>{formatarData(mesa.finalizadoEm)}</span>
                </div>

                <strong className="status-entregue">
                  R$ {formatarMoeda(mesa.total)}
                </strong>
              </div>

              <div className="pedido-itens">
                {(mesa.itens || []).map((item) => (
                  <p key={item.nome}>
                    {item.qtd}x {item.nome}
                  </p>
                ))}
              </div>

              <div className="pedido-total">
                <span>Total de itens</span>
                <strong>{mesa.totalItens || 0}</strong>
              </div>

              <div className="pedido-total">
                <span>Total da mesa</span>
                <strong>R$ {formatarMoeda(mesa.total)}</strong>
              </div>

              {mesa.origem === "mesa" && (
                <button
                  className="btn-verde"
                  style={{
                    width: "100%",
                    marginTop: "12px",
                  }}
                  onClick={() => restaurarMesa(mesa)}
                >
                  Restaurar mesa
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoricoMesas;