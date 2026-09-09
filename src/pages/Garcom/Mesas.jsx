import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { formatarMoeda } from "../../utils/texto";
import "../../styles/Garcom/Mesas.css";

const TOTAL_MESAS = 15;

/** Garante que toda mesa 1..15 tenha posicao/posicaoOriginal salvos no Firebase. */
async function garantirPosicoesMesas() {
  const snapshot = await getDocs(collection(db, "mesas"));
  const existentes = {};
  snapshot.docs.forEach((d) => {
    existentes[d.id] = d.data();
  });

  const batch = writeBatch(db);
  let precisaSalvar = false;

  for (let numero = 1; numero <= TOTAL_MESAS; numero++) {
    const dados = existentes[String(numero)];
    if (!dados || typeof dados.posicao !== "number") {
      precisaSalvar = true;
      batch.set(
        doc(db, "mesas", String(numero)),
        {
          numero,
          posicao: numero - 1,
          posicaoOriginal: numero - 1,
        },
        { merge: true }
      );
    }
  }

  if (precisaSalvar) await batch.commit();
}

function Mesas() {
  const [dadosMesas, setDadosMesas] = useState({}); // { numero: { cliente, posicao, posicaoOriginal } }
  const [pedidosPorMesa, setPedidosPorMesa] = useState({});
  const [modalCliente, setModalCliente] = useState(null);
  const [nomeCliente, setNomeCliente] = useState("");
  const [modoOrganizar, setModoOrganizar] = useState(false);
  const [arrastando, setArrastando] = useState(null); // numero da mesa sendo arrastada
  const [sobreNumero, setSobreNumero] = useState(null);
  const [posicaoArraste, setPosicaoArraste] = useState({ x: 0, y: 0 });
  const [adicionandoMesa, setAdicionandoMesa] = useState(false);

  const gridRef = useRef(null);
  const origemRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const elementoArrastadoRef = useRef(null);
  const totalMesasRef = useRef(TOTAL_MESAS);

  useEffect(() => {
    garantirPosicoesMesas().catch((erro) =>
      console.error("Erro ao inicializar posicoes das mesas:", erro)
    );

    const cancelarMesas = onSnapshot(collection(db, "mesas"), (snapshot) => {
      const dados = {};
      snapshot.docs.forEach((documento) => {
        const info = documento.data();
        dados[documento.id] = {
          cliente: info.cliente || "",
          posicao:
            typeof info.posicao === "number"
              ? info.posicao
              : Number(documento.id) - 1,
          posicaoOriginal:
            typeof info.posicaoOriginal === "number"
              ? info.posicaoOriginal
              : Number(documento.id) - 1,
        };
      });
      setDadosMesas(dados);

      const maiorNumero = Object.keys(dados).reduce(
        (max, numero) => Math.max(max, Number(numero)),
        TOTAL_MESAS
      );
      totalMesasRef.current = maiorNumero;
    });

    const cancelarPedidos = onSnapshot(collection(db, "pedidos"), (snapshot) => {
      const pedidos = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      const resultado = {};

      for (let i = 1; i <= totalMesasRef.current; i++) {
        const pedidosMesa = pedidos.filter(
          (pedido) => pedido.tipo === "mesa" && Number(pedido.mesa) === i
        );

        const total = pedidosMesa.reduce(
          (soma, pedido) => soma + Number(pedido.total || 0),
          0
        );

        const totalItens = pedidosMesa.reduce(
          (soma, pedido) => soma + Number(pedido.totalItens || 0),
          0
        );

        resultado[i] = {
          status: pedidosMesa.length > 0 ? "aberta" : "livre",
          total,
          totalItens,
        };
      }

      setPedidosPorMesa(resultado);
    });

    return () => {
      cancelarPedidos();
      cancelarMesas();
    };
  }, []);

  const totalMesas = Object.keys(dadosMesas).reduce(
    (max, numero) => Math.max(max, Number(numero)),
    TOTAL_MESAS
  );

  const mesas = Array.from({ length: totalMesas }, (_, i) => i + 1).map(
    (numero) => ({
      numero,
      cliente: dadosMesas[numero]?.cliente || "",
      posicao: dadosMesas[numero]?.posicao ?? numero - 1,
      status: pedidosPorMesa[numero]?.status || "livre",
      total: pedidosPorMesa[numero]?.total || 0,
      totalItens: pedidosPorMesa[numero]?.totalItens || 0,
    })
  );

  const mesasOrdenadas = [...mesas].sort((a, b) => a.posicao - b.posicao);

  async function adicionarMesa() {
    if (adicionandoMesa) return;
    setAdicionandoMesa(true);

    try {
      const novoNumero = totalMesas + 1;
      const maiorPosicao = mesas.reduce(
        (max, mesa) => Math.max(max, mesa.posicao),
        -1
      );

      await setDoc(
        doc(db, "mesas", String(novoNumero)),
        {
          numero: novoNumero,
          posicao: maiorPosicao + 1,
          posicaoOriginal: maiorPosicao + 1,
        },
        { merge: true }
      );
    } catch (erro) {
      console.error("Erro ao adicionar mesa:", erro);
    } finally {
      setAdicionandoMesa(false);
    }
  }

  function abrirModalCliente(e, mesa) {
    e.preventDefault();
    e.stopPropagation();

    setModalCliente(mesa.numero);
    setNomeCliente(mesa.cliente || "");
  }

  async function salvarNomeCliente() {
    if (!modalCliente) return;

    await setDoc(
      doc(db, "mesas", String(modalCliente)),
      {
        numero: modalCliente,
        cliente: nomeCliente.trim(),
      },
      { merge: true }
    );

    setModalCliente(null);
    setNomeCliente("");
  }

  async function trocarPosicoes(numeroA, numeroB) {
    if (numeroA === numeroB) return;

    const posA = dadosMesas[numeroA]?.posicao ?? numeroA - 1;
    const posB = dadosMesas[numeroB]?.posicao ?? numeroB - 1;

    const batch = writeBatch(db);
    batch.update(doc(db, "mesas", String(numeroA)), { posicao: posB });
    batch.update(doc(db, "mesas", String(numeroB)), { posicao: posA });
    await batch.commit();
  }

  // Drag via Pointer Events: funciona igual em mouse e touch, sem depender
  // da API HTML5 de drag-and-drop (que tem suporte ruim em navegadores mobile).
  function aoPressionar(e, mesa) {
    if (!modoOrganizar) return;

    const alvo = e.currentTarget;
    alvo.setPointerCapture(e.pointerId);

    const retangulo = alvo.getBoundingClientRect();
    origemRef.current = {
      x: e.clientX - retangulo.left,
      y: e.clientY - retangulo.top,
      width: retangulo.width,
      height: retangulo.height,
    };

    elementoArrastadoRef.current = alvo;
    setArrastando(mesa.numero);
    setPosicaoArraste({ x: retangulo.left, y: retangulo.top });
  }

  function aoMover(e) {
    if (arrastando === null) return;

    e.preventDefault();

    const novoLeft = e.clientX - origemRef.current.x;
    const novoTop = e.clientY - origemRef.current.y;
    setPosicaoArraste({ x: novoLeft, y: novoTop });

    const elementoAnterior = elementoArrastadoRef.current;
    if (elementoAnterior) elementoAnterior.style.pointerEvents = "none";

    const elementoEmbaixo = document.elementFromPoint(e.clientX, e.clientY);

    if (elementoAnterior) elementoAnterior.style.pointerEvents = "";

    const cartaoAlvo = elementoEmbaixo?.closest("[data-mesa-numero]");
    if (cartaoAlvo) {
      const numeroAlvo = Number(cartaoAlvo.dataset.mesaNumero);
      setSobreNumero(numeroAlvo === arrastando ? null : numeroAlvo);
    } else {
      setSobreNumero(null);
    }
  }

  async function aoSoltar() {
    if (arrastando === null) return;

    const numeroOrigem = arrastando;
    const numeroDestino = sobreNumero;

    setArrastando(null);
    setSobreNumero(null);
    elementoArrastadoRef.current = null;

    if (numeroDestino && numeroDestino !== numeroOrigem) {
      await trocarPosicoes(numeroOrigem, numeroDestino);
    }
  }

  return (
    <div className="container">
      {modalCliente && (
        <div className="modal-fechar-dia">
          <div className="modal-fechar-dia-card">
            <div className="modal-fechar-dia-icone">✏️</div>

            <h2>Nome do cliente</h2>

            <p>Identifique quem está usando a Mesa {modalCliente}.</p>

            <div className="produto-modal-form">
              <input
                placeholder="Ex: Allan"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                autoFocus
              />
            </div>

            <div className="modal-fechar-dia-botoes">
              <button
                className="modal-btn-cancelar"
                onClick={() => {
                  setModalCliente(null);
                  setNomeCliente("");
                }}
              >
                Cancelar
              </button>

              <button className="modal-btn-confirmar" onClick={salvarNomeCliente}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <Link to="/" className="voltar">
        ← Voltar
      </Link>

      <div className="mesas-header">
        <div>
          <span>Atendimento</span>
          <h1>Mesas</h1>
          <p>
            {modoOrganizar
              ? "Toque, segure e arraste uma mesa para trocar de posição."
              : "Visão geral das mesas do estabelecimento."}
          </p>
        </div>

        <div className="mesas-header-acoes">
          <button
            className={`mesas-btn-organizar ${modoOrganizar ? "ativo" : ""}`}
            onClick={() => setModoOrganizar((v) => !v)}
          >
            {modoOrganizar ? "✓ Concluir" : "✋ Organizar mesas"}
          </button>

          <button
            className="mesas-btn-adicionar"
            onClick={adicionarMesa}
            disabled={adicionandoMesa || modoOrganizar}
          >
            {adicionandoMesa ? "Adicionando..." : "+ Adicionar mesa"}
          </button>
        </div>
      </div>

      <div className="mesas-resumo">
        <div>
          <span>Abertas</span>
          <strong>{mesas.filter((m) => m.status === "aberta").length}</strong>
        </div>

        <div>
          <span>Livres</span>
          <strong>{mesas.filter((m) => m.status === "livre").length}</strong>
        </div>

        <div>
          <span>Total</span>
          <strong>{totalMesas}</strong>
        </div>
      </div>

      <div
        className={`grid-mesas ${modoOrganizar ? "modo-organizar" : ""}`}
        ref={gridRef}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        {mesasOrdenadas.map((mesa) => {
          const estaArrastando = arrastando === mesa.numero;
          const estaSobre = sobreNumero === mesa.numero;

          const conteudoCartao = (
            <div
              className={`mesa-card ${mesa.status} ${
                estaArrastando ? "arrastando" : ""
              } ${estaSobre ? "alvo-troca" : ""}`}
              data-mesa-numero={mesa.numero}
              style={
                estaArrastando
                  ? {
                      position: "fixed",
                      left: posicaoArraste.x,
                      top: posicaoArraste.y,
                      width: origemRef.current.width,
                      height: origemRef.current.height,
                      zIndex: 999,
                      boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                      touchAction: "none",
                    }
                  : modoOrganizar
                  ? { touchAction: "none" }
                  : undefined
              }
              onPointerDown={(e) => aoPressionar(e, mesa)}
            >
              <div className={`status-bolinha ${mesa.status}`}></div>

              <div className="mesa-nome-linha">
                <h3>
                  Mesa {mesa.numero}
                  {mesa.cliente ? ` - ${mesa.cliente}` : ""}
                </h3>

                {!modoOrganizar && (
                  <button
                    className="mesa-editar-cliente"
                    onClick={(e) => abrirModalCliente(e, mesa)}
                    title="Editar nome do cliente"
                  >
                    ✏️
                  </button>
                )}
              </div>

              <div className="mesa-icone">{modoOrganizar ? "⠿" : "🍽️"}</div>

              <p>R$ {formatarMoeda(mesa.total)}</p>

              <small>{mesa.totalItens} itens</small>
            </div>
          );

          if (modoOrganizar) {
            return <div key={mesa.numero}>{conteudoCartao}</div>;
          }

          return (
            <Link
              key={mesa.numero}
              to={`/mesa/${mesa.numero}`}
              style={{ textDecoration: "none" }}
            >
              {conteudoCartao}
            </Link>
          );
        })}
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

        <Link to="/mesas" className="ativo" style={{ textDecoration: "none" }}>
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

export default Mesas;
