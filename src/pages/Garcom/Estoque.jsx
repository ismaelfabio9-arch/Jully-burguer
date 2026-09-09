import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { ordenarItensCategoria } from "../../utils/produtosOrdem";
import "../../styles/Garcom/Estoque.css";

function Estoque() {
  const [produtos, setProdutos] = useState([]);
  const [estoque, setEstoque] = useState({});
  const [categoriaAberta, setCategoriaAberta] = useState("");
  const [quantidades, setQuantidades] = useState({});
  const [minimos, setMinimos] = useState({});

  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState(null);

  const [novoNome, setNovoNome] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [novaQuantidade, setNovaQuantidade] = useState("");
  const [novoMinimo, setNovoMinimo] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");

  const [editandoNomeId, setEditandoNomeId] = useState(null);
  const [novoNomeEstoque, setNovoNomeEstoque] = useState("");
  const [erroNomeEstoque, setErroNomeEstoque] = useState("");

  useEffect(() => {
    const cancelarProdutos = onSnapshot(collection(db, "produtos"), (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      setProdutos(lista.filter((produto) => produto.ativo !== false));
    });

    const cancelarEstoque = onSnapshot(collection(db, "estoque"), (snapshot) => {
      const dados = {};

      snapshot.docs.forEach((documento) => {
        dados[documento.id] = documento.data();
      });

      setEstoque(dados);
    });

    return () => {
      cancelarProdutos();
      cancelarEstoque();
    };
  }, []);

  function formatarMoeda(valor) {
    return Number(valor || 0).toFixed(2).replace(".", ",");
  }

  function criarIdProduto(texto) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function emojiCategoria(categoria) {
    if (categoria.includes("Hambúrgueres") || categoria.includes("Hamburgueres")) return "🍔";
    if (categoria.includes("Combos")) return "🍟";
    if (categoria.includes("Acompanhamentos")) return "🍟";
    if (categoria.includes("Bebidas") || categoria.includes("Refrigerantes")) return "🥤";
    if (categoria.includes("Sobremesas")) return "🍨";
    if (categoria.includes("Adicionais")) return "➕";
    if (categoria.includes("Cervejas")) return "🍺";
    return "📦";
  }

async function salvarEstoque(produto) {
  const quantidadeDigitada = quantidades[produto.id];
  const minimoDigitado = minimos[produto.id];

  const quantidadeAtual = Number(estoque[produto.id]?.quantidade || 0);
  const minimoAtual = Number(estoque[produto.id]?.minimo || 0);

  const quantidade =
    quantidadeDigitada === "" || quantidadeDigitada === undefined
      ? quantidadeAtual
      : Number(quantidadeDigitada);

  const minimo =
    minimoDigitado === "" || minimoDigitado === undefined
      ? minimoAtual
      : Number(minimoDigitado);

  await setDoc(
    doc(db, "estoque", produto.id),
    {
      produtoId: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      preco: Number(produto.preco || 0),
      quantidade,
      minimo,
      atualizadoEm: new Date().toISOString(),
      criadoEm: serverTimestamp(),
    },
    { merge: true }
  );

  setQuantidades((atual) => ({ ...atual, [produto.id]: "" }));
  setMinimos((atual) => ({ ...atual, [produto.id]: "" }));
}

  async function zerarEstoqueProduto(produto) {
    await setDoc(
      doc(db, "estoque", produto.id),
      {
        produtoId: produto.id,
        nome: produto.nome,
        categoria: produto.categoria,
        preco: Number(produto.preco || 0),
        quantidade: 0,
        minimo: Number(estoque[produto.id]?.minimo || 0),
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  async function confirmarExcluirProduto() {
    if (!produtoParaExcluir) return;

    await deleteDoc(doc(db, "estoque", produtoParaExcluir.id));

    await setDoc(
      doc(db, "produtos", produtoParaExcluir.id),
      {
        ativo: false,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    setProdutoParaExcluir(null);
  }

  async function salvarNomeProdutoEstoque(produto) {
    const nomeTratado = novoNomeEstoque.trim();

    if (!nomeTratado) {
      setErroNomeEstoque("O nome não pode ficar em branco.");
      return;
    }

    const nomeJaExiste = produtos.some(
      (item) =>
        item.id !== produto.id &&
        item.categoria === produto.categoria &&
        item.nome.trim().toLowerCase() === nomeTratado.toLowerCase()
    );

    if (nomeJaExiste) {
      setErroNomeEstoque("Já existe um produto com esse nome nessa categoria.");
      return;
    }

    try {
      const batch = writeBatch(db);

      batch.set(
        doc(db, "produtos", produto.id),
        { nome: nomeTratado, atualizadoEm: new Date().toISOString() },
        { merge: true }
      );

      batch.set(
        doc(db, "estoque", produto.id),
        { nome: nomeTratado, atualizadoEm: new Date().toISOString() },
        { merge: true }
      );

      await batch.commit();

      setEditandoNomeId(null);
      setNovoNomeEstoque("");
      setErroNomeEstoque("");
    } catch (erro) {
      console.error("Erro ao renomear produto:", erro);
      setErroNomeEstoque("Erro ao renomear. Tente novamente.");
    }
  }

  async function ajustarQuantidade(produto, valor) {
    const atual = Number(estoque[produto.id]?.quantidade || 0);
    const novaQuantidadeCalculada = Math.max(0, atual + valor);

    await setDoc(
      doc(db, "estoque", produto.id),
      {
        produtoId: produto.id,
        nome: produto.nome,
        categoria: produto.categoria,
        preco: Number(produto.preco || 0),
        quantidade: novaQuantidadeCalculada,
        minimo: Number(estoque[produto.id]?.minimo || 0),
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  async function adicionarProduto() {
    if (!novoNome.trim() || !novaCategoria.trim() || !novoPreco) {
      setMensagemErro("Preencha nome, categoria e preço.");
      return;
    }

    const nomeTratado = novoNome.trim();
    const categoriaTratada = novaCategoria.trim();
    const produtoId = criarIdProduto(`${categoriaTratada}-${nomeTratado}`);

    await setDoc(
      doc(db, "produtos", produtoId),
      {
        nome: nomeTratado,
        categoria: categoriaTratada,
        preco: Number(novoPreco),
        ativo: true,
        criadoEm: serverTimestamp(),
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    await setDoc(
      doc(db, "estoque", produtoId),
      {
        produtoId,
        nome: nomeTratado,
        categoria: categoriaTratada,
        preco: Number(novoPreco),
        quantidade: Number(novaQuantidade || 0),
        minimo: Number(novoMinimo || 0),
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    setNovoNome("");
    setNovaCategoria("");
    setNovoPreco("");
    setNovaQuantidade("");
    setNovoMinimo("");
    setMensagemErro("");
    setModalAdicionar(false);
  }

  const produtosPorCategoria = produtos.reduce((grupos, produto) => {
    if (!grupos[produto.categoria]) {
      grupos[produto.categoria] = [];
    }

    grupos[produto.categoria].push(produto);
    return grupos;
  }, {});

  return (
    <div className="estoque-page">
      {modalAdicionar && (
        <div className="estoque-modal-fundo">
          <div className="estoque-modal-card">
            <div className="estoque-modal-icone">📦</div>

            <h2>Adicionar produto</h2>
            <p>Cadastre um novo item para controlar no estoque.</p>

            {mensagemErro && (
              <strong className="estoque-modal-erro">{mensagemErro}</strong>
            )}

            <div className="estoque-modal-form">
              <input
                placeholder="Nome do produto"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
              />

              <input
                placeholder="Categoria"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
              />

              <input
                type="number"
                placeholder="Preço"
                value={novoPreco}
                onChange={(e) => setNovoPreco(e.target.value)}
              />

              <input
                type="number"
                placeholder="Quantidade inicial"
                value={novaQuantidade}
                onChange={(e) => setNovaQuantidade(e.target.value)}
              />

              <input
                type="number"
                placeholder="Alerta mínimo"
                value={novoMinimo}
                onChange={(e) => setNovoMinimo(e.target.value)}
              />
            </div>

            <div className="estoque-modal-botoes">
              <button
                className="estoque-modal-cancelar"
                onClick={() => {
                  setModalAdicionar(false);
                  setMensagemErro("");
                }}
              >
                Cancelar
              </button>

              <button
                className="estoque-modal-confirmar"
                onClick={adicionarProduto}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {produtoParaExcluir && (
        <div className="estoque-modal-fundo">
          <div className="estoque-modal-card">
            <div className="estoque-modal-icone perigo">🗑️</div>

            <h2>Excluir produto?</h2>
            <p>
              Você está prestes a excluir{" "}
              <strong>{produtoParaExcluir.nome}</strong> do estoque.
            </p>

            <div className="estoque-modal-botoes">
              <button
                className="estoque-modal-cancelar"
                onClick={() => setProdutoParaExcluir(null)}
              >
                Cancelar
              </button>

              <button
                className="estoque-modal-excluir"
                onClick={confirmarExcluirProduto}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <Link to="/" className="voltar">
        ← Voltar
      </Link>

      <div className="estoque-header">
        <div>
          <span>Controle</span>
          <h1 className="estoque-titulo">Estoque</h1>
          <p>Adicione o estoque do dia e acompanhe os itens baixos.</p>
        </div>

        <button
          className="estoque-add-btn"
          onClick={() => setModalAdicionar(true)}
        >
          +
        </button>
      </div>

      <div className="estoque-alerta">
        <strong>⚠️ Regra</strong>
        <p>O estoque baixa quando o cliente ou garçom faz pedido.</p>
      </div>

      {Object.keys(produtosPorCategoria).map((categoria) => {
        const aberta = categoriaAberta === categoria;
        const itens = ordenarItensCategoria(produtosPorCategoria[categoria]);

        return (
          <div key={categoria} className="estoque-categoria">
            <button
              className="estoque-categoria-btn"
              onClick={() => setCategoriaAberta(aberta ? "" : categoria)}
            >
              <span>
                {emojiCategoria(categoria)} {categoria}
              </span>

              <strong>{aberta ? "▲" : "▼"}</strong>
            </button>

            {aberta && (
              <div className="estoque-produtos">
                {itens.map((produto) => {
                  const itemEstoque = estoque[produto.id];
                  const quantidadeAtual = Number(itemEstoque?.quantidade || 0);
                  const minimoAtual = Number(itemEstoque?.minimo || 0);
                  const estoqueBaixo =
                    minimoAtual > 0 && quantidadeAtual <= minimoAtual;

                  return (
                    <div
                      key={produto.id}
                      className={`estoque-item ${
                        estoqueBaixo ? "estoque-baixo" : ""
                      }`}
                    >
                      <div className="estoque-item-topo">
                        <div>
                          {editandoNomeId === produto.id ? (
                            <div className="estoque-nome-editando">
                              <input
                                type="text"
                                value={novoNomeEstoque}
                                onChange={(e) => setNovoNomeEstoque(e.target.value)}
                                autoFocus
                              />

                              <button
                                className="estoque-nome-ok"
                                onClick={() => salvarNomeProdutoEstoque(produto)}
                              >
                                OK
                              </button>

                              <button
                                className="estoque-nome-cancelar"
                                onClick={() => {
                                  setEditandoNomeId(null);
                                  setNovoNomeEstoque("");
                                  setErroNomeEstoque("");
                                }}
                              >
                                ✕
                              </button>

                              {erroNomeEstoque && (
                                <small className="estoque-nome-erro">
                                  {erroNomeEstoque}
                                </small>
                              )}
                            </div>
                          ) : (
                            <strong
                              className="estoque-nome-clicavel"
                              onClick={() => {
                                setEditandoNomeId(produto.id);
                                setNovoNomeEstoque(produto.nome);
                                setErroNomeEstoque("");
                              }}
                              title="Toque para renomear"
                            >
                              {produto.nome} ✏️
                            </strong>
                          )}
                          <p>R$ {formatarMoeda(produto.preco)}</p>
                        </div>

                        <span>{quantidadeAtual}</span>
                      </div>

                      {estoqueBaixo && (
                        <small className="estoque-baixo-aviso">
                          ⚠️ Estoque baixo
                        </small>
                      )}

                      <div className="estoque-mini-controle">
                        <button onClick={() => ajustarQuantidade(produto, -1)}>
                          -
                        </button>

                        <button onClick={() => ajustarQuantidade(produto, 1)}>
                          +
                        </button>
                      </div>

                      <div className="estoque-inputs">
                        <input
                          type="number"
                          placeholder="Qtd"
                          value={quantidades[produto.id] || ""}
                          onChange={(e) =>
                            setQuantidades((atual) => ({
                              ...atual,
                              [produto.id]: e.target.value,
                            }))
                          }
                        />

                        <input
                          type="number"
                          placeholder="Mín."
                          value={minimos[produto.id] || ""}
                          onChange={(e) =>
                            setMinimos((atual) => ({
                              ...atual,
                              [produto.id]: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="estoque-item-acoes">
                        <button
                          className="estoque-btn-salvar"
                          onClick={() => salvarEstoque(produto)}
                        >
                          Salvar
                        </button>

                        <button
                          className="estoque-btn-zerar"
                          onClick={() => zerarEstoqueProduto(produto)}
                        >
                          Zerar
                        </button>

                        <button
                          className="estoque-btn-excluir"
                          onClick={() => setProdutoParaExcluir(produto)}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Estoque;