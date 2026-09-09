import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import "../../styles/Garcom/MesaDetalhe.css";

function Viagem() {
  const [produtos, setProdutos] = useState([]);
  const [categoriaAberta, setCategoriaAberta] = useState("");
  const [pedido, setPedido] = useState({});
  const [notificacao, setNotificacao] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [nomeClienteInput, setNomeClienteInput] = useState("");
  const [editandoNomeCliente, setEditandoNomeCliente] = useState(false);

  useEffect(() => {
    const cancelar = onSnapshot(collection(db, "produtos"), (snapshot) => {
      const listaProdutos = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      const produtosAtivos = listaProdutos.filter(
        (produto) => produto.ativo !== false
      );

      const grupos = produtosAtivos.reduce((resultado, produto) => {
        if (!resultado[produto.categoria]) {
          resultado[produto.categoria] = {
            categoria: produto.categoria,
            itens: [],
          };
        }

        resultado[produto.categoria].itens.push({
          id: produto.id,
          nome: produto.nome,
          preco: Number(produto.preco || 0),
        });

        return resultado;
      }, {});

      const listaCategorias = Object.values(grupos);

      listaCategorias.forEach((categoria) => {
        categoria.itens.sort((a, b) => {
          if (a.preco !== b.preco) {
            return a.preco - b.preco;
          }

          return a.nome.localeCompare(b.nome);
        });
      });

      setProdutos(listaCategorias);
    });

    return () => cancelar();
  }, []);

  function alternarCategoria(nomeCategoria) {
    setCategoriaAberta(categoriaAberta === nomeCategoria ? "" : nomeCategoria);
  }

  function adicionarItem(item) {
    setPedido((pedidoAtual) => {
      const itemAtual = pedidoAtual[item.nome];

      return {
        ...pedidoAtual,
        [item.nome]: {
          produtoId: item.id,
          nome: item.nome,
          preco: item.preco,
          qtd: itemAtual ? itemAtual.qtd + 1 : 1,
        },
      };
    });
  }

  function removerItem(item) {
    setPedido((pedidoAtual) => {
      const itemAtual = pedidoAtual[item.nome];

      if (!itemAtual) return pedidoAtual;

      if (itemAtual.qtd === 1) {
        const novoPedido = { ...pedidoAtual };
        delete novoPedido[item.nome];
        return novoPedido;
      }

      return {
        ...pedidoAtual,
        [item.nome]: {
          ...itemAtual,
          qtd: itemAtual.qtd - 1,
        },
      };
    });
  }

  function limparPedido() {
    setPedido({});
    setNomeCliente("");
    setNomeClienteInput("");
  }

  function salvarNomeCliente() {
    setNomeCliente(nomeClienteInput.trim());
    setEditandoNomeCliente(false);
  }

  function mostrarNotificacao(texto) {
    setNotificacao(texto);

    setTimeout(() => {
      setNotificacao("");
    }, 2500);
  }

  const itensPedido = Object.values(pedido).sort((a, b) => {
    if (a.preco !== b.preco) {
      return a.preco - b.preco;
    }

    return a.nome.localeCompare(b.nome);
  });

  const total = itensPedido.reduce((soma, item) => {
    return soma + item.preco * item.qtd;
  }, 0);

  const totalItens = itensPedido.reduce((soma, item) => {
    return soma + item.qtd;
  }, 0);

  function formatarMoeda(valor) {
    return Number(valor).toFixed(2).replace(".", ",");
  }

  // ✅ CORREÇÃO BUG 2: função de baixar estoque adicionada
  async function baixarEstoque(itens) {
    for (const item of itens) {
      if (!item.produtoId) continue;

      const estoqueRef = doc(db, "estoque", item.produtoId);
      const estoqueSnap = await getDoc(estoqueRef);

      if (!estoqueSnap.exists()) continue;

      const quantidadeAtual = Number(estoqueSnap.data().quantidade || 0);
      const quantidadePedida = Number(item.qtd || 0);
      const novaQuantidade = Math.max(0, quantidadeAtual - quantidadePedida);

      await setDoc(
        estoqueRef,
        {
          quantidade: novaQuantidade,
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );

      if (novaQuantidade === 0 && quantidadeAtual > 0) {
        await addDoc(collection(db, "notificacoes"), {
          tipo: "estoque",
          mensagem: `${item.nome} acabou no estoque`,
          produtoId: item.produtoId,
          produto: item.nome,
          lida: false,
          horario: new Date().toISOString(),
          criadoEm: serverTimestamp(),
        });
      }
    }
  }

  async function salvarPedidoViagem() {
    if (itensPedido.length === 0) {
      mostrarNotificacao("Adicione pelo menos 1 item antes de salvar.");
      return;
    }

    const idPedido = Date.now();

    const tituloViagem = nomeCliente
      ? `Pedido Viagem - ${nomeCliente}`
      : "Pedido Viagem";

    const dadosPedido = {
      idLocal: idPedido,
      tipo: "viagem",
      cliente: nomeCliente,
      titulo: tituloViagem,
      itens: itensPedido,
      total,
      totalItens,
      status: "aberto",
      salvoEm: new Date().toISOString(),
      criadoEm: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "pedidos"), dadosPedido);

      // ✅ CORREÇÃO BUG 2: baixa estoque após salvar pedido viagem
      await baixarEstoque(itensPedido);

      await addDoc(collection(db, "notificacoes"), {
        tipo: "pedido",
        mensagem: nomeCliente
          ? `Novo pedido viagem - ${nomeCliente}`
          : "Novo pedido viagem",
        total,
        totalItens,
        horario: new Date().toISOString(),
        criadoEm: serverTimestamp(),
      });

      setPedido({});
      setNomeCliente("");
      setNomeClienteInput("");
      mostrarNotificacao("Pedido viagem salvo com sucesso!");
    } catch (erro) {
      console.error("Erro ao salvar pedido viagem:", erro);
      mostrarNotificacao("Erro ao salvar no Firebase.");
    }
  }

  return (
    <div className="mesa-page">
      {notificacao && <div className="toast">✅ {notificacao}</div>}

      {editandoNomeCliente && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">✏️</div>

            <h2>Nome do cliente</h2>

            <p>Identifique o pedido viagem.</p>

            <input
              className="input-cliente-mesa"
              type="text"
              placeholder="Ex: Allan"
              value={nomeClienteInput}
              onChange={(e) => setNomeClienteInput(e.target.value)}
              autoFocus
            />

            <div className="modal-acoes">
              <button
                type="button"
                className="modal-btn cancelar"
                onClick={() => {
                  setEditandoNomeCliente(false);
                  setNomeClienteInput(nomeCliente);
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="modal-btn confirmar"
                onClick={salvarNomeCliente}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <Link className="voltar" to="/">
        ← Voltar
      </Link>

      <div className="mesa-topo">
        <div>
          <span>Pedido</span>

          <div className="mesa-titulo-cliente">
            <h1>
              Viagem
              {nomeCliente ? ` - ${nomeCliente}` : ""}
            </h1>

            <button onClick={() => setEditandoNomeCliente(true)}>✏️</button>
          </div>
        </div>

        <div className="mesa-total">
          <span>Total atual</span>
          <strong>R$ {formatarMoeda(total)}</strong>
        </div>
      </div>

      <div className="acoes-mesa">
        <button className="btn-verde" onClick={salvarPedidoViagem}>
          Salvar pedido viagem
        </button>

        <button className="btn-cinza" onClick={limparPedido}>
          Limpar pedido
        </button>
      </div>

      {itensPedido.length > 0 && (
        <div className="resumo-pedido">
          <h3>Pedido atual</h3>

          {itensPedido.map((item) => (
            <div className="resumo-linha resumo-linha-editavel" key={item.nome}>
              <span>
                {item.qtd}x {item.nome}
              </span>

              <strong>R$ {formatarMoeda(item.preco * item.qtd)}</strong>

              <div className="contador resumo-contador">
                <button onClick={() => removerItem(item)}>-</button>
                <span>{item.qtd}</span>
                <button onClick={() => adicionarItem(item)}>+</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="titulo-secao">Adicionar pedido</h2>

      {produtos.length === 0 ? (
        <div className="card-principal">
          <h2>Nenhum produto cadastrado</h2>
          <p>Importe o cardápio na tela Produtos.</p>
        </div>
      ) : (
        produtos.map((categoria) => (
          <section className="categoria-bloco" key={categoria.categoria}>
            <div
              className="categoria-header"
              onClick={() => alternarCategoria(categoria.categoria)}
            >
              <h3>{categoria.categoria}</h3>
              <span>{categoriaAberta === categoria.categoria ? "▲" : "▼"}</span>
            </div>

            {categoriaAberta === categoria.categoria && (
              <div className="produtos-grid">
                {categoria.itens.map((item) => {
                  const quantidade = pedido[item.nome]?.qtd || 0;

                  return (
                    <div className="produto-card" key={item.id}>
                      <div className="produto-info">
                        <strong>{item.nome}</strong>
                        <span>R$ {formatarMoeda(item.preco)}</span>
                      </div>

                      <div className="contador">
                        <button onClick={() => removerItem(item)}>-</button>
                        <span>{quantidade}</span>
                        <button onClick={() => adicionarItem(item)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))
      )}

      {totalItens > 0 && (
        <div className="barra-pedido">
          <div>
            <strong>{totalItens} itens</strong>
            <span>R$ {formatarMoeda(total)}</span>
          </div>

          <button onClick={salvarPedidoViagem}>Salvar Pedido</button>
        </div>
      )}
    </div>
  );
}

export default Viagem;