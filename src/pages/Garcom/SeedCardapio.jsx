import React, { useState } from "react";
import { db } from "../../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const CATEGORIA = "Hambúrgueres";
const PRODUTOS = [
  { nome: "Hambúrguer", preco: 15.0, descricao: "Pão, um blend de 110g, salada e molho especial" },
  { nome: "X-Burguer", preco: 17.0, descricao: "Pão, um blend de 110g, queijo, salada e molho especial" },
  { nome: "Cheese Frango", preco: 17.0, descricao: "Pão, um blend de frango 110g, queijo, salada e molho especial" },
  { nome: "Cheese Frango Especial", preco: 22.0, descricao: "Pão, um blend de 110g, queijo, bacon, salada e molho especial" },
  { nome: "Cheese Calabresa", preco: 22.0, descricao: "Pão, um blend de 110g, calabresa em fatias, queijo, salada e molho especial" },
  { nome: "Cheese Bacon", preco: 22.0, descricao: "Pão, um blend de 110g, queijo, bacon, salada e molho especial" },
  { nome: "Duplo Bacon", preco: 27.0, descricao: "Pão, dois blend 110g, queijo, bacon, salada e molho especial" },
  { nome: "Duplo Creme Cheese", preco: 27.0, descricao: "Pão, dois blend 110g, creme cheese, salada e molho especial" },
  { nome: "Duplo Cheddar", preco: 27.0, descricao: "Pão, dois blend de 110g, queijo, molho cheddar, salada e molho especial" },
  { nome: "Cheese Picanha", preco: 28.0, descricao: "Pão, um blend de picanha 110g, queijo, salada e molho especial" },
  { nome: "Jully Especial", preco: 38.0, descricao: "Pão, dois blend de picanha 110g, queijo, salada e molho especial" },
  { nome: "Nordestino", preco: 38.0, descricao: "Pão, um blend de 110g, carne de sol de 110g, queijo coalho, mel, salada e molho especial" },
];

export default function SeedCardapio() {
  const [log, setLog] = useState([]);
  const [rodando, setRodando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  async function cadastrar() {
    setRodando(true);
    setLog([]);
    const linhas = [];

    for (const produto of PRODUTOS) {
      const id = slugify(`${CATEGORIA}-${produto.nome}`);
      try {
        await setDoc(
          doc(db, "produtos", id),
          {
            nome: produto.nome,
            categoria: CATEGORIA,
            preco: produto.preco,
            descricao: produto.descricao,
            ativo: true,
            criadoEm: serverTimestamp(),
          },
          { merge: true }
        );

        await setDoc(
          doc(db, "estoque", id),
          {
            nome: produto.nome,
            categoria: CATEGORIA,
            quantidade: 0,
            atualizadoEm: new Date().toISOString(),
          },
          { merge: true }
        );

        linhas.push({ ok: true, texto: `${produto.nome} — R$ ${produto.preco.toFixed(2)}` });
      } catch (erro) {
        linhas.push({ ok: false, texto: `${produto.nome}: ${erro.message}` });
      }
      setLog([...linhas]);
    }

    setRodando(false);
    setConcluido(true);
  }

  return (
    <div style={{ padding: 22, maxWidth: 480, margin: "0 auto", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>🍔 Popular cardápio</h1>
      <p style={{ fontSize: 14, color: "var(--muted, #6b7280)", marginBottom: 18 }}>
        Cadastra os 12 produtos do cardápio impresso direto no banco de dados.
        Página temporária — pode apagar depois de usar.
      </p>

      <button
        onClick={cadastrar}
        disabled={rodando || concluido}
        style={{
          background: "var(--brand, #F4C43D)",
          color: "var(--brand-text, #1A1200)",
          border: "none",
          padding: 16,
          borderRadius: 10,
          fontWeight: 700,
          fontSize: 16,
          width: "100%",
          opacity: rodando || concluido ? 0.6 : 1,
        }}
      >
        {concluido ? "Concluído ✔" : rodando ? "Cadastrando..." : "Cadastrar os 12 produtos"}
      </button>

      <div style={{ marginTop: 20, fontSize: 13, lineHeight: 1.7 }}>
        {log.map((linha, i) => (
          <div key={i} style={{ color: linha.ok ? "#3fae5c" : "var(--red, #F2445C)" }}>
            {linha.ok ? "✔" : "✖"} {linha.texto}
          </div>
        ))}
      </div>

      {concluido && (
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted, #6b7280)" }}>
          Pronto! Vai em <strong>Produtos</strong> no menu pra conferir.
        </p>
      )}
    </div>
  );
}
