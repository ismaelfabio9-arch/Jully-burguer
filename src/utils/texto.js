// Utilitários de texto compartilhados entre telas (Produtos, Categorias, etc.)

export function slugify(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatarMoeda(valor) {
  return Number(valor || 0).toFixed(2).replace(".", ",");
}
