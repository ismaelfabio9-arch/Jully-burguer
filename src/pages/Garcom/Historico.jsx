import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase";
import "../../styles/Garcom/Historico.css";

function Historico() {
  const [historico, setHistorico] = useState([]);
  const [fechamentoAberto, setFechamentoAberto] = useState(null);

  function formatarMoeda(valor) {
    return Number(valor).toFixed(2).replace(".", ",");
  }

  useEffect(() => {
    const historicoRef = query(
      collection(db, "historicoDias"),
      orderBy("criadoEm", "desc")
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

  async function limparHistorico() {
    for (const dia of historico) {
      await deleteDoc(doc(db, "historicoDias", dia.id));
    }

    setFechamentoAberto(null);
  }

  function montarRelatorio(dia) {
    const vendas = dia.vendasDia || [];
    const produtos = {};
    let totalItens = 0;

    vendas.forEach((venda) => {
      (venda.itens || []).forEach((item) => {
        const quantidade = Number(item.qtd || item.quantidade || 0);
totalItens += quantidade;

        if (!produtos[item.nome]) {
          produtos[item.nome] = {
            nome: item.nome,
            qtd: 0,
            total: 0,
          };
        }

        produtos[item.nome].qtd += quantidade;
produtos[item.nome].total += Number(item.preco || 0) * quantidade;
      });
    });

    return {
      totalItens,
      produtos: Object.values(produtos).sort((a, b) => b.qtd - a.qtd),
    };
  }

  return (
    <div className="container">
      <Link to="/config" className="voltar">
        ← Voltar
      </Link>

      <div className="pedidos-header">
        <div>
          <span>Fechamentos</span>
          <h1>Histórico</h1>
          <p>Resumo dos dias encerrados.</p>
        </div>
      </div>

      {historico.length > 0 && (
        <button
          className="btn-remover"
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            marginBottom: "15px",
          }}
          onClick={limparHistorico}
        >
          Limpar histórico
        </button>
      )}

      {historico.length === 0 ? (
        <div className="card-principal">
          <h2>Nenhum fechamento</h2>
          <p>Quando encerrar o dia, o relatório aparecerá aqui.</p>
        </div>
      ) : (
        <div className="lista-pedidos">
          {historico.map((dia) => {
            const relatorio = montarRelatorio(dia);
            const aberto = fechamentoAberto === dia.id;

            return (
              <div key={dia.id} className="pedido-card">
                <div
                  className="pedido-topo"
                  onClick={() =>
                    setFechamentoAberto(aberto ? null : dia.id)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <div>
                    <span className="pedido-tipo">Fechamento</span>
                    <h3>{dia.data}</h3>
                    <span>Encerrado às {dia.horario}</span>
                  </div>

                  <strong className="status-entregue">
                    R$ {formatarMoeda(dia.totalVendido)}
                  </strong>
                </div>

                <div className="pedido-total">
                  <span>Total de pedidos</span>
                  <strong>{dia.totalPedidos || 0}</strong>
                </div>

                <div className="pedido-total">
                  <span>Total de itens</span>
                  <strong>{dia.totalItens || relatorio.totalItens}</strong>
                </div>

                <div className="pedido-total">
                  <span>Total vendido</span>
                  <strong>R$ {formatarMoeda(dia.totalVendido)}</strong>
                </div>

                {aberto && (
                  <div className="pedido-itens" style={{ marginTop: "14px" }}>
                    <strong>Produtos vendidos</strong>

                    {relatorio.produtos.length === 0 ? (
                      <p>Nenhum produto registrado.</p>
                    ) : (
                      relatorio.produtos.map((produto) => (
                        <div key={produto.nome} className="pedido-total">
                          <span>
                            {produto.qtd}x {produto.nome}
                          </span>

                          <strong>
                            R$ {formatarMoeda(produto.total)}
                          </strong>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Historico;