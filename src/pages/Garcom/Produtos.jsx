import { useEffect, useMemo, useState, useRef } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../../firebase";
import {
  SEM_CATEGORIA,
  migrarCategoriasSeNecessario,
  criarCategoria,
  renomearCategoria,
  excluirCategoria,
  moverProdutoParaCategoria,
  salvarOrdemCategorias,
  trocarPosicao,
} from "../../utils/categorias";
import { ordenarItensCategoria } from "../../utils/produtosOrdem";
import { slugify, formatarMoeda } from "../../utils/texto";
import "../../styles/Garcom/Produtos.css";

function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [editando, setEditando] = useState(null);
  const [novoPreco, setNovoPreco] = useState("");
  const [editandoNome, setEditandoNome] = useState(null);
  const [novoNomeProduto, setNovoNomeProduto] = useState("");
  const [erroNomeProduto, setErroNomeProduto] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [precoNovoProduto, setPrecoNovoProduto] = useState("");
  const [segurandoProduto, setSegurandoProduto] = useState(null);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState(null);
  const [erroProduto, setErroProduto] = useState("");

  // ── Estado da gestão de categorias ──
  const [gerenciandoCategorias, setGerenciandoCategorias] = useState(false);
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [nomeNovaCategoria, setNomeNovaCategoria] = useState("");
  const [erroCategoria, setErroCategoria] = useState("");
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [nomeEditadoCategoria, setNomeEditadoCategoria] = useState("");
  const [categoriaParaExcluir, setCategoriaParaExcluir] = useState(null);
  const [acaoExclusao, setAcaoExclusao] = useState("sem-categoria");
  const [categoriaDestinoExclusao, setCategoriaDestinoExclusao] = useState("");
  const [mensagemCategoria, setMensagemCategoria] = useState("");

  const arrastandoIndex = useRef(null);
  const [indexSobre, setIndexSobre] = useState(null);

  function criarIdProduto(texto) {
    return slugify(texto);
  }

  useEffect(() => {
    migrarCategoriasSeNecessario().catch((erro) =>
      console.error("Erro ao migrar categorias:", erro)
    );

    const cancelarProdutos = onSnapshot(collection(db, "produtos"), (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      setProdutos(lista);
    });

    const cancelarCategorias = onSnapshot(collection(db, "categorias"), (snapshot) => {
      const lista = snapshot.docs
        .map((documento) => ({ id: documento.id, ...documento.data() }))
        .sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));

      setCategorias(lista);
    });

    return () => {
      cancelarProdutos();
      cancelarCategorias();
    };
  }, []);

  function mostrarMensagemCategoria(texto) {
    setMensagemCategoria(texto);
    setTimeout(() => setMensagemCategoria(""), 2500);
  }

  async function adicionarProduto() {
    if (!novoNome || !novaCategoria || !precoNovoProduto) {
      setErroProduto("Preencha nome, categoria e preço.");
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
        preco: Number(precoNovoProduto),
        ativo: true,
        criadoEm: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      doc(db, "estoque", produtoId),
      {
        nome: nomeTratado,
        categoria: categoriaTratada,
        quantidade: 0,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    // Se o cliente digitou uma categoria nova que ainda não existe na
    // coleção "categorias", cria automaticamente ao final da lista.
    const existeCategoria = categorias.some(
      (c) => c.nome.toLowerCase() === categoriaTratada.toLowerCase()
    );
    if (!existeCategoria) {
      try {
        await criarCategoria(categoriaTratada, categorias);
      } catch {
        // categoria pode já existir por corrida entre abas — ignora
      }
    }

    setNovoNome("");
    setNovaCategoria("");
    setPrecoNovoProduto("");
    setErroProduto("");
    setAdicionando(false);
  }

  async function salvarPreco(produto) {
    await updateDoc(doc(db, "produtos", produto.id), {
      preco: Number(novoPreco),
      atualizadoEm: new Date().toISOString(),
    });

    setEditando(null);
    setNovoPreco("");
  }

  async function salvarNomeProduto(produto) {
    const nomeTratado = novoNomeProduto.trim();

    if (!nomeTratado) {
      setErroNomeProduto("O nome não pode ficar em branco.");
      return;
    }

    const nomeJaExiste = produtos.some(
      (item) =>
        item.id !== produto.id &&
        item.categoria === produto.categoria &&
        item.nome.trim().toLowerCase() === nomeTratado.toLowerCase()
    );

    if (nomeJaExiste) {
      setErroNomeProduto("Já existe um produto com esse nome nessa categoria.");
      return;
    }

    try {
      const batch = writeBatch(db);

      batch.update(doc(db, "produtos", produto.id), {
        nome: nomeTratado,
        atualizadoEm: new Date().toISOString(),
      });

      batch.set(
        doc(db, "estoque", produto.id),
        { nome: nomeTratado, atualizadoEm: new Date().toISOString() },
        { merge: true }
      );

      await batch.commit();

      setEditandoNome(null);
      setNovoNomeProduto("");
      setErroNomeProduto("");
    } catch (erro) {
      console.error("Erro ao renomear produto:", erro);
      setErroNomeProduto("Erro ao renomear. Tente novamente.");
    }
  }

  async function confirmarExcluirProduto() {
    if (!produtoParaExcluir) return;

    await deleteDoc(doc(db, "produtos", produtoParaExcluir.id));
    await deleteDoc(doc(db, "estoque", produtoParaExcluir.id));

    setProdutoParaExcluir(null);
  }

  function iniciarPressionar(produto) {
    const timer = setTimeout(() => {
      setProdutoParaExcluir(produto);
    }, 900);

    setSegurandoProduto(timer);
  }

  function cancelarPressionar() {
    if (segurandoProduto) {
      clearTimeout(segurandoProduto);
      setSegurandoProduto(null);
    }
  }

  async function trocarCategoriaProduto(produtoId, novaCategoriaNome) {
    await moverProdutoParaCategoria(produtoId, novaCategoriaNome);
  }

  // ── Ordenação das categorias exibidas ──
  const categoriasExibidas = useMemo(() => {
    const nomesComProdutos = new Set(produtos.map((p) => p.categoria));
    const nomesCadastrados = new Set(categorias.map((c) => c.nome));

    const extras = Array.from(nomesComProdutos)
      .filter((nome) => nome && !nomesCadastrados.has(nome))
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((nome, i) => ({
        id: `nao-cadastrada-${slugify(nome)}`,
        nome,
        ordem: 9000 + i,
        virtual: true,
      }));

    return [...categorias, ...extras];
  }, [categorias, produtos]);

  const produtosPorCategoria = produtos.reduce((grupos, produto) => {
    const chave = produto.categoria || SEM_CATEGORIA;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(produto);
    return grupos;
  }, {});

  // ── CRUD de categorias ──
  async function confirmarCriarCategoria() {
    try {
      await criarCategoria(nomeNovaCategoria, categorias);
      setNomeNovaCategoria("");
      setCriandoCategoria(false);
      setErroCategoria("");
      mostrarMensagemCategoria("Categoria criada!");
    } catch (erro) {
      setErroCategoria(erro.message);
    }
  }

  function iniciarEdicaoCategoria(categoria) {
    setCategoriaEditando(categoria);
    setNomeEditadoCategoria(categoria.nome);
  }

  async function confirmarRenomearCategoria() {
    if (!categoriaEditando) return;
    try {
      await renomearCategoria(categoriaEditando, nomeEditadoCategoria);
      setCategoriaEditando(null);
      mostrarMensagemCategoria("Categoria renomeada!");
    } catch (erro) {
      setErroCategoria(erro.message);
    }
  }

  function abrirExclusaoCategoria(categoria) {
    setCategoriaParaExcluir(categoria);
    setAcaoExclusao("sem-categoria");
    setCategoriaDestinoExclusao("");
  }

  async function confirmarExclusaoCategoria() {
    if (!categoriaParaExcluir) return;

    const destino =
      acaoExclusao === "mover" && categoriaDestinoExclusao
        ? { tipo: "mover", categoriaDestino: categoriaDestinoExclusao }
        : { tipo: "sem-categoria" };

    await excluirCategoria(categoriaParaExcluir, destino);
    setCategoriaParaExcluir(null);
    mostrarMensagemCategoria("Categoria excluída!");
  }

  async function moverCategoriaBotao(index, direcao) {
    const novaOrdem = trocarPosicao(categorias, index, index + direcao);
    if (novaOrdem === categorias) return;
    setCategorias(novaOrdem);
    await salvarOrdemCategorias(novaOrdem);
  }

  // ── Drag & drop de categorias (mouse + touch via HTML5 draggable) ──
  function aoIniciarArrasto(index) {
    arrastandoIndex.current = index;
  }

  function aoPassarPorCima(e, index) {
    e.preventDefault();
    setIndexSobre(index);
  }

  async function aoSoltar(index) {
    const origem = arrastandoIndex.current;
    arrastandoIndex.current = null;
    setIndexSobre(null);

    if (origem === null || origem === index) return;

    // Ao arrastar uma categoria sobre outra, as duas trocam de lugar.
    // Assim, a categoria que estava no destino ocupa exatamente o lugar
    // que a categoria arrastada deixou.
    const nova = trocarPosicao(categorias, origem, index);

    setCategorias(nova);
    await salvarOrdemCategorias(nova);
  }

  const produtosDisponiveisComoDestino = (categoriaAtual) =>
    categorias.filter((c) => c.nome !== categoriaAtual);

  return (
    <div className="container">
      <Link to="/" className="voltar">
        ← Voltar
      </Link>

      <div className="pedidos-header">
        <div>
          <span>Cardápio</span>
          <h1>Produtos</h1>
          <p>Altere preços e organize as categorias do cardápio.</p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="produto-mini-btn"
            onClick={() => setGerenciandoCategorias((v) => !v)}
            title="Gerenciar categorias"
          >
            {gerenciandoCategorias ? "✕" : "🗂️"}
          </button>

          <button
            className="produto-mini-btn"
            onClick={() => {
              setAdicionando(true);
              setErroProduto("");
            }}
            title="Adicionar produto"
          >
            +
          </button>
        </div>
      </div>

      {mensagemCategoria && <div className="toast">{mensagemCategoria}</div>}

      {gerenciandoCategorias && (
        <div className="pedido-card categorias-painel">
          <div className="categorias-painel-header">
            <h3>Categorias</h3>
            <button
              className="produto-mini-btn"
              onClick={() => {
                setCriandoCategoria(true);
                setErroCategoria("");
              }}
              title="Nova categoria"
            >
              +
            </button>
          </div>

          <p className="categorias-dica">
            Arraste (ou use as setas) para reordenar. A ordem aparece no
            cardápio do cliente e na tela de pedidos.
          </p>

          {categorias.length === 0 && (
            <p className="categorias-vazio">Nenhuma categoria cadastrada ainda.</p>
          )}

          <ul className="categorias-lista">
            {categorias.map((categoria, index) => (
              <li
                key={categoria.id}
                className={`categoria-linha ${indexSobre === index ? "sobre" : ""}`}
                draggable
                onDragStart={() => aoIniciarArrasto(index)}
                onDragOver={(e) => aoPassarPorCima(e, index)}
                onDrop={() => aoSoltar(index)}
                onDragEnd={() => setIndexSobre(null)}
              >
                <span className="categoria-alca" title="Arraste para reordenar">
                  ⠿
                </span>

                <span className="categoria-nome">{categoria.nome}</span>

                <span className="categoria-contagem">
                  {(produtosPorCategoria[categoria.nome] || []).length} itens
                </span>

                <div className="categoria-acoes">
                  <button
                    onClick={() => moverCategoriaBotao(index, -1)}
                    disabled={index === 0}
                    title="Mover para cima"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moverCategoriaBotao(index, 1)}
                    disabled={index === categorias.length - 1}
                    title="Mover para baixo"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => iniciarEdicaoCategoria(categoria)}
                    title="Renomear"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => abrirExclusaoCategoria(categoria)}
                    title="Excluir"
                    className="categoria-btn-excluir"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {criandoCategoria && (
        <div className="modal-fechar-dia">
          <div className="modal-fechar-dia-card produto-modal-card">
            <div className="modal-fechar-dia-icone">🗂️</div>
            <h2>Nova categoria</h2>
            <p>Ela aparecerá ao final da lista, você pode reordenar depois.</p>

            {erroCategoria && <strong>{erroCategoria}</strong>}

            <div className="produto-modal-form">
              <input
                placeholder="Nome da categoria"
                value={nomeNovaCategoria}
                onChange={(e) => setNomeNovaCategoria(e.target.value)}
                autoFocus
              />
            </div>

            <div className="modal-fechar-dia-botoes">
              <button
                className="modal-btn-cancelar"
                onClick={() => {
                  setCriandoCategoria(false);
                  setErroCategoria("");
                }}
              >
                Cancelar
              </button>
              <button className="modal-btn-confirmar" onClick={confirmarCriarCategoria}>
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {categoriaEditando && (
        <div className="modal-fechar-dia">
          <div className="modal-fechar-dia-card produto-modal-card">
            <div className="modal-fechar-dia-icone">✏️</div>
            <h2>Renomear categoria</h2>
            <p>Os produtos dessa categoria são atualizados automaticamente.</p>

            {erroCategoria && <strong>{erroCategoria}</strong>}

            <div className="produto-modal-form">
              <input
                value={nomeEditadoCategoria}
                onChange={(e) => setNomeEditadoCategoria(e.target.value)}
                autoFocus
              />
            </div>

            <div className="modal-fechar-dia-botoes">
              <button
                className="modal-btn-cancelar"
                onClick={() => {
                  setCategoriaEditando(null);
                  setErroCategoria("");
                }}
              >
                Cancelar
              </button>
              <button className="modal-btn-confirmar" onClick={confirmarRenomearCategoria}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {categoriaParaExcluir && (
        <div className="modal-fechar-dia">
          <div className="modal-fechar-dia-card produto-modal-card">
            <div className="modal-fechar-dia-icone">🗑️</div>
            <h2>Excluir "{categoriaParaExcluir.nome}"?</h2>

            {(produtosPorCategoria[categoriaParaExcluir.nome] || []).length > 0 ? (
              <>
                <p>
                  Essa categoria tem{" "}
                  <strong>
                    {(produtosPorCategoria[categoriaParaExcluir.nome] || []).length}
                  </strong>{" "}
                  produto(s). Eles não serão apagados — escolha o que fazer com
                  eles:
                </p>

                <div className="produto-modal-form">
                  <label className="opcao-radio">
                    <input
                      type="radio"
                      checked={acaoExclusao === "sem-categoria"}
                      onChange={() => setAcaoExclusao("sem-categoria")}
                    />
                    Deixar sem categoria
                  </label>

                  <label className="opcao-radio">
                    <input
                      type="radio"
                      checked={acaoExclusao === "mover"}
                      onChange={() => setAcaoExclusao("mover")}
                    />
                    Mover para outra categoria
                  </label>

                  {acaoExclusao === "mover" && (
                    <select
                      value={categoriaDestinoExclusao}
                      onChange={(e) => setCategoriaDestinoExclusao(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {produtosDisponiveisComoDestino(categoriaParaExcluir.nome).map(
                        (c) => (
                          <option key={c.id} value={c.nome}>
                            {c.nome}
                          </option>
                        )
                      )}
                    </select>
                  )}
                </div>
              </>
            ) : (
              <p>Essa categoria não tem produtos.</p>
            )}

            <div className="modal-fechar-dia-botoes">
              <button
                className="modal-btn-cancelar"
                onClick={() => setCategoriaParaExcluir(null)}
              >
                Cancelar
              </button>
              <button
                className="modal-btn-confirmar"
                onClick={confirmarExclusaoCategoria}
                disabled={
                  acaoExclusao === "mover" && !categoriaDestinoExclusao
                }
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {adicionando && (
        <div className="modal-fechar-dia">
          <div className="modal-fechar-dia-card produto-modal-card">
            <div className="modal-fechar-dia-icone">➕</div>

            <h2>Adicionar produto</h2>

            <p>Cadastre um novo item no cardápio.</p>

            {erroProduto && <strong>{erroProduto}</strong>}

            <div className="produto-modal-form">
              <input
                placeholder="Nome do produto"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
              />

              <input
                placeholder="Categoria"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                list="lista-categorias-existentes"
              />
              <datalist id="lista-categorias-existentes">
                {categorias.map((c) => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>

              <input
                type="number"
                placeholder="Preço"
                value={precoNovoProduto}
                onChange={(e) => setPrecoNovoProduto(e.target.value)}
              />
            </div>

            <div className="modal-fechar-dia-botoes">
              <button
                className="modal-btn-cancelar"
                onClick={() => {
                  setAdicionando(false);
                  setErroProduto("");
                }}
              >
                Cancelar
              </button>

              <button className="modal-btn-confirmar" onClick={adicionarProduto}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {produtoParaExcluir && (
        <div className="modal-fechar-dia">
          <div className="modal-fechar-dia-card">
            <div className="modal-fechar-dia-icone">🗑️</div>

            <h2>Excluir produto?</h2>

            <p>
              Você está prestes a excluir{" "}
              <strong>{produtoParaExcluir.nome}</strong> do cardápio.
            </p>

            <strong>Essa ação não pode ser desfeita.</strong>

            <div className="modal-fechar-dia-botoes">
              <button
                className="modal-btn-cancelar"
                onClick={() => setProdutoParaExcluir(null)}
              >
                Cancelar
              </button>

              <button
                className="modal-btn-confirmar"
                onClick={confirmarExcluirProduto}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {categoriasExibidas.map((categoria) => (
        <div key={categoria.id} className="pedido-card">
          <div className="produtos-categoria-header">
            <h3>{categoria.nome}</h3>
          </div>

          {ordenarItensCategoria(produtosPorCategoria[categoria.nome] || []).map(
            (produto) => (
              <div
                key={produto.id}
                className="pedido-total produto-linha-editavel"
                onMouseDown={() => iniciarPressionar(produto)}
                onMouseUp={cancelarPressionar}
                onMouseLeave={cancelarPressionar}
                onTouchStart={() => iniciarPressionar(produto)}
                onTouchEnd={cancelarPressionar}
              >
                <div className="produto-linha-info">
                  {editandoNome === produto.id ? (
                    <div
                      className="produto-nome-editando"
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={novoNomeProduto}
                        onChange={(e) => setNovoNomeProduto(e.target.value)}
                        autoFocus
                      />

                      <button
                        className="btn-verde"
                        onClick={() => salvarNomeProduto(produto)}
                      >
                        OK
                      </button>

                      <button
                        className="produto-nome-cancelar"
                        onClick={() => {
                          setEditandoNome(null);
                          setNovoNomeProduto("");
                          setErroNomeProduto("");
                        }}
                      >
                        ✕
                      </button>

                      {erroNomeProduto && (
                        <small className="produto-nome-erro">
                          {erroNomeProduto}
                        </small>
                      )}
                    </div>
                  ) : (
                    <span
                      className="produto-nome-clicavel"
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={() => {
                        setEditandoNome(produto.id);
                        setNovoNomeProduto(produto.nome);
                        setErroNomeProduto("");
                      }}
                      title="Toque para renomear"
                    >
                      {produto.nome} ✏️
                    </span>
                  )}

                  <select
                    className="produto-select-categoria"
                    value={produto.categoria || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      trocarCategoriaProduto(produto.id, e.target.value)
                    }
                  >
                    {categoriasExibidas.map((c) => (
                      <option key={c.id} value={c.nome}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {editando === produto.id ? (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="number"
                      value={novoPreco}
                      onChange={(e) => setNovoPreco(e.target.value)}
                      style={{
                        width: "80px",
                        padding: "8px",
                      }}
                    />

                    <button
                      className="btn-verde"
                      onClick={() => salvarPreco(produto)}
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <strong
                    onClick={() => {
                      setEditando(produto.id);
                      setNovoPreco(produto.preco);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    R$ {formatarMoeda(produto.preco)}
                  </strong>
                )}
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}

export default Produtos;
