import { BrowserRouter, Routes, Route } from "react-router-dom";

import { useEffect } from "react";
import "./App.css";
import Dashboard from "./pages/Garcom/Dashboard";
import MesaDetalhe from "./pages/Garcom/MesaDetalhe";
import Viagem from "./pages/Garcom/Viagem";
import Pedidos from "./pages/Garcom/Pedidos";
import Mesas from "./pages/Garcom/Mesas";
import Config from "./pages/Garcom/Config";
import ConfiguracaoImpressora from "./pages/Garcom/ConfiguracaoImpressora";
import ConectarImpressoraBluetooth from "./pages/Garcom/ConectarImpressoraBluetooth";
import Notificacoes from "./pages/Garcom/Notificacoes";
import Historico from "./pages/Garcom/Historico";
import Produtos from "./pages/Garcom/Produtos";
import HistoricoMesas from "./pages/Garcom/HistoricoMesas";
import RelatorioGerencial from "./pages/Garcom/RelatorioGerencial";
import CardapioMesa from "./pages/Cliente/CardapioMesa";
import Estoque from "./pages/Garcom/Estoque";


function App() {
 useEffect(() => {
  const tema = localStorage.getItem("tema");

  if (tema === "dark") {
    document.body.classList.add("dark");
  }
}, []);
  return (
    
    <BrowserRouter>
      <Routes>
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/mesa-cliente/:mesa" element={<CardapioMesa />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="/mesas" element={<Mesas />} />
        <Route path="/config" element={<Config />} />
        <Route path="/config/impressora" element={<ConfiguracaoImpressora />} />
        <Route
          path="/config/impressora/bluetooth"
          element={<ConectarImpressoraBluetooth />}
        />
        <Route path="/notificacoes" element={<Notificacoes />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/historico-mesas" element={<HistoricoMesas />} />
        <Route path="/relatorio" element={<RelatorioGerencial />} />
        <Route path="/mesa/:id" element={<MesaDetalhe />} />
        <Route path="/viagem" element={<Viagem />} />
        <Route path="/produtos" element={<Produtos />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;