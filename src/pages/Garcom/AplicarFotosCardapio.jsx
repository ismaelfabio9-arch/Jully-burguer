import React, { useState } from "react";
import { db, storage } from "../../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Mapeia cada foto (já enviada pelo dono da Jully Burguer) para o produto
// certo, por categoria + nome — não inventa fotos para produtos que não
// vieram nessa leva (ex: Refrigerante Litro não tem foto disponível ainda).
const FOTOS = [
  { categoria: "Hambúrgueres", nome: "Hambúrguer", arquivo: "hamburguer.jpg" },
  { categoria: "Hambúrgueres", nome: "X-Burguer", arquivo: "x-burguer.jpg" },
  { categoria: "Hambúrgueres", nome: "Cheese Frango", arquivo: "cheese-frango.jpg" },
  { categoria: "Hambúrgueres", nome: "Cheese Frango Especial", arquivo: "cheese-frango-especial.jpg" },
  { categoria: "Hambúrgueres", nome: "Cheese Calabresa", arquivo: "cheese-calabresa.jpg" },
  { categoria: "Hambúrgueres", nome: "Cheese Bacon", arquivo: "cheese-bacon.jpg" },
  { categoria: "Hambúrgueres", nome: "Duplo Bacon", arquivo: "duplo-bacon.jpg" },
  { categoria: "Hambúrgueres", nome: "Duplo Creme Cheese", arquivo: "duplo-creme-cheese.jpg" },
  { categoria: "Hambúrgueres", nome: "Duplo Cheddar", arquivo: "duplo-cheddar.jpg" },
  { categoria: "Hambúrgueres", nome: "Cheese Picanha", arquivo: "cheese-picanha.jpg" },
  { categoria: "Hambúrgueres", nome: "July Especial", arquivo: "july-especial.jpg" },
  { categoria: "Hambúrgueres", nome: "Nordestino", arquivo: "nordestino.jpg" },
  { categoria: "Porções", nome: "Porção de Batatas (300g)", arquivo: "foto_batata.jpg" },
  { categoria: "Bebidas", nome: "Refrigerante Lata", arquivo: "foto_refri_latas.jpg" },
  { categoria: "Bebidas", nome: "Água", arquivo: "foto_agua.jpg" },
  { categoria: "Bebidas", nome: "Água c/ gás", arquivo: "foto_agua_gas.jpg" },
  { categoria: "Bebidas", nome: "Limonada e H2O", arquivo: "foto_limonada.jpg" },
  { categoria: "Bebidas", nome: "Suco", arquivo: "foto_suco.jpg" },
];

export default function AplicarFotosCardapio() {
  const [log, setLog] = useState([]);
  const [rodando, setRodando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  async function aplicar() {
    setRodando(true);
    const linhas = [];
    setLog([]);

    if (!storage) {
      setLog([{ ok: false, texto: "Storage não está disponível — ative o Storage no Firebase primeiro." }]);
      setRodando(false);
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, "produtos"));
      const produtos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (produtos.length === 0) {
        linhas.push({ ok: false, texto: "Nenhum produto encontrado no banco — rode /seed-cardapio primeiro." });
        setLog([...linhas]);
      }

      for (const foto of FOTOS) {
        const produto = produtos.find(
          (p) => p.nome === foto.nome && p.categoria === foto.categoria
        );

        if (!produto) {
          linhas.push({ ok: false, texto: `${foto.nome}: produto não encontrado no cardápio (cadastre primeiro).` });
          setLog([...linhas]);
          continue;
        }

        try {
          const resposta = await fetch(`/fotos-produtos/${foto.arquivo}`);
          if (!resposta.ok) {
            throw new Error(`arquivo da foto não encontrado (status ${resposta.status})`);
          }
          const blob = await resposta.blob();

          const referencia = ref(storage, `produtos/${produto.id}.jpg`);
          await uploadBytes(referencia, blob);
          const url = await getDownloadURL(referencia);

          await updateDoc(doc(db, "produtos", produto.id), { imagem: url });

          linhas.push({ ok: true, texto: `${foto.nome} — foto aplicada` });
        } catch (erro) {
          linhas.push({ ok: false, texto: `${foto.nome}: ${erro.message}` });
        }
        setLog([...linhas]);
      }
    } catch (erroGeral) {
      linhas.push({ ok: false, texto: `Erro ao ler produtos do banco: ${erroGeral.message}` });
      setLog([...linhas]);
    } finally {
      setRodando(false);
      setConcluido(true);
    }
  }

  return (
    <div style={{ padding: 22, maxWidth: 480, margin: "0 auto", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>📷 Aplicar fotos do cardápio</h1>
      <p style={{ fontSize: 14, color: "var(--muted, #6b7280)", marginBottom: 18 }}>
        Sobe as fotos reais e vincula a cada produto já cadastrado (por nome + categoria).
        Página temporária — pode apagar depois de usar.
      </p>

      <button
        onClick={aplicar}
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
        {concluido ? "Concluído ✔" : rodando ? "Aplicando fotos..." : `Aplicar ${FOTOS.length} fotos`}
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
          Pronto! Confere no <strong>cardápio do cliente</strong> ou em <strong>Produtos</strong>.
        </p>
      )}
    </div>
  );
}
