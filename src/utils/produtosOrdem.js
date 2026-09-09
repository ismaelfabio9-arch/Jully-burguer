import { doc, writeBatch } from "firebase/firestore";

// Ordena os itens de uma categoria pelo campo "ordem" (posição escolhida
// manualmente pelo garçom/gerente). Itens sem "ordem" ainda definida caem
// no fim, ordenados por preço (comportamento original do sistema).
export function ordenarItensCategoria(itens) {
  return [...itens].sort((a, b) => {
    const ordemA = a.ordem;
    const ordemB = b.ordem;

    if (ordemA !== undefined && ordemB !== undefined && ordemA !== ordemB) {
      return ordemA - ordemB;
    }

    if (ordemA !== undefined && ordemB === undefined) return -1;
    if (ordemB !== undefined && ordemA === undefined) return 1;

    const precoA = Number(a.preco) || 0;
    const precoB = Number(b.preco) || 0;

    if (precoA !== precoB) return precoA - precoB;

    return (a.nome || "").localeCompare(b.nome || "");
  });
}

// Move um item para cima ou para baixo dentro da categoria e grava a nova
// ordem de TODOS os itens dela (evita ficar com ordem parcial/inconsistente
// entre Produtos, Estoque e a tela da Mesa).
export async function moverItemCategoria(db, itensOrdenados, indiceAtual, direcao) {
  const novoIndice = indiceAtual + direcao;

  if (novoIndice < 0 || novoIndice >= itensOrdenados.length) return;

  const lista = [...itensOrdenados];
  const [item] = lista.splice(indiceAtual, 1);
  lista.splice(novoIndice, 0, item);

  const batch = writeBatch(db);

  lista.forEach((itemDaLista, indice) => {
    batch.set(
      doc(db, "produtos", itemDaLista.id),
      { ordem: indice },
      { merge: true }
    );
  });

  await batch.commit();
}
