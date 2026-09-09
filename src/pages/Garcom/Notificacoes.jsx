import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";
import "../../styles/Garcom/Notificacoes.css";

function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const navigate = useNavigate();

  function formatarData(data) {
    if (!data) return "";

    return new Date(data).toLocaleString("pt-BR");
  }

  useEffect(() => {
    const notificacoesRef = query(
      collection(db, "notificacoes"),
      orderBy("horario", "desc")
    );

    const cancelar = onSnapshot(notificacoesRef, (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      setNotificacoes(lista);
    });

    return () => cancelar();
  }, []);

  async function limparTudo() {
    const snapshot = await getDocs(collection(db, "notificacoes"));

    for (const documento of snapshot.docs) {
      await deleteDoc(doc(db, "notificacoes", documento.id));
    }

    setModalAberto(false);
  }

  function abrirNotificacao(notificacao) {
  if (notificacao.tipo === "estoque") {
    navigate("/estoque");
    return;
  }

  if (notificacao.mesa) {
    navigate(`/mesa/${notificacao.mesa}`);
    return;
  }

  if (notificacao.tipo === "pedido") {
    navigate("/pedidos");
    return;
  }

  navigate("/");
}

  function iconeNotificacao(tipo) {
  if (tipo === "pedido") return "🍢";
  if (tipo === "garcom") return "🛎️";
  if (tipo === "pagamento") return "💳";
  if (tipo === "estoque") return "📦";
  return "🔔";
}

  return (
    <div className="container">
      <Link to="/" className="voltar">
        ← Voltar
      </Link>

      <div className="pedidos-header">
        <div>
          <span>Central</span>
          <h1>Notificações</h1>
          <p>Todas as notificações do sistema.</p>
        </div>
      </div>

      {notificacoes.length > 0 && (
        <button
          className="btn-remover"
          style={{
            width: "100%",
            marginBottom: "15px",
            padding: "14px",
            borderRadius: "14px",
            border: "none",
          }}
          onClick={() => setModalAberto(true)}
        >
          Limpar todas
        </button>
      )}

      {notificacoes.length === 0 ? (
        <div className="card-principal">
          <h2>Nenhuma notificação</h2>
          <p>Aguardando eventos do sistema.</p>
        </div>
      ) : (
        <div className="notificacoes">
          {notificacoes.map((notificacao) => (
            <button
              key={notificacao.id}
              className="notificacao-card notificacao-clicavel"
              onClick={() => abrirNotificacao(notificacao)}
              type="button"
            >
              <div className="icone-azul">
                {iconeNotificacao(notificacao.tipo)}
              </div>

              <div>
                <strong translate="no">{notificacao.mensagem}</strong>

                <p>{formatarData(notificacao.horario)}</p>

                {notificacao.total > 0 && (
                  <p>
                    {notificacao.totalItens} itens • R${" "}
                    {Number(notificacao.total).toFixed(2).replace(".", ",")}
                  </p>
                )}

                {notificacao.formaPagamento && (
                  <p translate="no">Forma: {notificacao.formaPagamento}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {modalAberto && (
        <div className="modal-fundo">
          <div className="modal-card">
            <h2>Apagar notificações?</h2>
            <p>Essa ação vai remover todas as notificações do sistema.</p>

            <div className="modal-botoes">
              <button
                className="btn-cancelar"
                onClick={() => setModalAberto(false)}
              >
                Cancelar
              </button>

              <button className="btn-remover" onClick={limparTudo}>
                Apagar tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notificacoes;