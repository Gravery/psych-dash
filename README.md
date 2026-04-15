# PsychDash - Dashboard para Psicólogos 🧠

**PsychDash** é uma aplicação desktop moderna, segura e offline, projetada especificamente para psicólogos gerenciarem seus consultórios com eficiência. Desenvolvida com foco em privacidade e facilidade de uso, a ferramenta centraliza a gestão de pacientes, atendimentos e financeiro.

## 🚀 Principais Funcionalidades

- **Gestão de Pacientes**: Cadastro completo com Anamnese, histórico de prontuários e anexos de documentos.
- **Agenda Inteligente**: Visualização mensal das sessões com suporte a agendamentos recorrentes (semanal, quinzenal, mensal).
- **Controle Visual de Status**:
    - **Clínico**: Azul (Agendada), Verde (Realizada), Vermelho (Falta/Cancelada).
    - **Financeiro**: Indicador visual discreto ($) para sessões pagas e pendentes.
- **Prontuário Digital**: Registro de evoluções clínicas por sessão ou anotações manuais.
- **Exportação de Documentos**: Geração automática de Prontuários em PDF e Recibos/Cobranças Mensais.
- **Customização**: Modo Escuro (Dark Mode) e Modo Claro (Light Mode) com detecção automática do sistema.
- **Segurança Offline**: Banco de dados local (SQLite) garantindo que as informações nunca saiam do seu computador.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React.ts + Vite
- **Desktop**: Electron
- **Estilização**: Vanilla CSS (Modern Design System)
- **Banco de Dados**: SQLite (better-sqlite3)
- **Ícones**: Lucide React
- **Documentação**: jsPDF & jsPDF-autotable

## 📂 Estrutura do Projeto

- `src/components/`: Componentes da interface divididos por módulos (Auth, Calendar, Dashboard, Patients).
- `src/db/`: Lógica de comunicação com o banco de dados.
- `electron/`: Código principal do Electron (Main process & Preload).
- `public/`: Ativos estáticos.

## 🏗️ Guia de Desenvolvimento

### Pré-requisitos
- Node.js (Versão 18 ou superior)
- npm

### Instalação
```bash
npm install
```

### Rodar em Desenvolvimento
```bash
npm run electron:dev
```

## 📦 Geração de Build (Executável)

Para gerar o instalador profissional do Windows (`.exe`):

1. Execute o comando de build:
```bash
npm run electron:build
```
2. O instalador será gerado na pasta `dist_electron/` com o nome `PsychDash Setup 1.0.0.exe`.

---
*Desenvolvido para proporcionar uma experiência fluida e segura no cotidiano clínico.*
