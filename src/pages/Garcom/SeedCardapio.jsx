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
  { categoria: CATEGORIA, nome: "Hambúrguer", preco: 15.0, descricao: "Pão, um blend de 110g, salada e molho especial" },
  { categoria: CATEGORIA, nome: "X-Burguer", preco: 17.0, descricao: "Pão, um blend de 110g, queijo, salada e molho especial" },
  { categoria: CATEGORIA, nome: "Cheese Frango", preco: 17.0, descricao: "Pão, um blend de frango 110g, queijo, salada e molho especial" },
  { categoria: CATEGORIA, nome: "Cheese Frango Especial", preco: 22.0, descricao: "Pão, um blend de 110g, queijo, bacon, salada e molho especial" },
  { categoria: CATEGORIA, nome: "Cheese Calabresa", preco: 22.0, descricao: "Pão, um blend de 110g, calabresa em fatias, queijo, bacon, salada e molho especial" },
  { categoria: CATEGORIA, nome: "Cheese Bacon", preco: 22.0, descricao: "Pão, um blend de 110g, queijo, bacon, salada e molho especial" },
  { categoria: CATEGORIA, nome: "Duplo Bacon", preco: 27.0, descricao: "Pão, dois blend 110g, queijo, bacon, salada e molho especial" },
  { categoria: CATEGORIA, nome: "Duplo Creme Cheese", preco: 27.0, descricao: "Pão, dois blend 110g, creme cheese, salada e molho especial" },
  { categoria: CATEGORIA, nome: "Duplo Cheddar", preco: 27.0, descricao: "Pão, dois blends de 110g, queijo, molho cheddar, salada e molho especial" },
  { categoria: CATEGORIA, nome: "Cheese Picanha", preco: 30.0, descricao: "Pão, um blend de picanha 110g, queijo, salada e molho especial" },
  { categoria: CATEGORIA, nome: "July Especial", preco: 40.0, descricao: "Pão, um blend de picanha 110g, queijo, salada e molho especial" },
  { categoria: CATEGORIA, nome: "Nordestino", preco: 40.0, descricao: "Pão, blend de 110g, carne de sol de 110g, queijo coalho, mel, salada e molho especial" },

  { categoria: "Porções", nome: "Porção de Batatas (300g)", preco: 14.0, descricao: "Porção de batatas fritas crocantes" },

  { categoria: "Bebidas", nome: "Refrigerante Lata", preco: 6.0, descricao: "" },
  { categoria: "Bebidas", nome: "Refrigerante Litro", preco: 10.0, descricao: "" },
  { categoria: "Bebidas", nome: "Água", preco: 2.5, descricao: "" },
  { categoria: "Bebidas", nome: "Água c/ gás", preco: 4.0, descricao: "" },
  { categoria: "Bebidas", nome: "Limonada e H2O", preco: 7.0, descricao: "" },
  { categoria: "Bebidas", nome: "Suco", preco: 6.0, descricao: "" },
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
      const id = slugify(`${produto.categoria}-${produto.nome}`);
      try {
        await setDoc(
          doc(db, "produtos", id),
          {
            nome: produto.nome,
            categoria: produto.categoria,
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
            categoria: produto.categoria,
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
