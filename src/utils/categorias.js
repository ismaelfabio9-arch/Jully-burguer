// ============================================================
// utils/categorias.js
// Lógica central de categorias, compartilhada entre Produtos.jsx,
// MesaDetalhe.jsx e CardapioMesa.jsx — evita duplicar regras de
// ordenação/migração em cada tela.
// ============================================================

import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { slugify } from "./texto";

// Categoria virtual usada quando um produto fica sem categoria
// (ex: categoria excluída sem migração de produtos). Não existe
// como documento em "categorias", só é usada para agrupar/exibir.
export const SEM_CATEGORIA = "Sem categoria";

/**
 * Garante que a coleção "categorias" exista no Firebase.
 * Se estiver vazia e já existirem produtos, cria automaticamente
 * uma categoria para cada valor distinto de produto.categoria,
 * em ordem alfabética, preenchendo o campo "ordem".
 * Não apaga nem altera nenhum produto existente.
 */
export async function migrarCategoriasSeNecessario() {
  const categoriasSnap = await getDocs(collection(db, "categorias"));
  if (!categoriasSnap.empty) return;

  const produtosSnap = await getDocs(collection(db, "produtos"));
  if (produtosSnap.empty) return;

  const nomesUnicos = new Set();
  produtosSnap.docs.forEach((d) => {
    const categoria = (d.data().categoria || "").trim();
    if (categoria) nomesUnicos.add(categoria);
  });

  const nomesOrdenados = Array.from(nomesUnicos).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  if (nomesOrdenados.length === 0) return;

  const batch = writeBatch(db);

  nomesOrdenados.forEach((nome, index) => {
    const id = slugify(nome) || `categoria-${index}`;
    batch.set(
      doc(db, "categorias", id),
      {
        nome,
        ordem: index,
        ativo: true,
        criadoEm: serverTimestamp(),
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );
  });

  await batch.commit();
}

/**
 * Ordena uma lista de "grupos por categoria" (objetos com a chave
 * `categoria` = nome) de acordo com o campo `ordem` salvo na coleção
 * categorias. Categorias sem correspondência (ex: "Sem categoria")
 * vão para o final, na ordem em que aparecerem.
 */
export function ordenarGruposPorCategoria(grupos, categoriasDocs) {
  const ordemPorNome = {};
  categoriasDocs.forEach((c) => {
    ordemPorNome[c.nome] = typeof c.ordem === "number" ? c.ordem : 9999;
  });

  return [...grupos].sort((a, b) => {
    const ordemA = ordemPorNome[a.categoria] ?? 9999;
    const ordemB = ordemPorNome[b.categoria] ?? 9999;

    if (ordemA !== ordemB) return ordemA - ordemB;

    return a.categoria.localeCompare(b.categoria, "pt-BR");
  });
}

/** Cria uma nova categoria ao final da lista atual. */
export async function criarCategoria(nome, categoriasAtuais) {
  const nomeTratado = nome.trim();
  if (!nomeTratado) throw new Error("Nome da categoria é obrigatório.");

  const jaExiste = categoriasAtuais.some(
    (c) => c.nome.toLowerCase() === nomeTratado.toLowerCase()
  );
  if (jaExiste) throw new Error("Já existe uma categoria com esse nome.");

  const id = slugify(nomeTratado) || `categoria-${Date.now()}`;
  const maiorOrdem = categoriasAtuais.reduce(
    (max, c) => Math.max(max, typeof c.ordem === "number" ? c.ordem : 0),
    -1
  );

  const batch = writeBatch(db);
  batch.set(doc(db, "categorias", id), {
    nome: nomeTratado,
    ordem: maiorOrdem + 1,
    ativo: true,
    criadoEm: serverTimestamp(),
    atualizadoEm: new Date().toISOString(),
  });
  await batch.commit();

  return id;
}

/**
 * Renomeia uma categoria e atualiza em cascata todos os produtos
 * que referenciam o nome antigo (produtos guardam o nome, não o id).
 */
export async function renomearCategoria(categoria, novoNome) {
  const nomeTratado = novoNome.trim();
  if (!nomeTratado) throw new Error("Nome da categoria é obrigatório.");
  if (nomeTratado === categoria.nome) return;

  const produtosSnap = await getDocs(
    query(collection(db, "produtos"), where("categoria", "==", categoria.nome))
  );

  const batch = writeBatch(db);

  batch.update(doc(db, "categorias", categoria.id), {
    nome: nomeTratado,
    atualizadoEm: new Date().toISOString(),
  });

  produtosSnap.docs.forEach((produtoDoc) => {
    batch.update(doc(db, "produtos", produtoDoc.id), {
      categoria: nomeTratado,
      atualizadoEm: new Date().toISOString(),
    });
  });

  // Também atualiza o registro de estoque (guarda categoria só como referência de exibição)
  const estoqueSnap = await getDocs(
    query(collection(db, "estoque"), where("categoria", "==", categoria.nome))
  );
  estoqueSnap.docs.forEach((estoqueDoc) => {
    batch.update(doc(db, "estoque", estoqueDoc.id), {
      categoria: nomeTratado,
    });
  });

  await batch.commit();
}

/**
 * Exclui uma categoria.
 * `destino` controla o que fazer com os produtos que pertenciam a ela:
 *  - { tipo: "mover", categoriaDestino: "Bebidas" } -> move os produtos
 *  - { tipo: "sem-categoria" } -> produtos ficam com categoria "Sem categoria"
 * Nunca apaga produtos.
 */
export async function excluirCategoria(categoria, destino) {
  const produtosSnap = await getDocs(
    query(collection(db, "produtos"), where("categoria", "==", categoria.nome))
  );

  const batch = writeBatch(db);

  if (produtosSnap.size > 0) {
    const novoNome =
      destino?.tipo === "mover" ? destino.categoriaDestino : SEM_CATEGORIA;

    produtosSnap.docs.forEach((produtoDoc) => {
      batch.update(doc(db, "produtos", produtoDoc.id), {
        categoria: novoNome,
        atualizadoEm: new Date().toISOString(),
      });
    });
  }

  batch.delete(doc(db, "categorias", categoria.id));

  await batch.commit();
}

/** Move um produto para outra categoria (seletor ou drag). */
export async function moverProdutoParaCategoria(produtoId, novaCategoria) {
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, "produtos", produtoId), {
    categoria: novaCategoria,
    atualizadoEm: new Date().toISOString(),
  });
}

/**
 * Persiste uma nova ordem para a lista completa de categorias.
 * Recebe a lista já na ordem desejada e grava o índice de cada uma
 * no campo `ordem`.
 */
export async function salvarOrdemCategorias(categoriasOrdenadas) {
  const batch = writeBatch(db);

  categoriasOrdenadas.forEach((categoria, index) => {
    batch.update(doc(db, "categorias", categoria.id), {
      ordem: index,
      atualizadoEm: new Date().toISOString(),
    });
  });

  await batch.commit();
}

/**
 * Troca a posição real de duas categorias no Firebase.
 * Diferente de salvarOrdemCategorias(), não desloca as categorias
 * intermediárias: a categoria arrastada assume exatamente a posição
 * da categoria de destino e vice-versa.
 */
export async function trocarOrdemCategorias(categoriaA, categoriaB) {
  if (!categoriaA?.id || !categoriaB?.id || categoriaA.id === categoriaB.id) {
    return;
  }

  const ordemA = typeof categoriaA.ordem === "number" ? categoriaA.ordem : 9999;
  const ordemB = typeof categoriaB.ordem === "number" ? categoriaB.ordem : 9999;

  const batch = writeBatch(db);

  batch.update(doc(db, "categorias", categoriaA.id), {
    ordem: ordemB,
    atualizadoEm: new Date().toISOString(),
  });

  batch.update(doc(db, "categorias", categoriaB.id), {
    ordem: ordemA,
    atualizadoEm: new Date().toISOString(),
  });

  await batch.commit();
}

/** Troca duas categorias de posição (usado pelos botões subir/descer). */
export function trocarPosicao(lista, indiceA, indiceB) {
  if (indiceB < 0 || indiceB >= lista.length) return lista;

  const nova = [...lista];
  [nova[indiceA], nova[indiceB]] = [nova[indiceB], nova[indiceA]];
  return nova;
}
