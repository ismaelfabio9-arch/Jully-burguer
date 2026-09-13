import { Link, useLocation } from "react-router-dom";
import {
  X,
  LayoutGrid,
  ClipboardList,
  Table2,
  ShoppingBag,
  Package,
  History,
  Settings,
} from "lucide-react";

// Menu lateral compartilhado por todas as telas do painel (garçom/admin).
// No celular: escondido, abre com o botão ☰ (controlado por menuAberto/setMenuAberto).
// No desktop (>=1024px): sempre visível, fixo do lado esquerdo — ver App.css.
export default function MenuLateral({ menuAberto, setMenuAberto }) {
  const location = useLocation();

  function ativo(rota) {
    return location.pathname === rota ? "ativo" : "";
  }

  return (
    <>
      {menuAberto && (
        <div className="menu-overlay" onClick={() => setMenuAberto(false)} />
      )}

      <aside className={`menu-lateral ${menuAberto ? "aberto" : ""}`}>
        <div className="menu-lateral-topo">
          <h2>🍔 Jully Burguer</h2>
          <button
            className="menu-lateral-fechar"
            onClick={() => setMenuAberto(false)}
          >
            <X size={24} />
          </button>
        </div>

        <Link to="/" className={ativo("/")} onClick={() => setMenuAberto(false)}>
          <LayoutGrid size={20} />
          Painel
        </Link>

        <Link to="/pedidos" className={ativo("/pedidos")} onClick={() => setMenuAberto(false)}>
          <ClipboardList size={20} />
          Pedidos
        </Link>

        <Link to="/mesas" className={ativo("/mesas")} onClick={() => setMenuAberto(false)}>
          <Table2 size={20} />
          Mesas
        </Link>

        <Link to="/viagem" className={ativo("/viagem")} onClick={() => setMenuAberto(false)}>
          <ShoppingBag size={20} />
          Pedido Viagem
        </Link>

        <Link to="/produtos" className={ativo("/produtos")} onClick={() => setMenuAberto(false)}>
          <Package size={20} />
          Produtos
        </Link>

        <Link to="/estoque" className={ativo("/estoque")} onClick={() => setMenuAberto(false)}>
          📦
          <span>Estoque</span>
        </Link>

        <Link to="/historico" className={ativo("/historico")} onClick={() => setMenuAberto(false)}>
          <History size={20} />
          Histórico
        </Link>

        <Link to="/config" className={ativo("/config")} onClick={() => setMenuAberto(false)}>
          <Settings size={20} />
          Configurações
        </Link>
      </aside>
    </>
  );
}
