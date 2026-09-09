import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../firebase";
import { ordenarGruposPorCategoria, trocarOrdemCategorias } from "../../utils/categorias";
import "../../styles/Cliente/CardapioMesa.css";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  onSnapshot,
  getDoc,
  setDoc,
} from "firebase/firestore";

function CardapioMesa() {
  const { mesa } = useParams();

  const [pedidoMesaAberto, setPedidoMesaAberto] = useState(null);
  const [carrinho, setCarrinho] = useState({});
  const [categoriaAberta, setCategoriaAberta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const [nomeCliente, setNomeCliente] = useState("");
  const [nomeDigitado, setNomeDigitado] = useState("");
  const [mostrarModalNome, setMostrarModalNome] = useState(false);

  const [mostrarModalPagamento, setMostrarModalPagamento] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [produtos, setProdutos] = useState([]);
  const [estoque, setEstoque] = useState({});
  const [categoriasDocs, setCategoriasDocs] = useState([]);
  const [categoriaArrastando, setCategoriaArrastando] = useState(null);
  const [categoriaSobre, setCategoriaSobre] = useState(null);
  const arrastoTouchRef = useRef(null);
  const arrastoTimerRef = useRef(null);
  const categoriaSobreRef = useRef(null);
  const movimentoTouchRef = useRef({ x: 0, y: 0 });
  const arrastoExecutadoRef = useRef(false);

  function formatarMoeda(valor) {
    return Number(valor || 0).toFixed(2).replace(".", ",");
  }

  function emojiCategoria(categoria) {
    if (categoria.includes("Hambúrgueres") || categoria.includes("Hamburgueres")) return "🍔";
    if (categoria.includes("Combos")) return "🍟";
    if (categoria.includes("Acompanhamentos")) return "🍟";
    if (categoria.includes("Bebidas") || categoria.includes("Refrigerantes")) return "🥤";
    if (categoria.includes("Sobremesas")) return "🍨";
    if (categoria.includes("Adicionais")) return "➕";
    if (categoria.includes("Cervejas")) return "🍺";
    return "🍽️";
  }

  useEffect(() => {
    const cancelarCategorias = onSnapshot(collection(db, "categorias"), (snapshot) => {
      setCategoriasDocs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const cancelarEstoque = onSnapshot(collection(db, "estoque"), (snapshot) => {
      const dados = {};

      snapshot.docs.forEach((documento) => {
        dados[documento.id] = documento.data();
      });

      setEstoque(dados);
    });

    return () => {
      cancelarCategorias();
      cancelarEstoque();
    };
  }, []);

  useEffect(() => {
    const cancelarProdutos = onSnapshot(collection(db, "produtos"), (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      const produtosAtivos = lista.filter((produto) => produto.ativo !== false);

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

      setProdutos(
        ordenarGruposPorCategoria(Object.values(grupos), categoriasDocs)
      );
    });

    return () => cancelarProdutos();
  }, [categoriasDocs]);

  useEffect(() => {
    const nomeSalvo = localStorage.getItem(`mesa_${mesa}_cliente`);

    if (nomeSalvo) {
      setNomeCliente(nomeSalvo);
      return;
    }

    setMostrarModalNome(true);
  }, [mesa]);

  useEffect(() => {
    const pedidosRef = collection(db, "pedidos");

    const consulta = query(
      pedidosRef,
      where("tipo", "==", "mesa"),
      where("mesa", "==", Number(mesa)),
      where("status", "==", "aberto")
    );

    const cancelar = onSnapshot(consulta, (snapshot) => {
      if (snapshot.empty) {
        setPedidoMesaAberto(null);
        return;
      }

      const pedidos = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      const itens = pedidos.flatMap((pedido) => pedido.itens || []);

      const agrupados = itens.reduce((resultado, item) => {
        const clienteItem = item.cliente || "Cliente";
        const chave = `${item.nome}-${clienteItem}`;

        if (!resultado[chave]) {
          resultado[chave] = {
            nome: item.nome,
            cliente: clienteItem,
            preco: Number(item.preco || 0),
            qtd: 0,
          };
        }

        resultado[chave].qtd += Number(item.qtd || item.quantidade || 0);

        return resultado;
      }, {});

      const itensOrdenados = Object.values(agrupados).sort((a, b) => {
        const totalA = Number(a.preco || 0) * Number(a.qtd || 0);
        const totalB = Number(b.preco || 0) * Number(b.qtd || 0);

        if (totalA !== totalB) return totalA - totalB;

        return a.nome.localeCompare(b.nome);
      });

      setPedidoMesaAberto({
        itens: itensOrdenados,
        total: itensOrdenados.reduce(
          (soma, item) => soma + Number(item.preco || 0) * Number(item.qtd || 0),
          0
        ),
        totalItens: itensOrdenados.reduce(
          (soma, item) => soma + Number(item.qtd || 0),
          0
        ),
      });
    });

    return () => cancelar();
  }, [mesa]);

  function confirmarNomeCliente() {
    const nome = nomeDigitado.trim();

    if (!nome) {
      setMostrarModalNome(false);
      return;
    }

    localStorage.setItem(`mesa_${mesa}_cliente`, nome);
    setNomeCliente(nome);
    setMostrarModalNome(false);
  }

  function alterarQuantidade(item, valor) {
    setCarrinho((anterior) => {
      const quantidadeAtual = anterior[item.id]?.quantidade || 0;
      const novaQuantidade = quantidadeAtual + valor;

      if (novaQuantidade <= 0) {
        const copia = { ...anterior };
        delete copia[item.id];
        return copia;
      }

      return {
        ...anterior,
        [item.id]: {
          produtoId: item.id,
          nome: item.nome,
          preco: item.preco,
          quantidade: novaQuantidade,
        },
      };
    });
  }

  const itensSelecionados = Object.values(carrinho).sort((a, b) => {
    const totalA = Number(a.preco || 0) * Number(a.quantidade || 0);
    const totalB = Number(b.preco || 0) * Number(b.quantidade || 0);

    if (totalA !== totalB) return totalA - totalB;

    return a.nome.localeCompare(b.nome);
  });

  const total = itensSelecionados.reduce(
    (soma, item) => soma + Number(item.preco || 0) * Number(item.quantidade || 0),
    0
  );

  const produtosDisponiveis = produtos;

  function limparArrastoTouch() {
    if (arrastoTimerRef.current) {
      clearTimeout(arrastoTimerRef.current);
      arrastoTimerRef.current = null;
    }

    arrastoTouchRef.current = null;
    categoriaSobreRef.current = null;
    arrastoExecutadoRef.current = false;
    setCategoriaArrastando(null);
    setCategoriaSobre(null);
  }

  function iniciarArrastoCategoriaTouch(evento, nomeCategoria) {
    if (evento.pointerType === "mouse") return;

    const ponto = { x: evento.clientX, y: evento.clientY };
    movimentoTouchRef.current = ponto;

    if (arrastoTimerRef.current) clearTimeout(arrastoTimerRef.current);

    arrastoTouchRef.current = {
      nome: nomeCategoria,
      pointerId: evento.pointerId,
      iniciado: false,
    };

    arrastoTimerRef.current = setTimeout(() => {
      if (!arrastoTouchRef.current) return;
      arrastoTouchRef.current.iniciado = true;
      arrastoExecutadoRef.current = true;
      setCategoriaArrastando(nomeCategoria);
      if (navigator.vibrate) navigator.vibrate(25);
    }, 320);
  }

  function moverArrastoCategoriaTouch(evento) {
    const arrasto = arrastoTouchRef.current;
    if (!arrasto || evento.pointerId !== arrasto.pointerId) return;

    const dx = evento.clientX - movimentoTouchRef.current.x;
    const dy = evento.clientY - movimentoTouchRef.current.y;

    if (!arrasto.iniciado) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        if (arrastoTimerRef.current) clearTimeout(arrastoTimerRef.current);
        arrastoTimerRef.current = null;
        arrastoTouchRef.current = null;
      }
      return;
    }

    evento.preventDefault();

    const elemento = document.elementFromPoint(evento.clientX, evento.clientY);
    const alvo = elemento?.closest("[data-categoria-cardapio]");

    if (alvo) {
      const nomeAlvo = alvo.getAttribute("data-categoria-cardapio");
      categoriaSobreRef.current = nomeAlvo;
      setCategoriaSobre(nomeAlvo);
    }
  }

  async function finalizarArrastoCategoriaTouch(evento) {
    const arrasto = arrastoTouchRef.current;
    if (!arrasto || evento.pointerId !== arrasto.pointerId) return;

    const estavaArrastando = arrasto.iniciado;
    const origemNome = arrasto.nome;
    const alvoNome = categoriaSobreRef.current;

    if (arrastoTimerRef.current) clearTimeout(arrastoTimerRef.current);
    arrastoTimerRef.current = null;
    arrastoTouchRef.current = null;
    categoriaSobreRef.current = null;

    if (!estavaArrastando) {
      setCategoriaSobre(null);
      return;
    }

    setCategoriaArrastando(null);
    setCategoriaSobre(null);

    if (!alvoNome || origemNome === alvoNome) return;

    const origem = categoriasDocs.find((categoria) => categoria.nome === origemNome);
    const alvo = categoriasDocs.find((categoria) => categoria.nome === alvoNome);

    if (!origem || !alvo) return;

    try {
      await trocarOrdemCategorias(origem, alvo);
    } catch (erro) {
      console.error("Erro ao trocar ordem das categorias:", erro);
    }
  }

  async function baixarEstoque(itens) {
    for (const item of itens) {
      if (!item.produtoId) continue;

      const estoqueRef = doc(db, "estoque", item.produtoId);
      const estoqueSnap = await getDoc(estoqueRef);

      if (!estoqueSnap.exists()) continue;

      const quantidadeAtual = Number(estoqueSnap.data().quantidade || 0);
      const quantidadePedida = Number(item.qtd || item.quantidade || 0);
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

  async function fazerPedido() {
    if (itensSelecionados.length === 0) {
      setMensagem("Escolha pelo menos um produto.");
      return;
    }

    setEnviando(true);

    try {
      const clientePedido = nomeCliente || "Cliente";

      const itensNovos = itensSelecionados.map((item) => ({
        produtoId: item.produtoId,
        nome: item.nome,
        preco: Number(item.preco || 0),
        qtd: Number(item.quantidade || 0),
        quantidade: Number(item.quantidade || 0),
        cliente: clientePedido,
      }));

      const pedidosRef = collection(db, "pedidos");

      const consultaMesaAberta = query(
        pedidosRef,
        where("tipo", "==", "mesa"),
        where("mesa", "==", Number(mesa)),
        where("status", "==", "aberto")
      );

      const resultado = await getDocs(consultaMesaAberta);

      if (!resultado.empty) {
        const documentoMesa = resultado.docs[0];
        const pedidoAtual = documentoMesa.data();

        const itensAntigos = pedidoAtual.itens || [];
        const itensAtualizados = [...itensAntigos];

        itensNovos.forEach((novoItem) => {
          const itemExistente = itensAtualizados.find(
            (item) =>
              item.produtoId === novoItem.produtoId &&
              (item.cliente || "Cliente") === (novoItem.cliente || "Cliente")
          );

          if (itemExistente) {
            itemExistente.qtd =
              Number(itemExistente.qtd || itemExistente.quantidade || 0) +
              Number(novoItem.qtd || 0);

            itemExistente.quantidade = itemExistente.qtd;
            itemExistente.produtoId = novoItem.produtoId;
          } else {
            itensAtualizados.push(novoItem);
          }
        });

        const novoTotal = itensAtualizados.reduce(
          (soma, item) =>
            soma +
            Number(item.preco || 0) * Number(item.qtd || item.quantidade || 0),
          0
        );

        const novoTotalItens = itensAtualizados.reduce(
          (soma, item) => soma + Number(item.qtd || item.quantidade || 0),
          0
        );

        await updateDoc(doc(db, "pedidos", documentoMesa.id), {
          itens: itensAtualizados,
          total: novoTotal,
          totalItens: novoTotalItens,
          atualizadoEm: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, "pedidos"), {
          mesa: Number(mesa),
          itens: itensNovos,
          total,
          totalItens: itensNovos.reduce(
            (soma, item) => soma + Number(item.qtd || 0),
            0
          ),
          status: "aberto",
          tipo: "mesa",
          salvoEm: new Date().toISOString(),
          criadoEm: serverTimestamp(),
        });
      }

      await baixarEstoque(itensNovos);

      await addDoc(collection(db, "notificacoes"), {
        mesa: Number(mesa),
        tipo: "pedido",
        mensagem: `Novo pedido na Mesa ${mesa}`,
        total,
        totalItens: itensNovos.reduce(
          (soma, item) => soma + Number(item.qtd || 0),
          0
        ),
        itens: itensNovos,
        lida: false,
        horario: new Date().toISOString(),
        criadoEm: serverTimestamp(),
      });

      setCarrinho({});
      setMensagem("Pedido enviado com sucesso!");

      setTimeout(() => {
        setMensagem("");
      }, 3000);
    } catch (erro) {
      console.error("Erro ao enviar pedido:", erro);
      setMensagem("Erro ao enviar pedido.");
    }

    setEnviando(false);
  }

  async function chamarGarcom() {
    setEnviando(true);

    try {
      await addDoc(collection(db, "notificacoes"), {
        mesa: Number(mesa),
        tipo: "garcom",
        mensagem: `Mesa ${mesa} chamou o garçom`,
        lida: false,
        horario: new Date().toISOString(),
        criadoEm: serverTimestamp(),
      });

      setMensagem("Garcom chamado com sucesso!");

      setTimeout(() => {
        setMensagem("");
      }, 3000);
    } catch (erro) {
      console.error("Erro ao chamar garçom:", erro);
      setMensagem("Erro ao chamar garçom.");
    }

    setEnviando(false);
  }

  async function pedirConta() {
    if (!formaPagamento) {
      setMensagem("Escolha uma forma de pagamento.");
      return;
    }

    setEnviando(true);

    const totalConta = pedidoMesaAberto?.total || total;
    const totalItensConta = pedidoMesaAberto?.totalItens || 0;
    const itensConta = pedidoMesaAberto?.itens || [];

    try {
      await addDoc(collection(db, "notificacoes"), {
        mesa: Number(mesa),
        tipo: "pagamento",
        mensagem: `Mesa ${mesa} pediu pagamento`,
        formaPagamento,
        total: totalConta,
        totalItens: totalItensConta,
        itens: itensConta,
        lida: false,
        horario: new Date().toISOString(),
        criadoEm: serverTimestamp(),
      });

      setMensagem(
        `💳 Total: R$ ${formatarMoeda(totalConta)} • Pagamento: ${formaPagamento} • O garçom já foi notificado.`
      );

      setMostrarModalPagamento(false);
      setFormaPagamento("");

      setTimeout(() => {
        setMensagem("");
      }, 5000);
    } catch (erro) {
      console.error("Erro ao pedir pagamento:", erro);
      setMensagem("Erro ao pedir pagamento.");
    }

    setEnviando(false);
  }

  return (
    <div className="cardapio-cliente-page">
      {mostrarModalNome && (
        <div className="modal-nome-cliente">
          <div className="modal-nome-card">
            <h2>Quem está pedindo?</h2>
            <p>Digite seu nome para identificar seus pedidos nesta mesa.</p>

            <input
              type="text"
              placeholder="Ex: Allan"
              value={nomeDigitado}
              onChange={(e) => setNomeDigitado(e.target.value)}
              autoFocus
            />

            <div className="modal-nome-botoes">
              <button onClick={() => setMostrarModalNome(false)}>Cancelar</button>
              <button onClick={confirmarNomeCliente}>OK</button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalPagamento && (
        <div className="modal-nome-cliente">
          <div className="modal-nome-card">
            <h2>💳 Como deseja pagar?</h2>

            <p>
              Total da conta: R$ {formatarMoeda(pedidoMesaAberto?.total || total)}
            </p>

            <div className="formas-pagamento">
              {["Pix", "Dinheiro", "Débito", "Crédito"].map((forma) => (
                <button
                  key={forma}
                  className={formaPagamento === forma ? "ativo" : ""}
                  onClick={() => setFormaPagamento(forma)}
                >
                  {forma}
                </button>
              ))}
            </div>

            <div className="modal-nome-botoes">
              <button onClick={() => setMostrarModalPagamento(false)}>
                Cancelar
              </button>
              <button onClick={pedirConta}>Solicitar</button>
            </div>
          </div>
        </div>
      )}

      <div className="cardapio-cliente-card">
        <div className="cardapio-header">
          <span>🍔 Jully Burguer</span>
          <h1>Mesa {mesa}</h1>
          <p>Escolha uma categoria para fazer seu pedido.</p>

          <button
            className="cardapio-garcom-btn"
            onClick={chamarGarcom}
            disabled={enviando}
          >
            🛎️ Chamar Garcom
          </button>
        </div>

        {produtosDisponiveis.length === 0 && (
          <p className="cardapio-mensagem">
            Nenhum produto disponível no momento.
          </p>
        )}

        {produtosDisponiveis.map((categoria) => {
          const aberta = categoriaAberta === categoria.categoria;

          return (
            <div
              key={categoria.categoria}
              className={`cardapio-categoria ${
                categoriaArrastando === categoria.categoria ? "arrastando" : ""
              } ${
                categoriaSobre === categoria.categoria ? "sobre" : ""
              }`}
              data-categoria-cardapio={categoria.categoria}
              onPointerDown={(evento) => {
                if (evento.currentTarget.setPointerCapture) {
                  evento.currentTarget.setPointerCapture(evento.pointerId);
                }
                iniciarArrastoCategoriaTouch(evento, categoria.categoria);
              }}
              onPointerMove={moverArrastoCategoriaTouch}
              onPointerUp={finalizarArrastoCategoriaTouch}
              onPointerCancel={limparArrastoTouch}
            >
              <button
                className="cardapio-categoria-btn"
                onClick={(evento) => {
                  if (arrastoExecutadoRef.current) {
                    evento.preventDefault();
                    arrastoExecutadoRef.current = false;
                    return;
                  }

                  setCategoriaAberta(aberta ? "" : categoria.categoria);
                }}
              >
                <span className="cardapio-categoria-nome">
                  {emojiCategoria(categoria.categoria)} {categoria.categoria}
                </span>
                <span className="cardapio-categoria-direita">
                  <span
                    className="cardapio-categoria-arraste"
                    aria-label="Segure e arraste para mover esta categoria"
                    title="Segure e arraste para trocar de posição"
                  >
                    ⠿
                  </span>
                  <strong>{aberta ? "▲" : "▼"}</strong>
                </span>
              </button>

              {aberta &&
                [...categoria.itens]
                  .sort((a, b) => {
                    if (a.preco !== b.preco) return a.preco - b.preco;
                    return a.nome.localeCompare(b.nome);
                  })
                  .map((item) => {
                    const quantidade = carrinho[item.id]?.quantidade || 0;
                    
                    const quantidadeEstoque = Number(estoque[item.id]?.quantidade || 0);
const esgotado = quantidadeEstoque <= 0;

                    return (
                      <div key={item.id} className="cardapio-produto">
                        <div>
                          <strong>{item.nome}</strong>
                          {item.descricao && (
                            <span className="cardapio-produto-descricao">
                              {item.descricao}
                            </span>
                          )}
                          <p>R$ {formatarMoeda(item.preco)}</p>
                          {esgotado && <small className="produto-esgotado">Esgotado</small>}
                        </div>

                        <div className="cardapio-controle">
                          <button onClick={() => alterarQuantidade(item, -1)}>
                            -
                          </button>
                          <span>{quantidade}</span>
                         <button
  onClick={() => alterarQuantidade(item, 1)}
  disabled={esgotado}
>
  +
</button>
                        </div>
                      </div>
                    );
                  })}
            </div>
          );
        })}

        {pedidoMesaAberto && pedidoMesaAberto.totalItens > 0 && (
          <div className="cardapio-resumo">
            <h3>Comanda atual da mesa</h3>

            {pedidoMesaAberto.itens.map((item) => (
              <div
                key={`${item.nome}-${item.cliente}`}
                className="cardapio-resumo-item"
              >
                <span>
                  {item.qtd}x {item.nome} - {item.cliente}
                </span>
                <strong>R$ {formatarMoeda(item.preco * item.qtd)}</strong>
              </div>
            ))}

            <div className="cardapio-resumo-item">
              <span>Total consumido</span>
              <strong>R$ {formatarMoeda(pedidoMesaAberto.total)}</strong>
            </div>
          </div>
        )}

        {itensSelecionados.length > 0 && (
          <div className="cardapio-resumo">
            <h3>Resumo do pedido</h3>

            {itensSelecionados.map((item) => (
              <div key={item.produtoId} className="cardapio-resumo-item">
                <span>
                  {item.quantidade}x {item.nome}
                </span>
                <strong>
                  R$ {formatarMoeda(item.preco * item.quantidade)}
                </strong>
              </div>
            ))}
          </div>
        )}

        {mensagem && <p className="cardapio-mensagem">{mensagem}</p>}

        <div className="cardapio-footer">
          <div className="cardapio-total">
            <span>{itensSelecionados.length} itens</span>
            <strong className="cardapio-total-valor">
              R$ {formatarMoeda(total)}
            </strong>
          </div>

          <button
            className="cardapio-btn-principal"
            onClick={fazerPedido}
            disabled={enviando}
          >
            FINALIZAR PEDIDO
          </button>

          <button
            className="cardapio-btn-pagar"
            onClick={() => setMostrarModalPagamento(true)}
            disabled={enviando}
          >
            💳 Pedir conta / Pagar
          </button>
        </div>
      </div>
    </div>
  );
}

export default CardapioMesa;