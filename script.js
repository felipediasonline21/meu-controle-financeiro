import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// SUAS CHAVES DO FIREBASE CONFIGURADAS
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDriBRXuBvCgXs6oZyq5ah_LomvOXw_tTU",
  authDomain: "controle-financeiro-677ac.firebaseapp.com",
  databaseURL: "https://controle-financeiro-677ac-default-rtdb.firebaseio.com",
  projectId: "controle-financeiro-677ac",
  storageBucket: "controle-financeiro-677ac.firebasestorage.app",
  messagingSenderId: "344728121274",
  appId: "1:344728121274:web:2e2626e86446f56bd73783"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Variáveis de controle Globais
let dadosGlobais = {}; 
let editandoIndex = -1;
let usuarioLogadoUid = null; 
window.graficosInstancias = {}; 

// CONFIGURAÇÃO PADRÃO DO USUÁRIO
let userConfig = {
    tema: 'rosa',
    tipoCiclo: 'fatura',
    diaCorte: 15
};

// PALETAS DE CORES PARA OS GRÁFICOS
const paletasGrafico = {
    rosa: ['#ffb6c1', '#ff69b4', '#ff1493', '#db7093', '#c71585', '#ffc0cb', '#ff82ab', '#ff34b3', '#e066ff', '#da70d6'],
    azul: ['#87cefa', '#00bfff', '#1e90ff', '#4682b4', '#4169e1', '#b0e0e6', '#add8e6', '#87ceeb', '#6495ed', '#0000ff'],
    verde: ['#98fb98', '#90ee90', '#3cb371', '#2e8b57', '#228b22', '#00ff7f', '#00fa9a', '#66cdaa', '#8fbc8f', '#32cd32'],
    amarelo: ['#f0e68c', '#eedd82', '#ffd700', '#daa520', '#b8860b', '#ffebcd', '#ffe4b5', '#ffdab9', '#eee8aa', '#f5deb3']
};

// ==========================================
// CONTROLE DE LOGIN / LOGOUT
// ==========================================
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const formLogin = document.getElementById('formLogin');
const emailInput = document.getElementById('emailInput');
const senhaInput = document.getElementById('senhaInput');
const btnCriarConta = document.getElementById('btnCriarConta');
const btnSair = document.getElementById('btnSair');

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioLogadoUid = user.uid;
        loginScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        iniciarListenerBancoDeDados(); 
    } else {
        usuarioLogadoUid = null;
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
});

formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, emailInput.value, senhaInput.value)
        .catch((error) => alert("E-mail ou senha incorretos."));
});

btnCriarConta.addEventListener('click', () => {
    if (!emailInput.value || senhaInput.value.length < 6) {
        alert("Preencha seu e-mail e crie uma senha de no mínimo 6 caracteres para se registrar.");
        return;
    }
    createUserWithEmailAndPassword(auth, emailInput.value, senhaInput.value)
        .then(() => alert("Conta criada com sucesso!"))
        .catch((error) => alert("Erro ao criar conta: " + error.message));
});

btnSair.addEventListener('click', () => {
    signOut(auth).then(() => {
        dadosGlobais = {}; 
        userConfig = { tema: 'rosa', tipoCiclo: 'fatura', diaCorte: 15 };
        document.body.className = ''; 
        emailInput.value = ''; senhaInput.value = '';
    });
});

// ==========================================
// LÓGICA DO TEMA E CONFIGURAÇÕES
// ==========================================
const modalConfig = document.getElementById('modalConfig');
const btnConfig = document.getElementById('btnConfig');
const btnFecharConfig = document.getElementById('btnFecharConfig');
const btnSalvarConfig = document.getElementById('btnSalvarConfig');

const configTema = document.getElementById('configTema');
const configTipoCiclo = document.getElementById('configTipoCiclo');
const configDiaCorte = document.getElementById('configDiaCorte');
const grupoDiaCorte = document.getElementById('grupoDiaCorte');

btnConfig.addEventListener('click', () => {
    configTema.value = userConfig.tema;
    configTipoCiclo.value = userConfig.tipoCiclo;
    configDiaCorte.value = userConfig.diaCorte;
    grupoDiaCorte.style.display = userConfig.tipoCiclo === 'fatura' ? 'block' : 'none';
    modalConfig.style.display = 'flex';
});

btnFecharConfig.addEventListener('click', () => modalConfig.style.display = 'none');

configTipoCiclo.addEventListener('change', () => {
    grupoDiaCorte.style.display = configTipoCiclo.value === 'fatura' ? 'block' : 'none';
});

btnSalvarConfig.addEventListener('click', () => {
    let novoDia = parseInt(configDiaCorte.value);
    if (configTipoCiclo.value === 'fatura' && (isNaN(novoDia) || novoDia < 1 || novoDia > 31)) {
        alert("Digite um dia de corte válido (1 a 31).");
        return;
    }

    userConfig.tema = configTema.value;
    userConfig.tipoCiclo = configTipoCiclo.value;
    userConfig.diaCorte = configTipoCiclo.value === 'fatura' ? novoDia : 1;

    dadosGlobais.config = userConfig;
    salvarDadosNoBanco();
    aplicarTemaGlobal();
    
    cicloExibicao = obterCicloAtual();
    atualizarInterface();
    
    modalConfig.style.display = 'none';
});

function aplicarTemaGlobal() {
    document.body.className = '';
    if (userConfig.tema !== 'rosa') {
        document.body.classList.add(`theme-${userConfig.tema}`);
    }
}

// ==========================================
// LÓGICA DO PERÍODO
// ==========================================
function obterCicloAtual(dataAlvo = new Date()) {
    let ano = dataAlvo.getFullYear();
    let mes = dataAlvo.getMonth() + 1;
    let dia = dataAlvo.getDate();

    if (userConfig.tipoCiclo === 'fatura') {
        if (dia < userConfig.diaCorte) {
            mes -= 1;
            if (mes === 0) { mes = 12; ano -= 1; }
        }
    }
    return `${ano}-${String(mes).padStart(2, '0')}`;
}

function formatarCicloParaExibicao(chaveCiclo) {
    const [anoStr, mesStr] = chaveCiclo.split('-');
    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    if (userConfig.tipoCiclo === 'mensal') {
        return `${nomesMeses[parseInt(mesStr) - 1]} / ${anoStr}`;
    } else {
        let anoInicio = parseInt(anoStr);
        let mesInicio = parseInt(mesStr);
        let mesFim = mesInicio + 1;
        
        if (mesFim > 12) mesFim = 1;
        
        let diaIniStr = String(userConfig.diaCorte).padStart(2, '0');
        let diaFimCalc = userConfig.diaCorte - 1;
        if (diaFimCalc === 0) diaFimCalc = 30; 
        let diaFimStr = String(diaFimCalc).padStart(2, '0');

        return `${diaIniStr}/${String(mesInicio).padStart(2, '0')} - ${diaFimStr}/${String(mesFim).padStart(2, '0')}`;
    }
}

let cicloExibicao = obterCicloAtual();

// ==========================================
// LISTENER E BD (MÁXIMO 12 CICLOS)
// ==========================================
function iniciarListenerBancoDeDados() {
    const financasRef = ref(db, `financasGlobais/${usuarioLogadoUid}`);

    onValue(financasRef, (snapshot) => {
        dadosGlobais = snapshot.val() || {};
        
        if (dadosGlobais.config) {
            userConfig = dadosGlobais.config;
        } else {
            userConfig = { tema: 'rosa', tipoCiclo: 'fatura', diaCorte: 15 };
            dadosGlobais.config = userConfig;
        }
        
        aplicarTemaGlobal();
        cicloExibicao = obterCicloAtual();
        
        let precisaSalvarNoBanco = false;

        if (!dadosGlobais[cicloExibicao]) {
            dadosGlobais[cicloExibicao] = {
                totalReceita: 0, receitasCategorias: {}, totalFixas: 0, gastosCategorias: {},
                investimentos: {}, rendimentosTotais: 0, historico: []
            };
            precisaSalvarNoBanco = true;
        }

        const ciclos = Object.keys(dadosGlobais).filter(k => k !== 'config').sort();
        
        if (ciclos.length > 12) {
            const excesso = ciclos.length - 12;
            for (let i = 0; i < excesso; i++) {
                delete dadosGlobais[ciclos[i]]; 
            }
            precisaSalvarNoBanco = true;
        }

        if (precisaSalvarNoBanco) {
            set(financasRef, dadosGlobais); 
        } else {
            atualizarInterface();
        }
    });
}

function salvarDadosNoBanco() {
    if(usuarioLogadoUid) {
        set(ref(db, `financasGlobais/${usuarioLogadoUid}`), dadosGlobais);
    }
}

// ==========================================
// INTERFACE E RENDERIZAÇÃO DE GRÁFICOS
// ==========================================
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');

menuToggle.addEventListener('click', () => { sidebar.classList.toggle('aberta'); });
document.querySelector('.main-content').addEventListener('click', () => {
    if(window.innerWidth <= 768 && sidebar.classList.contains('aberta')) sidebar.classList.remove('aberta');
});

function renderizarGrafico(boxId, canvasId, labelsData, valoresData, coresData) {
    const box = document.getElementById(boxId);
    if(!box) return;

    if (window.graficosInstancias[canvasId]) {
        window.graficosInstancias[canvasId].destroy();
    }

    box.innerHTML = `<canvas id="${canvasId}"></canvas>`; 
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    let corPrincipal = getComputedStyle(document.body).getPropertyValue('--primary-color').trim();
    let corAcento = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
    
    if (!coresData) coresData = [corAcento, corPrincipal];

    window.graficosInstancias[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: { labels: labelsData, datasets: [{ data: valoresData, backgroundColor: coresData }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function atualizarInterface() {
    const dadosMes = dadosGlobais[cicloExibicao] || {};
    const ehCicloAtual = cicloExibicao === obterCicloAtual();
    const coresTema = paletasGrafico[userConfig.tema];
    
    document.getElementById('tituloMes').innerText = `Ciclo: ${formatarCicloParaExibicao(cicloExibicao)}`;
    document.getElementById('areaFormulario').style.display = ehCicloAtual ? 'flex' : 'none';
    document.getElementById('colAcoes').style.display = ehCicloAtual ? 'table-cell' : 'none';

    if (!ehCicloAtual && editandoIndex !== -1) cancelarEdicao();

    // ==========================================
    // GRÁFICO 1: TOTAL RECEBIDO (SOMA TOTAL 100%)
    // ==========================================
    // Agora o gráfico vai somar todas as receitas + rendimentos em uma única fatia.
    const totalGeralEntradas = (dadosMes.totalReceita || 0) + (dadosMes.rendimentosTotais || 0);

    renderizarGrafico('boxEntradas', 'graficoEntradas',
        totalGeralEntradas > 0 ? ['Total de Entradas'] : ['Sem recebimentos'],
        totalGeralEntradas > 0 ? [totalGeralEntradas] : [1],
        totalGeralEntradas > 0 ? [coresTema[coresTema.length - 1]] : ['#eee'] // Pega uma cor bonita do final da paleta
    );

    // ==========================================
    // GRÁFICO 2: RECEBIDO VS COMPROMETIDO
    // ==========================================
    const totalComprometido = calcularTotal(dadosMes.gastosCategorias || {}) + (dadosMes.totalFixas || 0);
    const sobra = Math.max(0, (dadosMes.totalReceita || 0) - totalComprometido);
    renderizarGrafico('boxReceitas', 'graficoReceitas', ['Comprometido', 'Sobra (Caixa Livre)'], [totalComprometido, sobra], null);

    // ==========================================
    // GRÁFICO 3: TOTAL DE SAÍDAS (DUAS VARIÁVEIS)
    // ==========================================
    // Aqui mantemos as duas fatias (Variáveis x Fixas) visíveis e clicáveis.
    const labelsSaidas = [];
    const dadosSaidas = [];
    const totalVariaveis = calcularTotal(dadosMes.gastosCategorias || {});
    const totalFixas = dadosMes.totalFixas || 0;

    if (totalVariaveis > 0) {
        labelsSaidas.push('Gastos Variáveis');
        dadosSaidas.push(totalVariaveis);
    }
    if (totalFixas > 0) {
        labelsSaidas.push('Contas Fixas');
        dadosSaidas.push(totalFixas);
    }

    const coresSaidas = labelsSaidas.length > 0 ? [coresTema[0], coresTema[3]] : ['#eee'];
    const labelFinalSaidas = labelsSaidas.length > 0 ? labelsSaidas : ['Sem despesas'];
    const dadosFinalSaidas = dadosSaidas.length > 0 ? dadosSaidas : [1];

    renderizarGrafico('boxSaidas', 'graficoSaidas', labelFinalSaidas, dadosFinalSaidas, coresSaidas);

    // ==========================================
    // GRÁFICO 4: DETALHAMENTO DE GASTOS E FIXAS
    // ==========================================
    const labelsGastos = [...Object.keys(dadosMes.gastosCategorias || {})];
    const dadosGastos = [...Object.values(dadosMes.gastosCategorias || {})];
    
    if((dadosMes.totalFixas || 0) > 0) {
        labelsGastos.push('Contas Fixas');
        dadosGastos.push(dadosMes.totalFixas);
    }

    const coresGastos = labelsGastos.length > 0 ? coresTema.slice(0, labelsGastos.length) : ['#eee'];
    const labelFinalGastos = labelsGastos.length > 0 ? labelsGastos : ['Sem gastos'];
    const dadosFinalGastos = dadosGastos.length > 0 ? dadosGastos : [1];

    renderizarGrafico('boxGastos', 'graficoGastos', labelFinalGastos, dadosFinalGastos, coresGastos);

    // ==========================================
    // GRÁFICO 5: INVESTIMENTOS TOTAIS
    // ==========================================
    const labelsInv = Object.keys(dadosMes.investimentos || {});
    const dadosInv = Object.values(dadosMes.investimentos || {});
    
    const coresInv = labelsInv.length > 0 ? coresTema.slice().reverse().slice(0, labelsInv.length) : ['#eee'];
    const labelFinalInv = labelsInv.length > 0 ? labelsInv : ['Sem investimentos'];
    const dadosFinalInv = dadosInv.length > 0 ? dadosInv : [1];

    renderizarGrafico('boxInvestimentos', 'graficoInvestimentos', labelFinalInv, dadosFinalInv, coresInv);

    renderizarMenuMeses();
    renderizarHistorico();
}

function renderizarHistorico() {
    const tbody = document.getElementById('corpoHistorico');
    tbody.innerHTML = '';
    const historico = dadosGlobais[cicloExibicao]?.historico || [];
    const ehCicloAtual = cicloExibicao === obterCicloAtual();

    if (historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum lançamento neste ciclo.</td></tr>';
        return;
    }

    for (let i = historico.length - 1; i >= 0; i--) {
        const item = historico[i];
        const tr = document.createElement('tr');
        
        let corTexto = '';
        let prefixo = '';

        // CORES ESTILIZADAS E UNIVERSAIS DO EXTRATO
        if (item.tipo === 'gasto' || item.tipo === 'fixa') {
            corTexto = '#e63946'; // Vermelho (Gastos)
            prefixo = '- ';
        } else if (item.tipo === 'investimento') {
            corTexto = '#4169e1'; // Azul (Investimentos)
            prefixo = '  '; 
        } else if (item.tipo === 'receita' || item.tipo === 'rendimento') {
            corTexto = '#2e8b57'; // Verde (Entradas)
            prefixo = '+ ';
        } else {
            corTexto = '#4a4a4a'; // Neutro caso haja erro
        }
        
        let acoesHtml = '';
        if (ehCicloAtual) {
            acoesHtml = `
                <td style="text-align: center;">
                    <button class="btn-acao" onclick="editarItem(${i})" title="Editar Lançamento">✏️</button>
                    <button class="btn-acao" onclick="deletarItem(${i})" title="Excluir Lançamento">🗑️</button>
                </td>
            `;
        }

        tr.innerHTML = `
            <td>${item.data}</td>
            <td style="text-transform: capitalize;">${item.tipo}</td>
            <td>${item.descricao}</td>
            <td style="color: ${corTexto}; font-weight: bold;">${prefixo}R$ ${item.valor.toFixed(2)}</td>
            ${acoesHtml}
        `;
        tbody.appendChild(tr);
    }
}

function reverterValores(item) {
    const dadosCiclo = dadosGlobais[cicloExibicao];
    if (item.tipo === 'receita') {
        dadosCiclo.totalReceita -= item.valor;
        if(dadosCiclo.receitasCategorias) {
            dadosCiclo.receitasCategorias[item.descricao] -= item.valor;
            if (dadosCiclo.receitasCategorias[item.descricao] <= 0.01) delete dadosCiclo.receitasCategorias[item.descricao];
        }
    }
    else if (item.tipo === 'fixa') dadosCiclo.totalFixas -= item.valor;
    else if (item.tipo === 'gasto') {
        dadosCiclo.gastosCategorias[item.descricao] -= item.valor;
        if (dadosCiclo.gastosCategorias[item.descricao] <= 0.01) delete dadosCiclo.gastosCategorias[item.descricao];
    } else if (item.tipo === 'investimento') {
        dadosCiclo.investimentos[item.descricao] -= item.valor;
        if (dadosCiclo.investimentos[item.descricao] <= 0.01) delete dadosCiclo.investimentos[item.descricao];
    } else if (item.tipo === 'rendimento') {
        dadosCiclo.investimentos[item.descricao] -= item.valor;
        dadosCiclo.rendimentosTotais -= item.valor;
        if (dadosCiclo.investimentos[item.descricao] <= 0.01) delete dadosCiclo.investimentos[item.descricao];
    }
}

window.deletarItem = function(index) {
    if (cicloExibicao !== obterCicloAtual()) return; 
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

    const dadosCiclo = dadosGlobais[cicloExibicao];
    reverterValores(dadosCiclo.historico[index]);
    dadosCiclo.historico.splice(index, 1);
    
    salvarDadosNoBanco();
};

window.editarItem = function(index) {
    if (cicloExibicao !== obterCicloAtual()) return; 
    
    const item = dadosGlobais[cicloExibicao].historico[index];
    document.getElementById('tipo').value = item.tipo;
    document.getElementById('descricao').value = item.descricao;
    document.getElementById('valor').value = item.valor;
    editandoIndex = index;
    
    document.getElementById('tituloFormulario').innerText = "Editando Transação...";
    document.getElementById('btnSubmit').innerText = "Salvar Alteração";
    document.querySelector('.main-content').scrollTo(0, 0);
};

function cancelarEdicao() {
    editandoIndex = -1;
    document.getElementById('tituloFormulario').innerText = "Adicionar Nova Transação";
    document.getElementById('btnSubmit').innerText = "Adicionar";
    document.getElementById('descricao').value = '';
    document.getElementById('valor').value = '';
}

function renderizarMenuMeses() {
    const lista = document.getElementById('listaMeses');
    lista.innerHTML = '';
    
    const ciclos = Object.keys(dadosGlobais).filter(k => k !== 'config').sort().reverse();

    ciclos.forEach(ciclo => {
        const btn = document.createElement('button');
        btn.className = `mes-btn ${ciclo === cicloExibicao ? 'ativo' : ''}`;
        btn.innerText = formatarCicloParaExibicao(ciclo);
        btn.onclick = () => {
            cicloExibicao = ciclo;
            atualizarInterface();
            if(window.innerWidth <= 768) sidebar.classList.remove('aberta');
        };
        lista.appendChild(btn);
    });
}

function calcularTotal(objeto) { return Object.values(objeto).reduce((acc, curr) => acc + curr, 0); }

document.getElementById('formTransacao').addEventListener('submit', function(e) {
    e.preventDefault();

    const tipo = document.getElementById('tipo').value;
    const descricao = document.getElementById('descricao').value;
    const valor = parseFloat(document.getElementById('valor').value);
    
    const dadosCiclo = dadosGlobais[obterCicloAtual()];
    dadosCiclo.receitasCategorias = dadosCiclo.receitasCategorias || {};
    dadosCiclo.gastosCategorias = dadosCiclo.gastosCategorias || {};
    dadosCiclo.investimentos = dadosCiclo.investimentos || {};
    dadosCiclo.historico = dadosCiclo.historico || [];

    if (editandoIndex !== -1) {
        reverterValores(dadosCiclo.historico[editandoIndex]);
        dadosCiclo.historico[editandoIndex].tipo = tipo;
        dadosCiclo.historico[editandoIndex].descricao = descricao;
        dadosCiclo.historico[editandoIndex].valor = valor;
    } else {
        const dataObj = new Date();
        const dataFormatada = `${String(dataObj.getDate()).padStart(2, '0')}/${String(dataObj.getMonth()+1).padStart(2, '0')}`;
        dadosCiclo.historico.push({ data: dataFormatada, tipo: tipo, descricao: descricao, valor: valor });
    }

    if (tipo === 'receita') {
        dadosCiclo.totalReceita = (dadosCiclo.totalReceita || 0) + valor;
        dadosCiclo.receitasCategorias[descricao] = (dadosCiclo.receitasCategorias[descricao] || 0) + valor;
    }
    else if (tipo === 'fixa') dadosCiclo.totalFixas = (dadosCiclo.totalFixas || 0) + valor;
    else if (tipo === 'gasto') dadosCiclo.gastosCategorias[descricao] = (dadosCiclo.gastosCategorias[descricao] || 0) + valor;
    else if (tipo === 'investimento') dadosCiclo.investimentos[descricao] = (dadosCiclo.investimentos[descricao] || 0) + valor;
    else if (tipo === 'rendimento') {
        dadosCiclo.investimentos[descricao] = (dadosCiclo.investimentos[descricao] || 0) + valor;
        dadosCiclo.rendimentosTotais = (dadosCiclo.rendimentosTotais || 0) + valor;
    }

    salvarDadosNoBanco();
    cancelarEdicao();
    document.getElementById('descricao').focus();
});