import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import "../../styles/Garcom/Pedidos.css";

function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [nomesMesas, setNomesMesas] = useState({});
  const [busca, setBusca] = useState("");

  function formatarMoeda(valor) {
    return Number(valor).toFixed(2).replace(".", ",");
  }

  function formatarHora(data) {
    if (!data) return "";

    return new Date(data).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function pesoStatus(status) {
    if (status === "aberta" || status === "aberto") return 1;
    if (status === "Em preparo") return 2;
    if (status === "Entregue") return 3;
    return 4;
  }

  function tituloPedido(pedido) {
    if (pedido.tipo !== "mesa") {
      return pedido.titulo || "Pedido Viagem";
    }

    const cliente = nomesMesas[String(pedido.mesa)];

    return `Mesa ${pedido.mesa}${cliente ? ` - ${cliente}` : ""}`;
  }

  function ordenarItensPorPreco(itens) {
    return [...(itens || [])].sort((a, b) => {
      const totalA =
        Number(a.preco || 0) * Number(a.qtd || a.quantidade || 0);

      const totalB =
        Number(b.preco || 0) * Number(b.qtd || b.quantidade || 0);

      if (totalA !== totalB) return totalA - totalB;

      return (a.nome || "").localeCompare(b.nome || "");
    });
  }

  useEffect(() => {
    const pedidosRef = collection(db, "pedidos");
    const consulta = query(pedidosRef, orderBy("salvoEm", "desc"));

    const cancelarMesas = onSnapshot(collection(db, "mesas"), (snapshot) => {
      const nomes = {};

      snapshot.docs.forEach((documento) => {
        nomes[documento.id] = documento.data().cliente || "";
      });

      setNomesMesas(nomes);
    });

    const cancelarInscricao = onSnapshot(consulta, (snapshot) => {
      const listaPedidos = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      listaPedidos.sort((a, b) => {
        const statusA = pesoStatus(a.status);
        const statusB = pesoStatus(b.status);

        if (statusA !== statusB) {
          return statusA - statusB;
        }

        return new Date(b.salvoEm || 0) - new Date(a.salvoEm || 0);
      });

      setPedidos(listaPedidos);
    });

    return () => {
      cancelarInscricao();
      cancelarMesas();
    };
  }, []);

  async function alterarStatus(id, novoStatus) {
    const pedidoRef = doc(db, "pedidos", id);

    await updateDoc(pedidoRef, {
      status: novoStatus,
    });
  }

  async function removerPedido(pedido) {
    const clienteMesa =
      pedido.tipo === "mesa" ? nomesMesas[String(pedido.mesa)] || "" : "";

    const vendaFinalizada = {
      origem: pedido.tipo || "viagem",
      mesa: pedido.mesa || null,
      cliente: clienteMesa,
      titulo: tituloPedido(pedido),
      itens: pedido.itens || [],
      total: pedido.total || 0,
      totalItens: pedido.totalItens || 0,
      finalizadoEm: new Date().toISOString(),
      criadoEm: serverTimestamp(),
    };

    await addDoc(collection(db, "vendasDia"), vendaFinalizada);

    await addDoc(collection(db, "historicoMesas"), {
      ...vendaFinalizada,
      pedidoOriginalId: pedido.id,
      status: "finalizada",
    });

    await deleteDoc(doc(db, "pedidos", pedido.id));

    // ✅ CORREÇÃO ALERTA 1: limpa nome do cliente na mesa após finalizar
    if (pedido.tipo === "mesa" && pedido.mesa) {
      await setDoc(
        doc(db, "mesas", String(pedido.mesa)),
        {
          numero: Number(pedido.mesa),
          cliente: "",
        },
        { merge: true }
      );
    }
  }

  function classeStatus(status) {
    if (status === "Em preparo") return "status-preparo";
    if (status === "Entregue") return "status-entregue";
    return "status-novo";
  }

  const pedidosFiltrados = pedidos.filter((pedido) => {
    const termo = busca.toLowerCase().trim();

    if (!termo) return true;

    const textoItens = (pedido.itens || [])
      .map((item) => item.nome)
      .join(" ")
      .toLowerCase();

    return (
      tituloPedido(pedido).toLowerCase().includes(termo) ||
      (pedido.tipo || "").toLowerCase().includes(termo) ||
      (pedido.status || "").toLowerCase().includes(termo) ||
      textoItens.includes(termo)
    );
  });

  return (
    <div className="container">
      <Link to="/" className="voltar">
        ← Voltar
      </Link>

      <div className="pedidos-header">
        <div>
          <span>Atendimento</span>
          <h1>Pedidos</h1>
          <p>Pedidos de mesas e viagem em andamento.</p>
        </div>
      </div>

      <input
        className="campo-busca"
        type="text"
        placeholder="Buscar por mesa, cliente, viagem, status ou item..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {pedidosFiltrados.length === 0 ? (
        <div className="card-principal">
          <h2>Nenhum pedido encontrado</h2>
          <p>Tente buscar por mesa, cliente, viagem, item ou status.</p>
        </div>
      ) : (
        <div className="lista-pedidos">
          {pedidosFiltrados.map((pedido) => (
            <div key={pedido.id} className="pedido-card">
              <div className="pedido-topo">
                <div>
                  <span className="pedido-tipo">
                    {pedido.tipo === "mesa" ? "Mesa" : "Viagem"}
                  </span>

                  <h3>{tituloPedido(pedido)}</h3>

                  <span>
                    {pedido.totalItens} itens • R$ {formatarMoeda(pedido.total)}
                  </span>

                  {pedido.salvoEm && (
                    <small className="pedido-horario">
                      Criado às {formatarHora(pedido.salvoEm)}
                    </small>
                  )}
                </div>

                <strong className={classeStatus(pedido.status)}>
                  {pedido.status}
                </strong>
              </div>

              <div className="pedido-itens">
                {ordenarItensPorPreco(pedido.itens).map((item) => (
                  <div className="pedido-item-linha" key={item.nome}>
                    <span>
                      {Number(item.qtd || item.quantidade || 0)}x {item.nome}
                    </span>

                    <strong>
                      R${" "}
                      {formatarMoeda(
                        Number(item.preco || 0) * Number(item.qtd || item.quantidade || 0)
                      )}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="pedido-total">
                <span>Total</span>
                <strong>R$ {formatarMoeda(pedido.total)}</strong>
              </div>

              <div className="pedido-acoes">
                <button
                  className="btn-verde"
                  onClick={() => alterarStatus(pedido.id, "Em preparo")}
                >
                  Em preparo
                </button>

                <button
                  className="btn-cinza"
                  onClick={() => alterarStatus(pedido.id, "Entregue")}
                >
                  Entregue
                </button>

                <button
                  className="btn-remover"
                  onClick={() => removerPedido(pedido)}
                >
                  Finalizar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="menu-inferior">
        <Link to="/" style={{ textDecoration: "none" }}>
          ▦
          <span>Painel</span>
        </Link>

        <Link to="/pedidos" className="ativo" style={{ textDecoration: "none" }}>
          ▤
          <span>Pedidos</span>
        </Link>

        <Link to="/mesas" style={{ textDecoration: "none" }}>
          ▥
          <span>Mesas</span>
        </Link>

        <Link to="/config" style={{ textDecoration: "none" }}>
          ⚙
          <span>Config.</span>
        </Link>
      </div>
    </div>
  );
}

export default Pedidos;