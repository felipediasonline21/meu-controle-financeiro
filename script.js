import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// CONFIGURAÇÃO DO FIREBASE COM AS SUAS CHAVES
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

// ==========================================
// CONTROLE DE LOGIN / LOGOUT (E-MAIL E SENHA)
// ==========================================
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const formLogin = document.getElementById('formLogin');
const emailInput = document.getElementById('emailInput');
const senhaInput = document.getElementById('senhaInput');
const btnCriarConta = document.getElementById('btnCriarConta');
const btnSair = document.getElementById('btnSair');

// Listener: Observa se o usuário entrou ou saiu
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

// Ação de Entrar (Login)
formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const senha = senhaInput.value;
    
    signInWithEmailAndPassword(auth, email, senha)
        .catch((error) => {
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                alert("E-mail ou senha incorretos.");
            } else {
                alert("Erro ao entrar: " + error.message);
            }
        });
});

// Ação de Criar Conta
btnCriarConta.addEventListener('click', () => {
    const email = emailInput.value;
    const senha = senhaInput.value;
    
    if (!email || senha.length < 6) {
        alert("Preencha seu e-mail e crie uma senha de no mínimo 6 caracteres para se registrar.");
        return;
    }

    createUserWithEmailAndPassword(auth, email, senha)
        .then(() => {
            alert("Conta criada com sucesso! Bem-vindo(a).");
        })
        .catch((error) => {
            if (error.code === 'auth/email-already-in-use') {
                alert("Este e-mail já possui uma conta. Por favor, clique em 'Entrar'.");
            } else {
                alert("Erro ao criar conta: " + error.message);
            }
        });
});

// Ação de Sair
btnSair.addEventListener('click', () => {
    signOut(auth).then(() => {
        dadosGlobais = {}; 
        emailInput.value = '';
        senhaInput.value = '';
    }).catch((error) => {
        alert("Erro ao sair: " + error.message);
    });
});

// ==========================================
// LÓGICA DO CICLO E RESTANTE DO CÓDIGO
// ==========================================
function obterCicloAtual() {
    const data = new Date();
    let ano = data.getFullYear();
    let mes = data.getMonth() + 1;
    let dia = data.getDate();

    if (dia < 15) {
        mes -= 1;
        if (mes === 0) { mes = 12; ano -= 1; }
    }
    return `${ano}-${String(mes).padStart(2, '0')}`;
}

function formatarCicloParaExibicao(chaveCiclo) {
    const [anoStr, mesStr] = chaveCiclo.split('-');
    let anoInicio = parseInt(anoStr);
    let mesInicio = parseInt(mesStr);
    let mesFim = mesInicio + 1;
    let anoFim = anoInicio;
    
    if (mesFim > 12) { mesFim = 1; anoFim += 1; }

    const strMesInicio = String(mesInicio).padStart(2, '0');
    const strMesFim = String(mesFim).padStart(2, '0');
    return `15/${strMesInicio} - 14/${strMesFim}`;
}

let cicloExibicao = obterCicloAtual();

function iniciarListenerBancoDeDados() {
    const financasRef = ref(db, `financasGlobais/${usuarioLogadoUid}`);

    onValue(financasRef, (snapshot) => {
        dadosGlobais = snapshot.val() || {};
        const cicloAtual = obterCicloAtual();
        
        if (!dadosGlobais[cicloAtual]) {
            dadosGlobais[cicloAtual] = {
                totalReceita: 0, totalFixas: 0, gastosCategorias: {},
                investimentos: {}, rendimentosTotais: 0, historico: []
            };
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

const paletaRosas = [
    '#ffb6c1', '#ff69b4', '#ff1493', '#db7093', '#c71585', 
    '#ffc0cb', '#ff82ab', '#ff34b3', '#e066ff', '#da70d6', 
    '#d8bfd8', '#dda0dd', '#ee82ee', '#f08080', '#ff6eb4'
];

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');

menuToggle.addEventListener('click', () => { sidebar.classList.toggle('aberta'); });
document.querySelector('.main-content').addEventListener('click', () => {
    if(window.innerWidth <= 768 && sidebar.classList.contains('aberta')) sidebar.classList.remove('aberta');
});

function renderizarGrafico(boxId, canvasId, labelsData, valoresData, coresData) {
    const box = document.getElementById(boxId);
    box.innerHTML = `<canvas id="${canvasId}"></canvas>`; 
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    new Chart(ctx, {
        type: 'pie',
        data: { labels: labelsData, datasets: [{ data: valoresData, backgroundColor: coresData }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function atualizarInterface() {
    const dadosMes = dadosGlobais[cicloExibicao] || {};
    const ehCicloAtual = cicloExibicao === obterCicloAtual();
    
    document.getElementById('tituloMes').innerText = `Ciclo: ${formatarCicloParaExibicao(cicloExibicao)}`;
    document.getElementById('areaFormulario').style.display = ehCicloAtual ? 'flex' : 'none';
    document.getElementById('colAcoes').style.display = ehCicloAtual ? 'table-cell' : 'none';

    if (!ehCicloAtual && editandoIndex !== -1) cancelarEdicao();

    const totalComprometido = calcularTotal(dadosMes.gastosCategorias || {}) + (dadosMes.totalFixas || 0);
    const sobra = Math.max(0, (dadosMes.totalReceita || 0) - totalComprometido);
    renderizarGrafico('boxReceitas', 'graficoReceitas', 
        ['Comprometido', 'Sobra (Caixa Livre)'], [totalComprometido, sobra], ['#db7093', '#ffb6c1']
    );

    const labelsGastos = [...Object.keys(dadosMes.gastosCategorias || {})];
    const dadosGastos = [...Object.values(dadosMes.gastosCategorias || {})];
    if((dadosMes.totalFixas || 0) > 0) {
        labelsGastos.push('Contas Fixas');
        dadosGastos.push(dadosMes.totalFixas);
    }
    renderizarGrafico('boxGastos', 'graficoGastos',
        labelsGastos.length ? labelsGastos : ['Sem gastos'],
        dadosGastos.length ? dadosGastos : [1],
        labelsGastos.length ? paletaRosas.slice(0, labelsGastos.length) : ['#eee']
    );

    const labelsInv = Object.keys(dadosMes.investimentos || {});
    const dadosInv = Object.values(dadosMes.investimentos || {});
    const coresInv = paletaRosas.slice().reverse().slice(0, labelsInv.length);
    renderizarGrafico('boxInvestimentos', 'graficoInvestimentos',
        labelsInv.length ? labelsInv : ['Sem investimentos'],
        dadosInv.length ? dadosInv : [1],
        labelsInv.length ? coresInv : ['#eee']
    );

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
        let corTexto = (item.tipo === 'gasto' || item.tipo === 'fixa') ? '#db7093' : '#4a4a4a';
        
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
            <td style="color: ${corTexto}; font-weight: bold;">R$ ${item.valor.toFixed(2)}</td>
            ${acoesHtml}
        `;
        tbody.appendChild(tr);
    }
}

function reverterValores(item) {
    const dadosCiclo = dadosGlobais[cicloExibicao];
    if (item.tipo === 'receita') dadosCiclo.totalReceita -= item.valor;
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
    document.getElementById('btnSubmit').style.backgroundColor = "#ff69b4"; 
    document.querySelector('.main-content').scrollTo(0, 0);
};

function cancelarEdicao() {
    editandoIndex = -1;
    document.getElementById('tituloFormulario').innerText = "Adicionar Nova Transação";
    document.getElementById('btnSubmit').innerText = "Adicionar";
    document.getElementById('btnSubmit').style.backgroundColor = "var(--primary-color)";
    document.getElementById('descricao').value = '';
    document.getElementById('valor').value = '';
}

function renderizarMenuMeses() {
    const lista = document.getElementById('listaMeses');
    lista.innerHTML = '';
    const ciclos = Object.keys(dadosGlobais).sort().reverse();

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

    if (tipo === 'receita') dadosCiclo.totalReceita = (dadosCiclo.totalReceita || 0) + valor;
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