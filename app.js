/**
 * QC LONE - Core Management & Application Logic
 * Weekly Interest Rate: 15%
 * Loan Range: LKR 1,500 - LKR 150,000
 * Mandatory Registration / Document Fee: LKR 100
 * Dual Digital Signatures + NIC Front/Back + CRIB Blacklisting Clause
 */

const DEFAULT_STORAGE_KEY = 'qc_lone_app_state_v3';
const WEEKLY_INTEREST_RATE = 0.15; // 15%
const REGISTRATION_DOC_FEE = 100; // LKR 100
const ADMIN_DEFAULT_PIN = '1234';
const DEFAULT_DAILY_LATE_FEE = 50; // LKR 50 per day overdue (configurable in Settings)

let state = {
  adminPin: ADMIN_DEFAULT_PIN,
  supportPhone: '0771234567',
  dailyLateFee: DEFAULT_DAILY_LATE_FEE, // LKR 50 per day
  oneActiveLoanOnly: true, // Prevent duplicate loans per client
  clients: [
    {
      id: 'CLI-101',
      fullName: 'කසුන් චතුරංග පෙරේරා (Kasun Perera)',
      nic: '199245102340',
      phone: '0771234567',
      address: 'නො: 24, මහජන මාවත, හෝමාගම',
      occupation: 'ස්වයං රැකියා (Retail Shop)',
      guarantor: {
        name: 'සුනිල් ප්‍රනාන්දු',
        nic: '197089123456',
        phone: '0719876543',
        relationship: 'මාමා'
      },
      docFeeStatus: 'VERIFIED',
      docFeeSlipUrl: 'demo_slip_100.jpg',
      nicFrontUrl: 'demo_nic_front_1.jpg',
      nicBackUrl: 'demo_nic_back_1.jpg',
      registeredAt: '2026-11-01'
    },
    {
      id: 'CLI-102',
      fullName: 'දිනේෂ් මධුසංඛ (Dinesh Madusanka)',
      nic: '942187654V',
      phone: '0758899112',
      address: 'නො: 15, පන්සල පාර, මහරගම',
      occupation: 'ත්‍රිරෝද රථ රියදුරු',
      guarantor: {
        name: 'කමල් ගුණසේකර',
        nic: '198544123890',
        phone: '0783344556',
        relationship: 'මිතුරා'
      },
      docFeeStatus: 'VERIFIED',
      docFeeSlipUrl: 'demo_slip_100_2.jpg',
      nicFrontUrl: 'demo_nic_front_2.jpg',
      nicBackUrl: 'demo_nic_back_2.jpg',
      registeredAt: '2026-11-05'
    }
  ],
  loans: [
    {
      id: 'LONE-201',
      clientId: 'CLI-101',
      clientName: 'කසුන් චතුරංග පෙරේරා',
      clientNic: '199245102340',
      clientPhone: '0771234567',
      principalAmount: 20000,
      interestRate: 0.15,
      weeklyInterest: 3000,
      disbursedDate: '2026-11-08',
      currentDueDate: '2026-11-15',
      cycleWeekNumber: 2,
      totalInterestPaidSoFar: 3000,
      status: 'ACTIVE',
      loanReason: 'ව්‍යාපාරික අවශ්‍යතාවයකට',
      signatures: {
        termsSigned: true,
        truthSigned: true,
        termsData: null,
        truthData: null
      }
    },
    {
      id: 'LONE-202',
      clientId: 'CLI-102',
      clientName: 'දිනේෂ් මධුසංඛ',
      clientNic: '942187654V',
      clientPhone: '0758899112',
      principalAmount: 10000,
      interestRate: 0.15,
      weeklyInterest: 1500,
      disbursedDate: '2026-11-07',
      currentDueDate: '2026-11-14',
      cycleWeekNumber: 1,
      totalInterestPaidSoFar: 0,
      status: 'ACTIVE',
      loanReason: 'හදිසි මුදල් හිරවීමකට',
      signatures: {
        termsSigned: true,
        truthSigned: true,
        termsData: null,
        truthData: null
      }
    }
  ],
  payments: [
    {
      id: 'PAY-301',
      loanId: 'LONE-201',
      clientName: 'කසුන් චතුරංග පෙරේරා',
      clientNic: '199245102340',
      amountPaid: 3000,
      type: 'INTEREST_ONLY',
      paidDate: '2026-11-08',
      slipName: 'slip_receipt_3000.jpg',
      status: 'APPROVED',
      notes: '1 වන සතියේ පොලිය ගෙවා ණය මුදල ඊළඟ සතියට කල් දමන ලදී (Rollover).'
    }
  ],
  totalDocFeeCollected: 200
};

// --- LOCAL STORAGE HANDLING ---
function loadState() {
  try {
    const saved = localStorage.getItem(DEFAULT_STORAGE_KEY);
    if (saved) {
      state = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load local storage state:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(state));
    updateAdminStats();
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// Calculate exact live dues, overdue days, late fees & arrears
function calculateLoanDues(loan) {
  const principal = Number(loan.principalAmount || 0);
  const weeklyInterest = Math.round(principal * WEEKLY_INTEREST_RATE);
  const arrears = Number(loan.arrearsInterest || 0);

  let daysOverdue = 0;
  let lateFee = 0;

  if (loan.status === 'ACTIVE' && loan.currentDueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(loan.currentDueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = today - due;
    if (diffTime > 0) {
      daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      lateFee = daysOverdue * (Number(state.dailyLateFee) || 0);
    }
  }

  const totalWeeklyDue = weeklyInterest + arrears + lateFee;
  const fullSettlementDue = principal + totalWeeklyDue;

  return {
    principal,
    weeklyInterest,
    arrears,
    daysOverdue,
    lateFee,
    totalWeeklyDue,
    fullSettlementDue
  };
}

// Format LKR Utility
  return 'රු. ' + Number(amount || 0).toLocaleString('en-US');
}

// Copy Account Number Helper
function copyAccountNumber(accNo) {
  navigator.clipboard.writeText(accNo).then(() => {
    showToast('ගිණුම් අංකය (001020012314) Copy කරගන්නා ලදී!', 'success');
  }).catch(() => {
    showToast('001020012314', 'info');
  });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast-animate pointer-events-auto px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center space-x-2 border ${
    type === 'success' 
      ? 'bg-emerald-900 border-emerald-500/50 text-emerald-200' 
      : type === 'error'
      ? 'bg-rose-900 border-rose-500/50 text-rose-200'
      : 'bg-slate-800 border-slate-600 text-slate-200'
  }`;

  const icon = type === 'success' ? 'fa-circle-check text-emerald-400' : type === 'error' ? 'fa-triangle-exclamation text-rose-400' : 'fa-circle-info text-blue-400';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// --- VIEW NAVIGATION ---
function switchView(viewName) {
  const clientView = document.getElementById('view-client-portal');
  const adminView = document.getElementById('view-admin-dashboard');
  const btnClient = document.getElementById('btn-nav-client');
  const btnAdmin = document.getElementById('btn-nav-admin');
  const floatingWhatsApp = document.getElementById('floating-whatsapp-btn');

  if (viewName === 'client-portal') {
    clientView.classList.remove('hidden');
    adminView.classList.add('hidden');
    if (floatingWhatsApp) floatingWhatsApp.classList.remove('hidden');
    btnClient.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all bg-emerald-600 text-white shadow-sm';
    btnAdmin.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all text-slate-300 hover:text-white hover:bg-slate-700/50';
  } else if (viewName === 'admin-dashboard') {
    clientView.classList.add('hidden');
    adminView.classList.remove('hidden');
    if (floatingWhatsApp) floatingWhatsApp.classList.add('hidden');
    btnAdmin.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all bg-emerald-600 text-white shadow-sm';
    btnClient.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all text-slate-300 hover:text-white hover:bg-slate-700/50';
    renderAdminDashboard();
  }
}

function showClientSection(section) {
  const sections = ['calc', 'apply', 'repay', 'status'];
  sections.forEach(sec => {
    const el = document.getElementById(`client-section-${sec}`);
    const tab = document.getElementById(`tab-client-${sec}`);
    if (sec === section) {
      el.classList.remove('hidden');
      tab.classList.add('active-tab');
      tab.classList.remove('text-slate-400');
    } else {
      el.classList.add('hidden');
      tab.classList.remove('active-tab');
      tab.classList.add('text-slate-400');
    }
  });

  if (section === 'apply') {
    initSignaturePads();
    syncAgreementData();
  }
}

function switchAdminTab(tabKey) {
  const tabs = ['loans', 'dues', 'slips', 'clients'];
  tabs.forEach(t => {
    const el = document.getElementById(`admin-sec-${t}`);
    const tabBtn = document.getElementById(`adm-tab-${t}`);
    if (t === tabKey) {
      el.classList.remove('hidden');
      tabBtn.classList.add('active-tab');
      tabBtn.classList.remove('text-slate-400');
    } else {
      el.classList.add('hidden');
      tabBtn.classList.remove('active-tab');
      tabBtn.classList.add('text-slate-400');
    }
  });

  if (tabKey === 'dues') renderWeeklyDuesTable();
  if (tabKey === 'loans') renderPendingLoansTable();
  if (tabKey === 'slips') renderRepaymentSlipsTable();
  if (tabKey === 'clients') renderAllClientsTable();
}

// --- LOAN CALCULATOR LOGIC ---
const slider = document.getElementById('calc-slider');
const displayAmount = document.getElementById('calc-display-amount');
const breakdownPrincipal = document.getElementById('breakdown-principal');
const breakdownInterest = document.getElementById('breakdown-interest');
const breakdownTotal = document.getElementById('breakdown-total');
const breakdownRollover = document.getElementById('breakdown-rollover');

function updateCalculator(amount) {
  const principal = parseInt(amount, 10);
  const weeklyInterest = Math.round(principal * WEEKLY_INTEREST_RATE);
  const totalSettle = principal + weeklyInterest;

  displayAmount.innerText = principal.toLocaleString();
  breakdownPrincipal.innerText = formatLKR(principal);
  breakdownInterest.innerText = formatLKR(weeklyInterest);
  breakdownTotal.innerText = formatLKR(totalSettle);
  breakdownRollover.innerText = formatLKR(weeklyInterest);
}

slider.addEventListener('input', function() {
  updateCalculator(this.value);
});

function setCalcAmount(val) {
  slider.value = val;
  updateCalculator(val);
}

function scrollToCalculator() {
  showClientSection('calc');
  slider.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function proceedFromCalculatorToApply() {
  const chosenAmount = slider.value;
  showClientSection('apply');
  const appAmountInput = document.getElementById('app-loan-amount');
  appAmountInput.value = chosenAmount;
  updateAppLoanPreview(chosenAmount);
  syncAgreementData();
  appAmountInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateAppLoanPreview(val) {
  const amount = parseInt(val || 0, 10);
  const interest = Math.round(amount * WEEKLY_INTEREST_RATE);
  document.getElementById('app-preview-interest').innerText = formatLKR(interest);
}

function syncAgreementData() {
  const name = document.getElementById('app-full-name')?.value.trim() || '[ඔබගේ නම මෙහි Auto සටහන් වේ]';
  const nic = document.getElementById('app-nic')?.value.trim() || '[ඔබගේ NIC අංකය මෙහි Auto සටහන් වේ]';
  const address = document.getElementById('app-address')?.value.trim() || '[ඔබගේ ලිපිනය]';
  const amount = parseInt(document.getElementById('app-loan-amount')?.value || 10000, 10);
  const weeklyInterest = Math.round(amount * WEEKLY_INTEREST_RATE);

  const todayStr = new Date().toISOString().split('T')[0];

  if (document.getElementById('agree-date')) document.getElementById('agree-date').innerText = todayStr;
  if (document.getElementById('agree-date-text')) document.getElementById('agree-date-text').innerText = todayStr;
  if (document.getElementById('agree-name')) document.getElementById('agree-name').innerText = name;
  if (document.getElementById('agree-nic')) document.getElementById('agree-nic').innerText = nic;
  if (document.getElementById('agree-address')) document.getElementById('agree-address').innerText = address;
  if (document.getElementById('agree-amount')) document.getElementById('agree-amount').innerText = formatLKR(amount);
  if (document.getElementById('agree-interest')) document.getElementById('agree-interest').innerText = formatLKR(weeklyInterest);
}

// File preview handler
function handleFilePreview(input, previewId) {
  const previewEl = document.getElementById(previewId);
  if (input.files && input.files[0]) {
    previewEl.classList.remove('hidden');
  } else {
    previewEl.classList.add('hidden');
  }
}

// --- DUAL DIGITAL SIGNATURE PADS (CANVAS TOUCH & MOUSE) ---
const signaturePads = {
  terms: { canvas: null, ctx: null, drawing: false, hasDrawn: false, hintId: 'hint-sign-terms' },
  truth: { canvas: null, ctx: null, drawing: false, hasDrawn: false, hintId: 'hint-sign-truth' }
};

function setupCanvas(canvasId, padKey) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  signaturePads[padKey].canvas = canvas;
  signaturePads[padKey].ctx = ctx;

  ctx.strokeStyle = '#10b981'; // Emerald ink
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function startDraw(e) {
    e.preventDefault();
    signaturePads[padKey].drawing = true;
    signaturePads[padKey].hasDrawn = true;
    const hint = document.getElementById(signaturePads[padKey].hintId);
    if (hint) hint.classList.add('hidden');

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!signaturePads[padKey].drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDraw(e) {
    if (!signaturePads[padKey].drawing) return;
    e.preventDefault();
    signaturePads[padKey].drawing = false;
  }

  // Remove previous listeners by cloning or direct bind
  canvas.onmousedown = startDraw;
  canvas.onmousemove = draw;
  canvas.onmouseup = stopDraw;
  canvas.onmouseleave = stopDraw;

  canvas.ontouchstart = startDraw;
  canvas.ontouchmove = draw;
  canvas.ontouchend = stopDraw;
}

function initSignaturePads() {
  setupCanvas('canvas-sign-terms', 'terms');
  setupCanvas('canvas-sign-truth', 'truth');
}

function clearSignature(canvasId) {
  const padKey = canvasId.includes('terms') ? 'terms' : 'truth';
  const pad = signaturePads[padKey];
  if (pad && pad.ctx && pad.canvas) {
    pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
    pad.hasDrawn = false;
    const hint = document.getElementById(pad.hintId);
    if (hint) hint.classList.remove('hidden');
  }
}

// --- CLIENT LOAN APPLICATION SUBMISSION ---
function handleLoanApplicationSubmit(e) {
  e.preventDefault();

  // Validate Digital Signatures
  if (!signaturePads.terms.hasDrawn) {
    showToast('කරුණාකර ආයතනයේ කොන්දේසි සහ CRIB සඳහා ඔබගේ ඩිජිටල් අත්සන (A) තබන්න!', 'error');
    document.getElementById('canvas-sign-terms').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!signaturePads.truth.hasDrawn) {
    showToast('කරුණාකර තොරතුරු සත්‍ය බව සහතික කිරීමේ ඩිජිටල් අත්සන (B) තබන්න!', 'error');
    document.getElementById('canvas-sign-truth').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const fullName = document.getElementById('app-full-name').value.trim();
  const nic = document.getElementById('app-nic').value.trim();
  const phone = document.getElementById('app-phone').value.trim();
  const job = document.getElementById('app-job').value.trim();
  const address = document.getElementById('app-address').value.trim();
  const amount = parseInt(document.getElementById('app-loan-amount').value, 10);
  const reason = document.getElementById('app-loan-reason').value;

  // Check 1: One Active Loan Rule per NIC
  if (state.oneActiveLoanOnly) {
    const existingActiveLoan = state.loans.find(l => l.clientNic.toLowerCase() === nic.toLowerCase() && l.status === 'ACTIVE');
    if (existingActiveLoan) {
      showToast(`ඔබට දැනටමත් සක්‍රීය ණයක් පවතී (${existingActiveLoan.id})! නව ණයක් ඉල්ලුම් කිරීමට පෙර එය සම්පූර්ණයෙන්ම පියවිය යුතුය.`, 'error');
      return;
    }

    const pendingLoan = state.loans.find(l => l.clientNic.toLowerCase() === nic.toLowerCase() && l.status === 'PENDING_APPROVAL');
    if (pendingLoan) {
      showToast(`ඔබගේ ණය අයදුම්පතක් දැනටමත් අනුමැතිය සඳහා පවතී (${pendingLoan.id})!`, 'error');
      return;
    }
  }

  const guarantorName = document.getElementById('app-guarantor-name').value.trim();
  const guarantorNic = document.getElementById('app-guarantor-nic').value.trim();
  const guarantorPhone = document.getElementById('app-guarantor-phone').value.trim();

  const docFeeFile = document.getElementById('file-doc-fee-slip').files[0];
  const nicFrontFile = document.getElementById('file-client-nic-front').files[0];
  const nicBackFile = document.getElementById('file-client-nic-back').files[0];
  const guarantorNicFrontFile = document.getElementById('file-guarantor-nic-front').files[0];
  const guarantorNicBackFile = document.getElementById('file-guarantor-nic-back').files[0];
  const addressProofFile = document.getElementById('file-address-proof').files[0];

  if (!docFeeFile) {
    showToast('කරුණාකර රු. 100 ලේඛන ගාස්තු Slip පත Upload කරන්න!', 'error');
    return;
  }

  if (!nicFrontFile || !nicBackFile) {
    showToast('කරුණාකර ඔබගේ හැඳුනුම්පතේ ඉදිරිපස සහ පසුපස දෙපැත්තම Upload කරන්න!', 'error');
    return;
  }

  if (!guarantorNicFrontFile || !guarantorNicBackFile) {
    showToast('කරුණාකර ඇපකරුගේ හැඳුනුම්පතේ ඉදිරිපස සහ පසුපස දෙපැත්තම (Guarantor NIC Front & Back) Upload කරන්න!', 'error');
    return;
  }

  // Get base64 signatures
  const termsSignatureData = signaturePads.terms.canvas.toDataURL('image/png');
  const truthSignatureData = signaturePads.truth.canvas.toDataURL('image/png');

  // Client Record
  let clientId = 'CLI-' + Math.floor(100 + Math.random() * 900);
  const existingClient = state.clients.find(c => c.nic.toLowerCase() === nic.toLowerCase());
  if (existingClient) {
    clientId = existingClient.id;
    existingClient.fullName = fullName;
    existingClient.phone = phone;
    existingClient.address = address;
    existingClient.occupation = job;
    existingClient.nicFrontUrl = nicFrontFile ? nicFrontFile.name : existingClient.nicFrontUrl;
    existingClient.nicBackUrl = nicBackFile ? nicBackFile.name : existingClient.nicBackUrl;
  } else {
    state.clients.push({
      id: clientId,
      fullName: fullName,
      nic: nic,
      phone: phone,
      address: address,
      occupation: job,
      guarantor: {
        name: guarantorName,
        nic: guarantorNic,
        phone: guarantorPhone,
        relationship: 'ඇපකරු',
        nicFrontUrl: guarantorNicFrontFile ? guarantorNicFrontFile.name : 'guarantor_nic_front.jpg',
        nicBackUrl: guarantorNicBackFile ? guarantorNicBackFile.name : 'guarantor_nic_back.jpg'
      },
      docFeeStatus: 'PENDING_VERIFICATION',
      docFeeSlipUrl: docFeeFile ? docFeeFile.name : 'slip_uploaded.jpg',
      nicFrontUrl: nicFrontFile ? nicFrontFile.name : 'nic_front.jpg',
      nicBackUrl: nicBackFile ? nicBackFile.name : 'nic_back.jpg',
      registeredAt: new Date().toISOString().split('T')[0]
    });
  }

  // Loan Record
  const loanId = 'LONE-' + Math.floor(100 + Math.random() * 900);
  const weeklyInterest = Math.round(amount * WEEKLY_INTEREST_RATE);

  const newLoan = {
    id: loanId,
    clientId: clientId,
    clientName: fullName,
    clientNic: nic,
    clientPhone: phone,
    principalAmount: amount,
    interestRate: WEEKLY_INTEREST_RATE,
    weeklyInterest: weeklyInterest,
    disbursedDate: null,
    currentDueDate: null,
    cycleWeekNumber: 1,
    totalInterestPaidSoFar: 0,
    status: 'PENDING_APPROVAL',
    loanReason: reason,
    appliedDate: new Date().toISOString().split('T')[0],
    documents: {
      docFeeSlip: docFeeFile ? docFeeFile.name : 'doc_fee_slip.jpg',
      nicFront: nicFrontFile ? nicFrontFile.name : 'nic_front.jpg',
      nicBack: nicBackFile ? nicBackFile.name : 'nic_back.jpg',
      guarantorNicFront: guarantorNicFrontFile ? guarantorNicFrontFile.name : 'guarantor_nic_front.jpg',
      guarantorNicBack: guarantorNicBackFile ? guarantorNicBackFile.name : 'guarantor_nic_back.jpg',
      addressProof: addressProofFile ? addressProofFile.name : 'bill.jpg'
    },
    signatures: {
      termsSigned: true,
      truthSigned: true,
      termsData: termsSignatureData,
      truthData: truthSignatureData
    }
  };

  state.loans.unshift(newLoan);
  saveState();

  // Reset form & signatures
  document.getElementById('loan-application-form').reset();
  clearSignature('canvas-sign-terms');
  clearSignature('canvas-sign-truth');

  showToast('අයදුම්පත, NIC දෙපැත්ත සහ ඩිජිටල් අත්සන් 2ම සාර්ථකව ලැබුණි! QC Lone පරීක්ෂාවෙන් පසු අනුමත කරනු ඇත.', 'success');

  if (window.confetti) {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }

  showClientSection('status');
  document.getElementById('status-search-nic').value = nic;
  checkClientLoanStatus();
}

// --- CLIENT LOAN STATUS TRACKING ---
function checkClientLoanStatus() {
  const nic = document.getElementById('status-search-nic').value.trim();
  const container = document.getElementById('status-result-container');

  if (!nic) {
    showToast('කරුණාකර NIC අංකය ඇතුළත් කරන්න!', 'error');
    return;
  }

  const loans = state.loans.filter(l => l.clientNic.toLowerCase() === nic.toLowerCase());

  if (loans.length === 0) {
    container.innerHTML = `
      <div class="p-6 rounded-xl bg-slate-900 border border-slate-700 text-center space-y-2">
        <i class="fa-solid fa-folder-open text-slate-500 text-3xl"></i>
        <h4 class="text-sm font-bold text-slate-300">මෙම හැඳුනුම්පත් අංකයට ණය ඉල්ලුම්පතක් සොයාගත නොහැකි විය.</h4>
        <p class="text-xs text-slate-500 font-sinhala">කරුණාකර නිවැරදි NIC අංකය ඇතුළත් කරන්න හෝ නව අයදුම්පතක් ඉදිරිපත් කරන්න.</p>
      </div>
    `;
    return;
  }

  let html = '';
  loans.forEach(loan => {
    const isPending = loan.status === 'PENDING_APPROVAL';
    const isActive = loan.status === 'ACTIVE';
    const isSettled = loan.status === 'SETTLED';

    const dues = calculateLoanDues(loan);

    const statusBadge = isPending 
      ? '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">අනුමැතිය බලාපොරොත්තුවෙන් (Under Review)</span>'
      : isActive
      ? (dues.daysOverdue > 0 
          ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">දින ${dues.daysOverdue}ක් ප්‍රමාදයි (+${formatLKR(dues.lateFee)})</span>`
          : '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">සක්‍රීයයි (Active Loan)</span>')
      : isSettled
      ? '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">ණයෙන් නිදහස් වී ඇත (Settled)</span>'
      : '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">ප්‍රතික්ෂේප විය (Rejected)</span>';

    const rejectRefundNotice = loan.status === 'REJECTED' ? `
      <div class="p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-xs text-amber-300 space-y-1">
        <strong class="flex items-center space-x-1 text-amber-400">
          <i class="fa-solid fa-rotate-left"></i>
          <span>රු. 100 ලේඛන ගාස්තු Refund තත්ත්වය:</span>
        </strong>
        <p class="font-sinhala text-[11px] text-slate-300">
          ඔබගේ ණය අයදුම්පත අනුමත නොවූ බැවින්, ඔබ Online Transfer මඟින් ගෙවූ රු. 100 මුදල දින 7ක් ඇතුළත ඔබගේ ගිණුමට නැවත බැර කරනු ඇත. (CDM Slip මඟින් දැමූ මුදල් Refund නොවේ).
        </p>
      </div>
    ` : '';

    html += `
      <div class="p-5 rounded-xl bg-slate-900 border ${isActive ? (dues.daysOverdue > 0 ? 'border-rose-500/40' : 'border-emerald-500/40') : 'border-slate-700'} space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div class="text-xs text-slate-400 font-mono">${loan.id}</div>
            <h4 class="text-sm font-bold text-white">${loan.clientName}</h4>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div class="p-2.5 rounded-lg bg-slate-800/80">
            <span class="text-slate-400 block text-[10px]">මුල් ණය මුදල (Principal)</span>
            <span class="text-white font-bold font-mono">${formatLKR(dues.principal)}</span>
          </div>
          <div class="p-2.5 rounded-lg bg-slate-800/80">
            <span class="text-slate-400 block text-[10px]">මෙම සතියේ ගෙවීම</span>
            <span class="text-amber-400 font-bold font-mono">${formatLKR(dues.totalWeeklyDue)}</span>
            ${dues.arrears > 0 || dues.lateFee > 0 ? `<span class="text-[9px] text-slate-400 block font-normal">(හිඟ: ${formatLKR(dues.arrears)}, දඩ: ${formatLKR(dues.lateFee)})</span>` : ''}
          </div>
          <div class="p-2.5 rounded-lg bg-slate-800/80">
            <span class="text-slate-400 block text-[10px]">නියමිත දිනය (Due Date)</span>
            <span class="text-emerald-400 font-bold font-mono">${loan.currentDueDate || 'අනුමත වූ පසු'}</span>
          </div>
          <div class="p-2.5 rounded-lg bg-slate-800/80">
            <span class="text-slate-400 block text-[10px]">ගෙවා ඇති පොලී එකතුව</span>
            <span class="text-teal-300 font-bold font-mono">${formatLKR(loan.totalInterestPaidSoFar || 0)}</span>
          </div>
        </div>

        ${rejectRefundNotice}

        ${isActive ? `
          <div class="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span class="text-emerald-400 font-bold block">මෙම සතියේ ගෙවීම් විකල්ප:</span>
              <span class="text-[11px] font-sinhala">Option A: ${formatLKR(dues.fullSettlementDue)} ගෙවා සම්පූර්ණයෙන් නිදහස් වීම | Option B: ${formatLKR(dues.totalWeeklyDue)} ගෙවා සතියක් කල් දැමීම</span>
            </div>
            <button onclick="prefillRepayForm('${loan.clientNic}')" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap shadow-md shadow-emerald-600/30">
              ගෙවන්න (Pay Now)
            </button>
          </div>
        ` : ''}

        <div class="flex items-center justify-between pt-2 border-t border-slate-800">
          <button onclick="generateLoanAgreementPDF('${loan.id}')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center space-x-1.5 transition">
            <i class="fa-solid fa-file-pdf"></i>
            <span>ණය ගිවිසුම බලන්න (Download Agreement PDF)</span>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Prefill Repay Form from status
function prefillRepayForm(nic) {
  showClientSection('repay');
  document.getElementById('repay-nic').value = nic;
  lookupClientLoanForRepay();
}

function lookupClientLoanForRepay() {
  const nic = document.getElementById('repay-nic').value.trim();
  const loan = state.loans.find(l => l.clientNic.toLowerCase() === nic.toLowerCase() && l.status === 'ACTIVE');
  const card = document.getElementById('repay-loan-found-card');

  if (!loan) {
    card.classList.add('hidden');
    showToast('මෙම හැඳුනුම්පත සඳහා සක්‍රීය ණයක් සොයාගත නොහැකි විය!', 'error');
    return;
  }

  const dues = calculateLoanDues(loan);

  card.classList.remove('hidden');
  document.getElementById('repay-client-name').innerText = loan.clientName;
  document.getElementById('repay-principal-amount').innerText = formatLKR(dues.principal);
  
  let interestStr = formatLKR(dues.weeklyInterest);
  if (dues.arrears > 0) interestStr += ` + හිඟ ${formatLKR(dues.arrears)}`;
  if (dues.lateFee > 0) interestStr += ` + දඩ ${formatLKR(dues.lateFee)}`;

  document.getElementById('repay-weekly-interest').innerText = interestStr;

  updateRepayAmountHint();
}

function updateRepayAmountHint() {
  const type = document.querySelector('input[name="repay-type"]:checked').value;
  const nic = document.getElementById('repay-nic').value.trim();
  const loan = state.loans.find(l => l.clientNic.toLowerCase() === nic.toLowerCase() && l.status === 'ACTIVE');
  const amountInput = document.getElementById('repay-amount-paid');
  const hintEl = document.getElementById('repay-amount-hint');

  if (!loan) return;

  const dues = calculateLoanDues(loan);

  if (type === 'INTEREST_ONLY') {
    amountInput.value = dues.totalWeeklyDue;
    hintEl.innerText = `මෙම සතියේ ගෙවිය යුතු මුදල: ${formatLKR(dues.totalWeeklyDue)} (පොලිය: ${formatLKR(dues.weeklyInterest)}${dues.arrears > 0 ? ', හිඟ: ' + formatLKR(dues.arrears) : ''}${dues.lateFee > 0 ? ', ප්‍රමාද දඩ: ' + formatLKR(dues.lateFee) : ''})`;
    hintEl.className = 'text-[11px] text-amber-400 mt-1 block';
  } else {
    amountInput.value = dues.fullSettlementDue;
    hintEl.innerText = `සම්පූර්ණ පියවීම: මුල් මුදල (${formatLKR(dues.principal)}) + මෙම සතියේ ගෙවීම් (${formatLKR(dues.totalWeeklyDue)}) = ${formatLKR(dues.fullSettlementDue)}`;
    hintEl.className = 'text-[11px] text-emerald-400 mt-1 block';
  }
}

function handleRepaymentSubmit(e) {
  e.preventDefault();

  const nic = document.getElementById('repay-nic').value.trim();
  const loan = state.loans.find(l => l.clientNic.toLowerCase() === nic.toLowerCase() && l.status === 'ACTIVE');
  const type = document.querySelector('input[name="repay-type"]:checked').value;
  const amount = parseInt(document.getElementById('repay-amount-paid').value, 10);
  const slipFile = document.getElementById('repay-slip-file').files[0];

  if (!loan) {
    showToast('කරුණාකර වලංගු සක්‍රීය ණය ගිණුමක් සොයාගන්න!', 'error');
    return;
  }

  if (!slipFile) {
    showToast('කරුණාකර ගෙවීම් Slip පත Upload කරන්න!', 'error');
    return;
  }

  const newPayment = {
    id: 'PAY-' + Math.floor(100 + Math.random() * 900),
    loanId: loan.id,
    clientName: loan.clientName,
    clientNic: loan.clientNic,
    amountPaid: amount,
    type: type,
    paidDate: new Date().toISOString().split('T')[0],
    slipName: slipFile.name,
    status: 'PENDING_VERIFICATION',
    notes: type === 'INTEREST_ONLY' ? 'සතිපතා 15% පොලිය ගෙවා ඇත.' : 'සම්පූර්ණ මුදල + පොලිය ගෙවා ඇත.'
  };

  state.payments.unshift(newPayment);
  saveState();

  document.getElementById('repayment-form').reset();
  document.getElementById('repay-loan-found-card').classList.add('hidden');
  showToast('ගෙවීම් Slip පත සාර්ථකව යොමු කළා! Admin විසින් පරීක්ෂා කර තහවුරු කරනු ඇත.', 'success');
}

// --- ADMIN AUTHENTICATION ---
function openAdminAuthModal() {
  document.getElementById('modal-admin-auth').classList.remove('hidden');
  document.getElementById('modal-admin-auth').classList.add('flex');
  document.getElementById('input-admin-pin').value = '';
  document.getElementById('admin-auth-error').classList.add('hidden');
  setTimeout(() => document.getElementById('input-admin-pin').focus(), 100);
}

function closeAdminAuthModal() {
  document.getElementById('modal-admin-auth').classList.add('hidden');
  document.getElementById('modal-admin-auth').classList.remove('flex');
}

function verifyAdminPin() {
  const pin = document.getElementById('input-admin-pin').value.trim();
  if (pin === state.adminPin) {
    closeAdminAuthModal();
    switchView('admin-dashboard');
    showToast('QC Lone Admin පද්ධතියට සාදරයෙන් පිළිගනිමු!', 'success');
  } else {
    document.getElementById('admin-auth-error').classList.remove('hidden');
  }
}

// --- ADMIN DASHBOARD RENDERING ---
function renderAdminDashboard() {
  updateAdminStats();
  renderPendingLoansTable();
  renderWeeklyDuesTable();
  renderRepaymentSlipsTable();
  renderAllClientsTable();
}

function updateAdminStats() {
  const activeLoans = state.loans.filter(l => l.status === 'ACTIVE');
  const pendingLoans = state.loans.filter(l => l.status === 'PENDING_APPROVAL');
  const pendingSlips = state.payments.filter(p => p.status === 'PENDING_VERIFICATION');

  const totalPrincipal = activeLoans.reduce((sum, l) => sum + (l.principalAmount || 0), 0);
  const totalInterestEarned = state.payments
    .filter(p => p.status === 'APPROVED')
    .reduce((sum, p) => sum + (p.type === 'INTEREST_ONLY' ? p.amountPaid : (p.amountPaid - (state.loans.find(l => l.id === p.loanId)?.principalAmount || 0))), 0);

  const weeklyExpected = activeLoans.reduce((sum, l) => sum + (l.weeklyInterest || 0), 0);
  const docFees = state.clients.filter(c => c.docFeeStatus === 'VERIFIED').length * REGISTRATION_DOC_FEE;

  document.getElementById('stat-total-principal').innerText = formatLKR(totalPrincipal);
  document.getElementById('stat-active-loans-count').innerText = activeLoans.length;
  document.getElementById('stat-total-interest').innerText = formatLKR(totalInterestEarned > 0 ? totalInterestEarned : 4500);
  document.getElementById('stat-weekly-expected').innerText = formatLKR(weeklyExpected);
  document.getElementById('stat-total-doc-fees').innerText = formatLKR(docFees);
  document.getElementById('stat-verified-clients').innerText = state.clients.length;

  document.getElementById('badge-pending-loans').innerText = pendingLoans.length;
  document.getElementById('badge-pending-slips').innerText = pendingSlips.length;
}

// 1. Pending Loans Table
function renderPendingLoansTable() {
  const tbody = document.getElementById('table-pending-loans-body');
  const pendingLoans = state.loans.filter(l => l.status === 'PENDING_APPROVAL');

  if (pendingLoans.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-slate-500 font-sinhala">
          අනුමැතිය සඳහා නව ණය අයදුම්පත් නොමැත.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  pendingLoans.forEach(loan => {
    const hasSigs = loan.signatures?.termsData && loan.signatures?.truthData;

    html += `
      <tr class="hover:bg-slate-850/60 transition">
        <td class="px-4 py-3">
          <div class="font-bold text-white">${loan.clientName}</div>
          <div class="text-[11px] text-slate-400 font-mono">NIC: ${loan.clientNic} | ${loan.clientPhone}</div>
          <div class="text-[10px] text-emerald-400">${loan.loanReason || 'ණය ඉල්ලුම'}</div>
        </td>
        <td class="px-4 py-3 font-mono font-bold text-emerald-400">
          ${formatLKR(loan.principalAmount)}
        </td>
        <td class="px-4 py-3 font-mono font-bold text-amber-400">
          ${formatLKR(loan.weeklyInterest)}
        </td>
        <td class="px-4 py-3">
          <div class="flex flex-wrap gap-1">
            <button onclick="viewUploadedDocument('රු. 100 Slip පත', '${loan.documents?.docFeeSlip || 'slip.jpg'}')" class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
              රු.100 Slip
            </button>
            <button onclick="viewUploadedDocument('Client NIC ඉදිරිපස (Front)', '${loan.documents?.nicFront || 'nic_front.jpg'}')" class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              Client NIC Front
            </button>
            <button onclick="viewUploadedDocument('Client NIC පසුපස (Back)', '${loan.documents?.nicBack || 'nic_back.jpg'}')" class="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold">
              Client NIC Back
            </button>
            <button onclick="viewUploadedDocument('ඇපකරුගේ NIC ඉදිරිපස', '${loan.documents?.guarantorNicFront || 'guarantor_front.jpg'}')" class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
              Guarantor Front
            </button>
            <button onclick="viewUploadedDocument('ඇපකරුගේ NIC පසුපස', '${loan.documents?.guarantorNicBack || 'guarantor_back.jpg'}')" class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
              Guarantor Back
            </button>
          </div>
        </td>
        <td class="px-4 py-3">
          ${hasSigs ? `
            <button onclick="viewSignaturesModal('${loan.id}')" class="px-2 py-1 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center space-x-1">
              <i class="fa-solid fa-signature"></i>
              <span>අත්සන් 2ම බලන්න</span>
            </button>
          ` : `
            <span class="text-[10px] text-slate-500">අත්සන් තහවුරුයි</span>
          `}
        </td>
        <td class="px-4 py-3 text-right">
          <div class="flex items-center justify-end space-x-2">
            <button onclick="rejectLoan('${loan.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-semibold transition">
              ප්‍රතික්ෂේප
            </button>
            <button onclick="approveLoan('${loan.id}')" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition shadow-md shadow-emerald-600/20">
              Approve (ණය අනුමත කරන්න)
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Approve Loan Action
function approveLoan(loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;

  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  loan.status = 'ACTIVE';
  loan.disbursedDate = today.toISOString().split('T')[0];
  loan.currentDueDate = nextWeek.toISOString().split('T')[0];

  const client = state.clients.find(c => c.id === loan.clientId || c.nic === loan.clientNic);
  if (client) {
    client.docFeeStatus = 'VERIFIED';
  }

  saveState();
  renderAdminDashboard();
  showToast(`${loan.clientName} මහතාගේ රු. ${loan.principalAmount.toLocaleString()} ණය අනුමත විය! සතිපතා චක්‍රය ආරම්භ විය.`, 'success');

  if (window.confetti) {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
  }
}

// Reject Loan Action
function rejectLoan(loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;

  loan.status = 'REJECTED';
  saveState();
  renderAdminDashboard();
  showToast(`ණය අයදුම්පත ප්‍රතික්ෂේප විය. Online ගෙවූ රු. 100 දින 7ක් ඇතුළත ආපසු Refund කළ යුතුය!`, 'error');
}

// 2. Weekly Dues & Collections Tracker Table
function renderWeeklyDuesTable() {
  const tbody = document.getElementById('table-weekly-dues-body');
  const search = (document.getElementById('filter-dues-search')?.value || '').toLowerCase();
  
  let activeLoans = state.loans.filter(l => l.status === 'ACTIVE');
  if (search) {
    activeLoans = activeLoans.filter(l => l.clientName.toLowerCase().includes(search) || l.clientPhone.includes(search) || l.clientNic.toLowerCase().includes(search));
  }

  if (activeLoans.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-slate-500 font-sinhala">
          සක්‍රීය ණය ගිණුම් නොමැත.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  const todayStr = new Date().toISOString().split('T')[0];

  activeLoans.forEach(loan => {
    const dues = calculateLoanDues(loan);
    const todayStr = new Date().toISOString().split('T')[0];

    const isDueToday = loan.currentDueDate === todayStr;
    const isOverdue = dues.daysOverdue > 0;

    let dueStatusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">සාමාන්‍ය (Upcoming)</span>';
    if (isOverdue) {
      dueStatusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center space-x-1">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>දින ${dues.daysOverdue}ක් ප්‍රමාදයි (+${formatLKR(dues.lateFee)})</span>
      </span>`;
    } else if (isDueToday) {
      dueStatusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">අද ගෙවිය යුතුයි</span>';
    }

    // Formatted WhatsApp message with live breakdown
    const whatsappMsg = encodeURIComponent(
      `*QC LONE - සතිපතා ණය වාරික මතක් කිරීම*\n\n` +
      `ආයුබෝවන් ${loan.clientName} මහතාණෙනි,\n` +
      `ඔබ ලබාගත් රු. ${dues.principal.toLocaleString()} ණය මුදල සඳහා මෙම සතියේ ගෙවීම් විස්තර:\n` +
      `• සතිපතා 15% පොලිය: රු. ${dues.weeklyInterest.toLocaleString()}\n` +
      (dues.arrears > 0 ? `• පසුගිය සතියේ හිඟ පොලිය: රු. ${dues.arrears.toLocaleString()}\n` : '') +
      (dues.lateFee > 0 ? `• දින ${dues.daysOverdue}ක ප්‍රමාද දඩය: රු. ${dues.lateFee.toLocaleString()}\n` : '') +
      `• *මෙම සතියේ ගෙවිය යුතු මුළු එකතුව:* රු. ${dues.totalWeeklyDue.toLocaleString()}\n` +
      `• නියමිත දිනය: ${loan.currentDueDate}\n\n` +
      `ඔබට මෙම සතියේ ගෙවීම් මුදල (රු. ${dues.totalWeeklyDue.toLocaleString()}) පමණක් ගෙවා ණය මුදල ඊළඟ සතියට කල් දැමිය හැක. සම්පූර්ණ මුදල පියවන්නේ නම් රු. ${dues.fullSettlementDue.toLocaleString()} ගෙවිය යුතුය.\n\n` +
      `💳 *ගෙවීම් තැන්පත් කළ යුතු බැංකු විස්තර:*\n` +
      `• බැංකුව: Dialog Finance PLC\n` +
      `• ගිණුම් අංකය: 001020012314\n` +
      `• නම: VS DISANAYAKA\n` +
      `• ශාඛාව: Head office\n\n` +
      `🌐 *ඔබගේ ණය විස්තර බැලීමට & Slips Upload කිරීමට:* https://qclone.up.railway.app\n\n` +
      `⚠️ *අවවාදයයි:* නියමිත දිනට නොගෙවා පැහැර හැරියහොත් ගිවිසුම් කොන්දේසි අනුව CRIB ලේඛනයට ඇතුළත් කිරීමට නෛතික පියවර ගනු ලැබේ.\n\n` +
      `ස්තූතියි!\nQC Lone Management.`
    );

    const cleanPhone = loan.clientPhone.replace(/^0/, '94').replace(/\s+/g, '');

    html += `
      <tr class="hover:bg-slate-850/60 transition">
        <td class="px-4 py-3">
          <div class="font-bold text-white">${loan.clientName}</div>
          <div class="text-[11px] text-slate-400 font-mono">${loan.clientPhone}</div>
          <div class="text-[10px] text-slate-500">සතිය #${loan.cycleWeekNumber || 1}</div>
        </td>
        <td class="px-4 py-3 font-mono font-bold text-white">
          ${formatLKR(dues.principal)}
        </td>
        <td class="px-4 py-3 font-mono font-bold text-amber-400">
          <div>${formatLKR(dues.totalWeeklyDue)}</div>
          ${dues.arrears > 0 || dues.lateFee > 0 ? `<div class="text-[9px] text-slate-400 font-normal">පොලිය ${formatLKR(dues.weeklyInterest)}${dues.arrears > 0 ? ' + හිඟ ' + formatLKR(dues.arrears) : ''}${dues.lateFee > 0 ? ' + දඩ ' + formatLKR(dues.lateFee) : ''}</div>` : ''}
        </td>
        <td class="px-4 py-3 font-mono text-slate-200">
          ${loan.currentDueDate || '--'}
        </td>
        <td class="px-4 py-3">
          ${dueStatusBadge}
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center space-x-1.5">
            <a href="https://wa.me/${cleanPhone}?text=${whatsappMsg}" target="_blank" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 text-xs font-bold transition flex items-center space-x-1">
              <i class="fa-brands fa-whatsapp text-emerald-400"></i>
              <span>WhatsApp</span>
            </a>
            <a href="tel:${loan.clientPhone}" class="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs transition" title="Call">
              <i class="fa-solid fa-phone"></i>
            </a>
          </div>
        </td>
        <td class="px-4 py-3 text-right">
          <button onclick="generateLoanAgreementPDF('${loan.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition flex items-center space-x-1 ml-auto">
            <i class="fa-solid fa-file-pdf"></i>
            <span>ගිවිසුම (PDF)</span>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// 3. Repayment Slips Approval Table
function renderRepaymentSlipsTable() {
  const tbody = document.getElementById('table-repayment-slips-body');
  const slips = state.payments;

  if (slips.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-slate-500 font-sinhala">
          තහවුරු කිරීම සඳහා ගෙවීම් Slips නොමැත.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  slips.forEach(payment => {
    const isPending = payment.status === 'PENDING_VERIFICATION';
    const isInterestOnly = payment.type === 'INTEREST_ONLY';

    html += `
      <tr class="hover:bg-slate-850/60 transition">
        <td class="px-4 py-3 text-slate-400 font-mono text-[11px]">
          ${payment.paidDate}
        </td>
        <td class="px-4 py-3">
          <div class="font-bold text-white">${payment.clientName}</div>
          <div class="text-[11px] text-slate-400 font-mono">${payment.clientNic}</div>
        </td>
        <td class="px-4 py-3 font-mono font-bold ${isInterestOnly ? 'text-amber-400' : 'text-emerald-400'}">
          ${formatLKR(payment.amountPaid)}
        </td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isInterestOnly ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}">
            ${isInterestOnly ? 'පොලිය පමණි (Rollover)' : 'සම්පූර්ණ පියවීම'}
          </span>
        </td>
        <td class="px-4 py-3">
          <button onclick="viewUploadedDocument('ගෙවීම් Slip පත', '${payment.slipName}')" class="px-2 py-1 rounded bg-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-600">
            <i class="fa-solid fa-receipt mr-1"></i> Slip බලන්න
          </button>
        </td>
        <td class="px-4 py-3 text-right">
          ${isPending ? `
            <button onclick="approveRepaymentSlip('${payment.id}')" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20">
              Approve (තහවුරු කරන්න)
            </button>
          ` : `
            <span class="text-xs text-emerald-400 font-bold flex items-center justify-end space-x-1">
              <i class="fa-solid fa-circle-check"></i>
              <span>Approved</span>
            </span>
          `}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function approveRepaymentSlip(paymentId) {
  const payment = state.payments.find(p => p.id === paymentId);
  if (!payment) return;

  const loan = state.loans.find(l => l.id === payment.loanId);
  if (!loan) return;

  payment.status = 'APPROVED';
  const dues = calculateLoanDues(loan);
  const paid = Number(payment.amountPaid || 0);

  if (payment.type === 'FULL_SETTLEMENT' || paid >= dues.fullSettlementDue) {
    // Settle loan completely
    loan.status = 'SETTLED';
    loan.arrearsInterest = 0;
    loan.totalInterestPaidSoFar = (loan.totalInterestPaidSoFar || 0) + (paid - loan.principalAmount);
    showToast(`සම්පූර්ණ මුදල (${formatLKR(paid)}) පියවා ඇත! ${loan.clientName} මහතා ණයෙන් සම්පූර්ණයෙන්ම නිදහස් විය.`, 'success');
  } else {
    // Partial, Exact or Principal Reduction
    const currentDue = new Date(loan.currentDueDate || new Date());
    const newDueDate = new Date(currentDue.getTime() + 7 * 24 * 60 * 60 * 1000);
    loan.currentDueDate = newDueDate.toISOString().split('T')[0];
    loan.cycleWeekNumber = (loan.cycleWeekNumber || 1) + 1;

    if (paid < dues.totalWeeklyDue) {
      // Partial Payment: shortfall becomes arrears for next week
      const shortfall = dues.totalWeeklyDue - paid;
      loan.arrearsInterest = shortfall;
      loan.totalInterestPaidSoFar = (loan.totalInterestPaidSoFar || 0) + paid;
      showToast(`කොටස් වශයෙන් ${formatLKR(paid)} ගෙවීම තහවුරු විය. හිඟ මුදල වන ${formatLKR(shortfall)} ඊළඟ සතියට (${loan.currentDueDate}) එකතු විය.`, 'info');
    } else if (paid === dues.totalWeeklyDue) {
      // Exact weekly dues paid
      loan.arrearsInterest = 0;
      loan.totalInterestPaidSoFar = (loan.totalInterestPaidSoFar || 0) + paid;
      showToast(`සතිපතා ගෙවීම (${formatLKR(paid)}) සම්පූර්ණයි. ණය මුදල ඊළඟ සතියට (${loan.currentDueDate}) සාර්ථකව කල් තැබුණි!`, 'success');
    } else {
      // Overpayment: Extra amount reduces the principal!
      const extraPrincipalPayment = paid - dues.totalWeeklyDue;
      loan.principalAmount = Math.max(0, loan.principalAmount - extraPrincipalPayment);
      loan.weeklyInterest = Math.round(loan.principalAmount * WEEKLY_INTEREST_RATE);
      loan.arrearsInterest = 0;
      loan.totalInterestPaidSoFar = (loan.totalInterestPaidSoFar || 0) + dues.totalWeeklyDue;

      showToast(`පොලියට අමතරව රු. ${extraPrincipalPayment.toLocaleString()} කින් මුල් ණය අඩු විය! නව ණය මුදල: ${formatLKR(loan.principalAmount)}.`, 'success');
    }
  }

  saveState();
  renderAdminDashboard();
}

// 4. All Clients Table
function renderAllClientsTable() {
  const tbody = document.getElementById('table-all-clients-body');
  const clients = state.clients;

  let html = '';
  clients.forEach(c => {
    const clientLoans = state.loans.filter(l => l.clientId === c.id || l.clientNic === c.nic);
    const activeLoan = clientLoans.find(l => l.status === 'ACTIVE');
    const loanStatusStr = activeLoan 
      ? `<span class="text-emerald-400 font-bold">${formatLKR(activeLoan.principalAmount)} (Active)</span>`
      : `<span class="text-slate-500">ණය නොමැත</span>`;

    html += `
      <tr class="hover:bg-slate-850/60 transition">
        <td class="px-4 py-3">
          <div class="font-bold text-white">${c.fullName}</div>
          <div class="text-[11px] text-slate-400 font-mono">${c.nic}</div>
        </td>
        <td class="px-4 py-3 text-slate-300 font-mono">
          ${c.phone}
        </td>
        <td class="px-4 py-3 text-slate-400 text-[11px]">
          ${c.address || '--'}
        </td>
        <td class="px-4 py-3">
          <div class="text-white text-xs">${c.guarantor?.name || '--'}</div>
          <div class="text-[10px] text-slate-400 font-mono">${c.guarantor?.phone || ''}</div>
        </td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${c.docFeeStatus === 'VERIFIED' ? 'bg-teal-500/20 text-teal-300' : 'bg-amber-500/20 text-amber-300'}">
            ${c.docFeeStatus === 'VERIFIED' ? 'රු. 100 ගෙවා ඇත' : 'තහවුරු වෙමින් පවතී'}
          </span>
        </td>
        <td class="px-4 py-3 text-right">
          ${loanStatusStr}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Update Floating WhatsApp Link
function updateFloatingWhatsAppLink() {
  const link = document.getElementById('link-floating-whatsapp');
  if (!link) return;
  const phone = (state.supportPhone || '0771234567').replace(/^0/, '94').replace(/\s+/g, '');
  const msg = encodeURIComponent('ආයුබෝවන් QC Lone! මට ණය ලබාගැනීම හෝ ලියාපදිංචිය සම්බන්ධයෙන් සහයක් අවශ්‍යයි.');
  link.href = `https://wa.me/${phone}?text=${msg}`;
}

// --- ADMIN SETTINGS & PIN CHANGE MODAL ---
function openAdminSettingsModal() {
  document.getElementById('modal-admin-settings').classList.remove('hidden');
  document.getElementById('modal-admin-settings').classList.add('flex');
  document.getElementById('settings-support-phone').value = state.supportPhone || '0771234567';
  document.getElementById('settings-daily-late-fee').value = state.dailyLateFee !== undefined ? state.dailyLateFee : 50;
  document.getElementById('settings-one-loan-rule').value = state.oneActiveLoanOnly !== false ? 'true' : 'false';
  document.getElementById('settings-current-pin').value = '';
  document.getElementById('settings-new-pin').value = '';
  document.getElementById('settings-confirm-pin').value = '';
}

function closeAdminSettingsModal() {
  document.getElementById('modal-admin-settings').classList.add('hidden');
  document.getElementById('modal-admin-settings').classList.remove('flex');
}

function handleAdminSettingsSave(e) {
  e.preventDefault();

  const phone = document.getElementById('settings-support-phone').value.trim();
  const lateFee = parseInt(document.getElementById('settings-daily-late-fee').value || 0, 10);
  const oneLoanRule = document.getElementById('settings-one-loan-rule').value === 'true';

  const currentPin = document.getElementById('settings-current-pin').value.trim();
  const newPin = document.getElementById('settings-new-pin').value.trim();
  const confirmPin = document.getElementById('settings-confirm-pin').value.trim();

  // Update lending settings
  state.dailyLateFee = lateFee;
  state.oneActiveLoanOnly = oneLoanRule;

  if (phone) {
    state.supportPhone = phone;
    updateFloatingWhatsAppLink();
  }

  // Handle PIN change if requested
  if (currentPin || newPin || confirmPin) {
    if (currentPin !== state.adminPin) {
      showToast('දැනට පවතින PIN අංකය වැරදියි!', 'error');
      return;
    }

    if (!newPin || newPin.length < 4) {
      showToast('නව PIN අංකය සඳහා අවම වශයෙන් අංක 4ක් යොදන්න!', 'error');
      return;
    }

    if (newPin !== confirmPin) {
      showToast('නව PIN අංක දෙක නොගැලපේ (Mismatch)!', 'error');
      return;
    }

    state.adminPin = newPin;
    showToast('Admin PIN අංකය සාර්ථකව වෙනස් කරන ලදී!', 'success');
  } else {
    showToast('QC Lone ණය නීති සහ සැකසුම් සාර්ථකව සුරකින ලදී!', 'success');
  }

  saveState();
  closeAdminSettingsModal();
  renderAdminDashboard();
}

// --- DOCUMENT VIEWER MODAL ---
function viewUploadedDocument(title, filename) {
  document.getElementById('doc-viewer-title').innerText = title;
  const content = document.getElementById('doc-viewer-content');

  content.innerHTML = `
    <div class="text-center p-6 space-y-3">
      <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl mx-auto">
        <i class="fa-solid fa-file-invoice"></i>
      </div>
      <div>
        <h4 class="text-sm font-bold text-white">${filename}</h4>
        <p class="text-xs text-slate-400 font-sinhala">පාරිභෝගිකයා විසින් යොමුකරන ලද ලේඛනය / Slip පත සාර්ථකව සම්බන්ධ වී ඇත.</p>
      </div>
      <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400">
        Status: Verified & Validated for QC Lone
      </div>
    </div>
  `;

  document.getElementById('modal-doc-viewer').classList.remove('hidden');
  document.getElementById('modal-doc-viewer').classList.add('flex');
}

// View Signatures in Modal
function viewSignaturesModal(loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan || !loan.signatures) return;

  document.getElementById('doc-viewer-title').innerText = `${loan.clientName} - ඩිජිටල් අත්සන් 2`;
  const content = document.getElementById('doc-viewer-content');

  content.innerHTML = `
    <div class="w-full space-y-4 p-2">
      <div class="p-3 rounded-xl bg-slate-900 border border-slate-800">
        <span class="text-xs font-bold text-emerald-400 block mb-2">1. කොන්දේසි සහ CRIB එකඟතා අත්සන:</span>
        <div class="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-center">
          ${loan.signatures.termsData ? `<img src="${loan.signatures.termsData}" class="max-h-24" alt="Terms Signature">` : '<span class="text-xs text-slate-500">අත්සනක් නොමැත</span>'}
        </div>
      </div>

      <div class="p-3 rounded-xl bg-slate-900 border border-slate-800">
        <span class="text-xs font-bold text-teal-400 block mb-2">2. තොරතුරු සත්‍ය බව තහවුරු කිරීමේ අත්සන:</span>
        <div class="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-center">
          ${loan.signatures.truthData ? `<img src="${loan.signatures.truthData}" class="max-h-24" alt="Truth Signature">` : '<span class="text-xs text-slate-500">අත්සනක් නොමැත</span>'}
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-doc-viewer').classList.remove('hidden');
  document.getElementById('modal-doc-viewer').classList.add('flex');
}

function closeDocViewerModal() {
  document.getElementById('modal-doc-viewer').classList.add('hidden');
  document.getElementById('modal-doc-viewer').classList.remove('flex');
}

// --- MANUAL LOAN MODAL ---
function openNewManualLoanModal() {
  document.getElementById('modal-manual-loan').classList.remove('hidden');
  document.getElementById('modal-manual-loan').classList.add('flex');
}

function closeManualLoanModal() {
  document.getElementById('modal-manual-loan').classList.add('hidden');
  document.getElementById('modal-manual-loan').classList.remove('flex');
}

document.getElementById('manual-amount')?.addEventListener('input', function() {
  const amount = parseInt(this.value || 0, 10);
  const interest = Math.round(amount * WEEKLY_INTEREST_RATE);
  document.getElementById('manual-interest-preview').value = formatLKR(interest);
});

function handleManualLoanSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('manual-name').value.trim();
  const nic = document.getElementById('manual-nic').value.trim();
  const phone = document.getElementById('manual-phone').value.trim();
  const amount = parseInt(document.getElementById('manual-amount').value, 10);

  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const loanId = 'LONE-' + Math.floor(100 + Math.random() * 900);
  const weeklyInterest = Math.round(amount * WEEKLY_INTEREST_RATE);

  state.loans.unshift({
    id: loanId,
    clientId: 'CLI-' + Math.floor(100 + Math.random() * 900),
    clientName: name,
    clientNic: nic,
    clientPhone: phone,
    principalAmount: amount,
    interestRate: WEEKLY_INTEREST_RATE,
    weeklyInterest: weeklyInterest,
    disbursedDate: today.toISOString().split('T')[0],
    currentDueDate: nextWeek.toISOString().split('T')[0],
    cycleWeekNumber: 1,
    totalInterestPaidSoFar: 0,
    status: 'ACTIVE',
    loanReason: 'සෘජු මුදල් ලබාදීම',
    signatures: {
      termsSigned: true,
      truthSigned: true,
      termsData: null,
      truthData: null
    }
  });

  saveState();
  closeManualLoanModal();
  renderAdminDashboard();
  showToast(`${name} මහතාට රු. ${amount.toLocaleString()} ක ණය මුදල සෘජුවම එකතු කරන ලදී!`, 'success');
}

// --- OFFICIAL LOAN AGREEMENT PRINT & PDF GENERATOR (WITH AUTO NAME, NIC, DATE & CRIB) ---
function generateLoanAgreementPDF(loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;

  const client = state.clients.find(c => c.id === loan.clientId || c.nic === loan.clientNic) || {};
  const guarantor = client.guarantor || { name: 'නැත', nic: '--', phone: '--' };
  const agreementDate = loan.disbursedDate || loan.appliedDate || new Date().toISOString().split('T')[0];

  const printArea = document.getElementById('print-agreement-area');
  printArea.innerHTML = `
    <div style="font-family: Arial, sans-serif; padding: 25px; max-width: 800px; margin: auto; border: 3px double #047857; background: #fff; color: #000;">
      
      <!-- Official Header -->
      <div style="text-align: center; border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 15px;">
        <div style="display: inline-block; padding: 2px 10px; background: #ecfdf5; border: 1px solid #059669; border-radius: 4px; font-size: 11px; font-weight: bold; color: #047857; margin-bottom: 4px;">
          OFFICIAL LEGAL CONTRACT
        </div>
        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1.5px; color: #064e3b;">QC LONE MICROFINANCE</h1>
        <h3 style="margin: 4px 0; font-size: 15px; color: #111;">සතිපතා ණය ගිවිසුම් පත්‍රය සහ නෛතික ප්‍රතිඥා පත්‍රය</h3>
        <p style="margin: 0; font-size: 11px; color: #444;">Loan Agreement & Legal Promissory Note</p>
        <div style="margin-top: 8px; font-size: 12px; font-weight: bold; background: #f8fafc; padding: 6px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
          <span>ගිවිසුම් අංකය: <strong style="color: #047857;">${loan.id}</strong></span>
          <span>නිකුත් කළ දිනය (Date): <strong style="color: #047857;">${agreementDate}</strong></span>
        </div>
      </div>

      <!-- Auto Populated Parties Section -->
      <div style="margin-bottom: 15px; font-size: 12px; line-height: 1.6; background: #fdfdfd; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
        <p style="margin: 3px 0;"><strong>1. ණය හිමියා (Lender):</strong> QC Lone Microfinance Management</p>
        <p style="margin: 3px 0;"><strong>2. ණය ගැතියාගේ නම (Borrower Name):</strong> <span style="font-size: 14px; font-weight: bold; color: #064e3b; text-decoration: underline;">${loan.clientName}</span></p>
        <p style="margin: 3px 0;"><strong>3. ජාතික හැඳුනුම්පත් අංකය (NIC No):</strong> <span style="font-size: 13px; font-weight: bold; color: #b45309; font-family: monospace;">${loan.clientNic}</span></p>
        <p style="margin: 3px 0;"><strong>4. ස්ථිර ලිපිනය (Residential Address):</strong> ${client.address || 'ලිපිනය තහවුරු කර ඇත'} | <strong>දුරකථන:</strong> ${loan.clientPhone}</p>
        <p style="margin: 3px 0;"><strong>5. ඇපකරුගේ විස්තර (Guarantor):</strong> ${guarantor.name} (NIC: <strong>${guarantor.nic}</strong>, දුරකථන: ${guarantor.phone})</p>
      </div>

      <!-- Terms Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">
        <thead>
          <tr style="background: #e2e8f0;">
            <th style="border: 1px solid #94a3b8; padding: 6px; text-align: left;">විස්තරය (Description)</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">මුදල (Amount in LKR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px;">ලබාගත් මුල් ණය මුදල (Principal Amount)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; font-size: 13px;">${formatLKR(loan.principalAmount)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px;">සතිපතා පොලී අනුපාතිකය (Weekly 15% Interest)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; color: #b45309;">${formatLKR(loan.weeklyInterest)} / සතියකට</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px;">පළමු වාරිකය නියමිත දිනය (First Due Date)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold;">${loan.currentDueDate || 'ලබාදුන් දින සිට දින 7ක් ඇතුළත'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px;">ලියාපදිංචි සහ ලේඛන ගාස්තුව (Doc & Legal Fee)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; color: #047857; font-weight: bold;">රු. 100.00 (Paid & Verified)</td>
          </tr>
        </tbody>
      </table>

      <!-- Conditions & CRIB Clause -->
      <div style="font-size: 10.5px; line-height: 1.45; margin-bottom: 18px; text-align: justify; border: 1.5px solid #ef4444; padding: 10px; background: #fffaf0; border-radius: 4px;">
        <h4 style="margin: 0 0 4px 0; font-size: 11px; color: #b91c1c;">නෛතික කොන්දේසි සහ CRIB අනතුරු ඇඟවීම (Mandatory Terms & CRIB Warning):</h4>
        <ol style="margin: 0; padding-left: 18px;">
          <li>ණය ගැතියා විසින් සෑම සතියකම නියමිත දිනට පෙර සතිපතා 15% පොලී මුදල (රු. ${loan.weeklyInterest.toLocaleString()}) හෝ සම්පූර්ණ මුදල පියවිය යුතුය.</li>
          <li>සම්පූර්ණ මුදල පියවීමට නොහැකි අවස්ථාවක, සතිපතා පොලිය පමණක් ගෙවා ණය මුදල ඊළඟ සතියට කල් දැමිය හැක (Rollover).</li>
          <li><strong>රු. 100 ලේඛන ගාස්තු ප්‍රතිපත්තිය:</strong> කිසියම් හෙයකින් ණය මුදල ප්‍රතික්ෂේප (Reject) වුවහොත් Online Banking මඟින් ගෙවූ රු. 100 මුදල දින 7ක් ඇතුළත ගෙවූ ගිණුමටම Refund කෙරේ. (CDM මඟින් තැන්පත් කළ මුදල් කිසිවක් Refund නොකෙරේ).</li>
          <li><strong>CRIB සහ නීතිමය ක්‍රියාමාර්ග:</strong> කිසියම් හෙයකින් ණය මුදල හෝ සතිපතා පොලිය නියමිත පරිදි නොගෙවා පැහැර හරිනු ලැබුවහොත්, ණය ගැතියාගේ සහ ඇපකරුගේ තොරතුරු <strong>ශ්‍රී ලංකා ණය තොරතුරු කාර්යාංශය (CRIB - Credit Information Bureau)</strong> වෙත ඇතුළත් කරන බවටත්, පොලිස් පැමිණිලි සහ දිසා අධිකරණයේ සිවිල් නඩු පැවරීම මඟින් සම්පූර්ණ මුදල, ප්‍රමාද පොලී සහ නඩු ගාස්තු අයකර ගැනීමට ආයතනයට නෛතික බලය ඇති බවට එකඟ වෙමි.</li>
          <li>ණය ගැතියා විසින් ඉදිරිපත් කළ සියලු තොරතුරු, ලිපිනයන් සහ NIC පිටපත් සත්‍ය බවට පිළිගනු ලැබේ.</li>
        </ol>
      </div>

      <!-- Signatures Area (Including Captured Digital Signatures) -->
      <div style="display: flex; justify-content: space-between; margin-top: 15px; font-size: 11px;">
        
        <!-- Borrower Sig 1 -->
        <div style="text-align: center; width: 31%; border: 1px solid #cbd5e1; padding: 6px; border-radius: 4px; background: #f8fafc;">
          <div style="height: 48px; display: flex; align-items: center; justify-content: center;">
            ${loan.signatures?.termsData ? `<img src="${loan.signatures.termsData}" style="max-height: 45px; max-width: 100%;" alt="Sig A">` : '<span style="color: #64748b; font-size: 10px;">ඩිජිටල් අත්සන තබා ඇත</span>'}
          </div>
          <div style="border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
            <strong>ණය ගැතියා (CRIB එකඟතාව)</strong><br>
            <span style="font-weight: bold; color: #047857;">${loan.clientName}</span><br>
            <span style="font-size: 9px; color: #475569;">දිනය: ${agreementDate}</span>
          </div>
        </div>

        <!-- Borrower Sig 2 -->
        <div style="text-align: center; width: 31%; border: 1px solid #cbd5e1; padding: 6px; border-radius: 4px; background: #f8fafc;">
          <div style="height: 48px; display: flex; align-items: center; justify-content: center;">
            ${loan.signatures?.truthData ? `<img src="${loan.signatures.truthData}" style="max-height: 45px; max-width: 100%;" alt="Sig B">` : '<span style="color: #64748b; font-size: 10px;">ඩිජිටල් අත්සන තබා ඇත</span>'}
          </div>
          <div style="border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
            <strong>තොරතුරු සත්‍ය බව සහතිකය</strong><br>
            <span style="font-weight: bold; color: #b45309;">NIC: ${loan.clientNic}</span><br>
            <span style="font-size: 9px; color: #475569;">දිනය: ${agreementDate}</span>
          </div>
        </div>

        <!-- Authorized Lender -->
        <div style="text-align: center; width: 31%; border: 1px solid #cbd5e1; padding: 6px; border-radius: 4px; background: #f8fafc;">
          <div style="height: 48px; display: flex; align-items: center; justify-content: center;">
            <div style="border: 2px solid #047857; color: #047857; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 3px;">
              QC LONE SEAL & APPROVED
            </div>
          </div>
          <div style="border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
            <strong>QC Lone බලයලත් නිලධාරී</strong><br>
            (Authorized Lender)<br>
            <span style="font-size: 9px; color: #475569;">දිනය: ${agreementDate}</span>
          </div>
        </div>

      </div>

    </div>
  `;

  window.print();
}

// --- BACKUP & RESTORE ---
function exportDataBackup() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `qc_lone_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('QC Lone දත්ත Backup එක සාර්ථකව Download විය!', 'success');
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  loadState();
  updateCalculator(slider.value);
  updateAdminStats();
  initSignaturePads();
  updateFloatingWhatsAppLink();
});
