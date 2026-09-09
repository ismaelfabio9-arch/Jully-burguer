# Atualização — Categorias, Mesas e Impressão

Este documento resume o que foi implementado em cima do projeto existente.
Nada do sistema atual foi recriado — só foram adicionadas telas, coleções e
funções novas, reaproveitando componentes, estilos e a estrutura já existente.

## 1. Categorias administráveis

Nova coleção no Firestore: **`categorias`**
```
categorias/{id}
  nome: string
  ordem: number
  ativo: boolean
  criadoEm: timestamp
  atualizadoEm: string (ISO)
```

- Se a coleção não existir ainda, o sistema cria automaticamente uma
  categoria para cada categoria já usada nos produtos (ordem alfabética
  inicial). **Nenhum produto é apagado ou alterado** nessa migração.
- Tela **Produtos → 🗂️ (Gerenciar categorias)**: criar, renomear, excluir,
  reordenar (setas ▲▼ ou arrastar com o dedo/mouse).
- Renomear uma categoria atualiza automaticamente todos os produtos que
  pertenciam a ela (produtos guardam o *nome* da categoria, não só o id).
- Excluir uma categoria com produtos nunca apaga os produtos: você escolhe
  entre mover para outra categoria ou deixá-los como "Sem categoria".
- Cada produto agora tem um seletor de categoria na listagem (Produtos),
  permitindo trocar a categoria de um produto sem apagar preço/estoque/ID.
- A ordem das categorias é respeitada em **Produtos**, **Mesa (comanda do
  garçom)** e **cardápio do cliente** — não mais ordem alfabética.

## 2. Mesas: organização visual com o dedo

Coleção `mesas` ganhou dois campos novos:
```
mesas/{numero}
  posicao: number         // posição visual atual na grade
  posicaoOriginal: number // posição "de fábrica", nunca muda sozinha
```

- Botão **"✋ Organizar mesas"** na tela Mesas ativa o modo de arrastar.
- Arrastar funciona com **Pointer Events** (não é o drag-and-drop HTML5
  clássico, que funciona mal em navegadores mobile) — por isso funciona
  igual com o dedo no celular e com o mouse no computador.
- Ao soltar uma mesa em cima de outra, as duas **trocam de posição**
  (nunca fica posição duplicada nem mesa "sumida").
- A identidade da mesa (número, pedidos, cliente) nunca muda — só a
  posição visual na grade.
- A posição é salva direto no Firebase (não em localStorage), então
  sobrevive a atualizar a página, fechar o navegador ou trocar de aparelho.
- Ao clicar em **Encerrar Dia** (Configurações), todas as mesas voltam
  automaticamente para a posição original. Isso não mexe em pedidos,
  histórico, faturamento nem produtos — só no campo `posicao`.

## 3. Impressão — o que foi feito e a limitação real do hardware

**Leia esta seção antes de prometer "impressão automática" ao cliente.**

Modelo confirmado pela etiqueta do aparelho: **Baihuo City MY-7779**, térmica
portátil de 58mm, bateria de lítio 2000mAh, impressão térmica direta.

Esse modelo é vendido junto com um app chamado **Eleph-Label** (Shenzhen
Elabel Software) — que é um app de **design e impressão de etiquetas/código
de barras**, não um app genérico de recibos/comandas via ESC/POS (o padrão
que a maioria dos sistemas de PDV usa para imprimir automaticamente pelo
navegador). Não encontrei nenhuma documentação pública de SDK/API do
Eleph-Label para integração de terceiros, então **não implementei uma
integração direta com essa impressora** — seria inventar um protocolo sem
confirmação, e há uma chance real de não funcionar.

Além disso, a API Web Bluetooth dos navegadores só fala com dispositivos
BLE, não com Bluetooth clássico (SPP), que é o que a maioria dessas
impressoras portáteis usa — então o navegador nunca teria acesso direto a
ela de qualquer forma, independente do protocolo interno da impressora.

**Teste rápido antes de decidir qualquer coisa (5 minutos, sem gastar
nada):**
1. Pareie a Baihuo MY-7779 no Bluetooth do celular do garçom (fora de
   qualquer app, direto nas configurações do Android).
2. Instale um app genérico como "ESC POS Bluetooth Print Service", "Thermer"
   ou "RawBT" (Play Store) — eles se registram no menu de impressão do
   Android.
3. No sistema, vá em **Config → Impressora → Testar impressão** e, no
   diálogo de impressão do navegador, escolha esse serviço.
4. **Se sair impresso corretamente**: a impressora aceita ESC/POS por baixo
   do capô, mesmo vindo com o app de etiquetas — o sistema abaixo já
   funciona 100% como está, sem precisar de nenhuma mudança de código.
5. **Se não sair (ou sair ilegível)**: essa impressora provavelmente só
   funciona de verdade com o app proprietário Eleph-Label, e não há forma
   confiável de integrá-la automaticamente ao sistema web sem documentação
   oficial do fabricante. Nesse caso, a saída mais prática é trocar por uma
   impressora anunciada explicitamente como **"ESC/POS"** (tem opções de
   ~R$100–150 no Mercado Livre/Shopee) — todo o resto do sistema (geração
   de comanda, comprovante, config de impressora) já está pronto e
   funcionaria imediatamente com qualquer impressora desse tipo, sem
   reescrever nada.

A implementação abaixo (comanda/comprovante via `window.print()`) foi feita
dessa forma justamente porque funciona com **qualquer** impressora térmica
que o navegador enxergue como impressora do sistema — ela não depende do
modelo específico, só depende de o aparelho ter um serviço de impressão
compatível instalado.

### Conexão direta via Web Bluetooth (sem instalar app) — `Config → Impressora → 🔗 Bluetooth`

Além do `window.print()`, foi adicionada uma tela experimental que conecta
com a impressora **direto do navegador**, sem precisar de nenhum app
externo no celular:

- `src/utils/bluetoothPrinter.js` — usa a Web Bluetooth API do navegador
  (`navigator.bluetooth`) para parear e listar todos os serviços e
  características GATT que a impressora expõe.
- `src/pages/Garcom/ConectarImpressoraBluetooth.jsx` — tela de diagnóstico:
  mostra o que foi encontrado e tem um botão de "Testar impressão
  (experimental)" que tenta enviar um texto simples em ESC/POS básico.

**Isso é diagnóstico real, não é garantia de impressão perfeita.** A
impressora Baihuo MY-7779 usa BLE (não Bluetooth clássico, como eu tinha
avaliado antes) — então a conexão em si funciona sem app. O que não está
confirmado é o protocolo exato de impressão dela (ela usa o app
proprietário Eleph-Label, sem SDK público documentado). Por isso a tela:
1. Conecta de verdade e mostra os serviços/características reais da sua
   impressora (isso sempre funciona, é só descoberta).
2. Tenta um teste simples de texto ESC/POS — pode sair certo, pode sair
   ilegível, ou pode não sair nada, dependendo do protocolo real.
3. Se o teste não funcionar, me mande a lista de serviços/características
   que aparecer na tela (print ou copiar o texto) — com isso eu escrevo o
   protocolo de impressão exato, em vez de adivinhar.

**Requisito importante:** a Web Bluetooth API só funciona em conexão seial
segura — `https://` ou `localhost`. Não funciona acessando o sistema pelo
IP da rede local em `http://` (ex: `http://192.168.0.x:3000`). Para testar
no celular de verdade, o sistema precisa estar publicado com HTTPS
(Firebase Hosting, Vercel, Netlify etc. já entregam isso automaticamente).


### Documento 1 — Comanda (`utils/print.js` → `gerarComandaHTML`)
Gerada ao salvar um pedido na mesa (Mesa → "Imprimir comanda da mesa", ou
automaticamente se a opção estiver ligada em Config → Impressora).

### Documento 2 — Comprovante (`utils/print.js` → `gerarComprovanteHTML`)
Gerado no fluxo de **Encerrar Mesa**, que agora pergunta:
- **Emitir comprovante** → escolhe forma de pagamento → imprime → finaliza
- **Encerrar sem comprovante** → finaliza direto
- **Cancelar**

O comprovante é rotulado como "Comprovante de consumo — não é documento
fiscal", para não ser confundido com nota fiscal/NFC-e (a impressora atual
não tem integração fiscal).

### Configuração — `Config → 🖨️ Impressora`
Nova coleção `configuracoes/impressora`:
```
configuracoes/impressora
  habilitada: boolean
  autoImprimirPedido: boolean
  autoImprimirComprovante: boolean
  larguraPapel: "58mm" | "80mm"
  nomeEstabelecimento: string
  endereco: string
  telefone: string
  mensagemRodape: string
```

### Impressão duplicada
A impressão da comanda acontece em resposta a uma ação explícita (salvar
pedido / clicar em "imprimir comanda"), não a atualizações do Firestore —
então uma comanda não é reimpressa sozinha quando o pedido é atualizado.
O botão manual de imprimir comanda também tem um controle de sessão que
evita reimprimir o mesmo total duas vezes seguidas por engano.

## Arquivos novos
- `src/utils/texto.js` — slugify/formatação de moeda compartilhados
- `src/utils/categorias.js` — migração, CRUD e reordenação de categorias
- `src/utils/print.js` — geração de comanda/comprovante e impressão
- `src/hooks/useConfigImpressora.js` — leitura em tempo real da config
- `src/pages/Garçom/ConfiguracaoImpressora.jsx` + `.css` — nova tela
- Rota nova: `/config/impressora`

## Compatibilidade
Painel, Pedidos, Estoque, Notificações, Histórico, Histórico de Mesas,
Relatório Gerencial, tema escuro, cardápio do cliente, chamar garçom e
pedir conta continuam funcionando exatamente como antes — nada foi
removido.

## 4. Painel sincronizado com a ordem das mesas + reordenar produtos + renomear

- **Painel**: agora usa o mesmo campo `posicao` da coleção `mesas` que a
  tela Mesas já usava. Botão **"✋ Organizar"** no Painel liga o mesmo modo
  de arrastar (Pointer Events) — mexer na ordem em um lugar reflete no
  outro, porque os dois leem/escrevem o mesmo campo no Firebase.
- **Mesa → Adicionar pedido**: dentro de cada categoria aberta, botão
  **"↕ Organizar"** troca os controles de quantidade por setas ▲▼ para
  mover produtos de posição. Usa um novo campo `produtos/{id}.ordem`.
- Essa mesma ordem (`ordem`) é respeitada em **Produtos** e **Estoque**,
  então o cardápio fica visualmente igual nas três telas.
- **Renomear produto**: em Produtos e Estoque, toque no nome do produto
  para editar. Valida nome vazio e nome duplicado na mesma categoria, e
  salva em `produtos` e `estoque` juntos (`writeBatch`) para nunca ficar
  com nomes diferentes entre as duas coleções.

### Arquivos novos (item 4)
- `src/utils/produtosOrdem.js` — ordenação e reordenação de itens dentro
  de uma categoria de produto
