/**
 * QC LONE - Node.js Production Server with Railway PostgreSQL Integration
 * Supports Real-Time Sync across all client devices and Admin Portal
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'qc_state.json');

// Ensure local data dir exists for fallback
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Initial Clean State
const DEFAULT_STATE = {
  adminPin: '1234',
  supportPhone: '+60164245490',
  dailyLateFee: 50,
  oneActiveLoanOnly: true,
  clients: [],
  loans: [],
  payments: [],
  totalDocFeeCollected: 0
};

let inMemoryState = JSON.parse(JSON.stringify(DEFAULT_STATE));
let pgPool = null;
let isPostgresReady = false;

// Initialize Database (PostgreSQL if DATABASE_URL is available, else File Fallback)
async function initDatabase() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_PUBLIC_URL;
  
  if (dbUrl) {
    try {
      const { Pool } = require('pg');
      pgPool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
      });

      // Create storage table if not exists
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS qc_lone_app_state (
          id VARCHAR(32) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Try loading existing state from PostgreSQL
      const res = await pgPool.query(`SELECT data FROM qc_lone_app_state WHERE id = 'prod_state' LIMIT 1;`);
      if (res.rows && res.rows.length > 0 && res.rows[0].data) {
        inMemoryState = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), res.rows[0].data);
        console.log('✅ Connected to Railway PostgreSQL & loaded state successfully.');
      } else {
        // Initialize default state in DB
        await pgPool.query(`
          INSERT INTO qc_lone_app_state (id, data, updated_at) 
          VALUES ('prod_state', $1, NOW())
          ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW();
        `, [JSON.stringify(inMemoryState)]);
        console.log('✅ Initialized new state table in Railway PostgreSQL.');
      }
      isPostgresReady = true;
      return;
    } catch (err) {
      console.error('⚠️ PostgreSQL connection failed, falling back to local file storage:', err.message);
    }
  } else {
    console.log('ℹ️ No DATABASE_URL found in environment, using local file storage fallback.');
  }

  // Fallback to local JSON file
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const fileData = fs.readFileSync(LOCAL_DB_FILE, 'utf8');
      inMemoryState = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), JSON.parse(fileData));
      console.log('📁 Loaded state from local fallback file:', LOCAL_DB_FILE);
    }
  } catch (err) {
    console.error('Error reading local db fallback:', err.message);
  }
}

// Persist State to PostgreSQL and/or local fallback
async function persistState() {
  if (isPostgresReady && pgPool) {
    try {
      await pgPool.query(`
        INSERT INTO qc_lone_app_state (id, data, updated_at)
        VALUES ('prod_state', $1, NOW())
        ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW();
      `, [JSON.stringify(inMemoryState)]);
      return;
    } catch (err) {
      console.error('Error saving state to PostgreSQL:', err.message);
    }
  }

  // Local fallback save
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(inMemoryState, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving to local db file:', err.message);
  }
}

// Helper: Read JSON request body with 15MB limit for document uploads
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) { // 25MB limit
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-pin'
  });
  res.end(JSON.stringify(data));
}

// Main HTTP Request Handler
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-pin'
    });
    return res.end();
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // --- API ROUTES ---

  // 1. Health / DB Info
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      db: isPostgresReady ? 'PostgreSQL' : 'FileFallback',
      loansCount: inMemoryState.loans.length,
      clientsCount: inMemoryState.clients.length,
      timestamp: new Date().toISOString()
    });
  }

  // 2. Client Loan Application (POST /api/loans/apply)
  if (pathname === '/api/loans/apply' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const { client, loan } = payload;

      if (!client || !loan || !client.nic) {
        return sendJson(res, 400, { success: false, error: 'Missing required client or loan data' });
      }

      // Check one active loan rule
      if (inMemoryState.oneActiveLoanOnly) {
        const existingActive = inMemoryState.loans.find(l => 
          l.clientNic.toLowerCase() === client.nic.toLowerCase() && 
          (l.status === 'ACTIVE' || l.status === 'PENDING_APPROVAL')
        );
        if (existingActive) {
          return sendJson(res, 400, {
            success: false,
            error: 'ඔබට දැනටමත් සක්‍රීය හෝ අනුමැතිය අපේක්ෂිත ණයක් පවතී. එක් වරකට ලබාගත හැක්කේ එක් ණයක් පමණි.'
          });
        }
      }

      // Upsert Client
      const existingClientIdx = inMemoryState.clients.findIndex(c => c.nic.toLowerCase() === client.nic.toLowerCase());
      if (existingClientIdx >= 0) {
        inMemoryState.clients[existingClientIdx] = Object.assign(inMemoryState.clients[existingClientIdx], client);
      } else {
        inMemoryState.clients.push(client);
      }

      // Add Loan
      inMemoryState.loans.push(loan);
      inMemoryState.totalDocFeeCollected = (inMemoryState.totalDocFeeCollected || 0) + 100;

      await persistState();

      return sendJson(res, 200, {
        success: true,
        message: 'ණය අයදුම්පත සාර්ථකව පද්ධතියට ලැබුණි!',
        loanId: loan.id
      });
    } catch (err) {
      console.error('API apply error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 3. Client Loan Status Query (GET /api/loans/status?nic=...)
  if (pathname === '/api/loans/status' && req.method === 'GET') {
    const nic = (urlObj.searchParams.get('nic') || '').trim().toLowerCase();
    if (!nic) {
      return sendJson(res, 400, { success: false, error: 'NIC is required' });
    }

    const clientLoans = inMemoryState.loans.filter(l => (l.clientNic || '').toLowerCase() === nic);
    const clientPayments = inMemoryState.payments.filter(p => (p.clientNic || '').toLowerCase() === nic);

    return sendJson(res, 200, {
      success: true,
      nic: nic,
      loans: clientLoans,
      payments: clientPayments
    });
  }

  // 4. Client Repayment Submission (POST /api/payments/repay)
  if (pathname === '/api/payments/repay' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const { payment } = payload;

      if (!payment || !payment.loanId || !payment.amount) {
        return sendJson(res, 400, { success: false, error: 'Missing payment data' });
      }

      inMemoryState.payments.push(payment);
      await persistState();

      return sendJson(res, 200, {
        success: true,
        message: 'ගෙවීම් Slip පත සාර්ථකව ලැබුණි! පරිපාලක විසින් තහවුරු කරනු ඇත.',
        paymentId: payment.id
      });
    } catch (err) {
      console.error('API repay error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 5. Admin Full Data Sync (GET /api/admin/data)
  if (pathname === '/api/admin/data' && req.method === 'GET') {
    const pin = req.headers['x-admin-pin'] || urlObj.searchParams.get('pin');
    if (pin !== inMemoryState.adminPin) {
      return sendJson(res, 401, { success: false, error: 'Unauthorized PIN' });
    }

    return sendJson(res, 200, {
      success: true,
      state: inMemoryState
    });
  }

  // 6. Admin Actions (POST /api/admin/action)
  if (pathname === '/api/admin/action' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const { pin, action, data } = payload;

      if (pin !== inMemoryState.adminPin) {
        return sendJson(res, 401, { success: false, error: 'වැරදි Admin PIN අංකයකි!' });
      }

      if (action === 'APPROVE_LOAN') {
        const loan = inMemoryState.loans.find(l => l.id === data.loanId);
        if (loan) {
          loan.status = 'ACTIVE';
          loan.approvedDate = new Date().toISOString().split('T')[0];
          loan.startDate = loan.approvedDate;
          
          // Due date +7 days
          const d = new Date();
          d.setDate(d.getDate() + 7);
          loan.currentDueDate = d.toISOString().split('T')[0];
          loan.cycleWeekNumber = 1;
        }
      } else if (action === 'REJECT_LOAN') {
        const loan = inMemoryState.loans.find(l => l.id === data.loanId);
        if (loan) loan.status = 'REJECTED';
      } else if (action === 'VERIFY_PAYMENT') {
        const payment = inMemoryState.payments.find(p => p.id === data.paymentId);
        if (payment) {
          payment.status = 'VERIFIED';
          payment.verifiedAt = new Date().toISOString();

          // Apply payment to loan
          const loan = inMemoryState.loans.find(l => l.id === payment.loanId);
          if (loan) {
            loan.repayments = loan.repayments || [];
            loan.repayments.push({
              paymentId: payment.id,
              amount: payment.amount,
              date: payment.date || new Date().toISOString().split('T')[0]
            });

            const weeklyInterest = Math.round(Number(loan.principalAmount) * (Number(loan.interestRate) || 0.15));
            const paid = Number(payment.amount);

            if (paid >= loan.principalAmount + weeklyInterest) {
              loan.status = 'SETTLED';
              loan.settledDate = new Date().toISOString().split('T')[0];
            } else if (paid >= weeklyInterest) {
              const surplus = paid - weeklyInterest;
              if (surplus > 0) {
                loan.principalAmount = Math.max(0, loan.principalAmount - surplus);
              }
              // Advance week
              const currentDue = new Date(loan.currentDueDate || Date.now());
              currentDue.setDate(currentDue.getDate() + 7);
              loan.currentDueDate = currentDue.toISOString().split('T')[0];
              loan.cycleWeekNumber = (loan.cycleWeekNumber || 1) + 1;
            }
          }
        }
      } else if (action === 'REJECT_PAYMENT') {
        const payment = inMemoryState.payments.find(p => p.id === data.paymentId);
        if (payment) payment.status = 'REJECTED';
      } else if (action === 'MANUAL_LOAN') {
        if (data.client && data.loan) {
          const cIdx = inMemoryState.clients.findIndex(c => c.nic.toLowerCase() === data.client.nic.toLowerCase());
          if (cIdx >= 0) inMemoryState.clients[cIdx] = Object.assign(inMemoryState.clients[cIdx], data.client);
          else inMemoryState.clients.push(data.client);
          inMemoryState.loans.push(data.loan);
        }
      } else if (action === 'UPDATE_SETTINGS') {
        if (data.supportPhone) inMemoryState.supportPhone = data.supportPhone;
        if (data.dailyLateFee !== undefined) inMemoryState.dailyLateFee = data.dailyLateFee;
        if (data.oneActiveLoanOnly !== undefined) inMemoryState.oneActiveLoanOnly = data.oneActiveLoanOnly;
        if (data.newPin) inMemoryState.adminPin = data.newPin;
      }

      await persistState();

      return sendJson(res, 200, {
        success: true,
        state: inMemoryState
      });
    } catch (err) {
      console.error('API admin action error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackErr, fallbackContent) => {
          if (fallbackErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fallbackContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Start Server & Init DB
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`QC Lone Server running on http://0.0.0.0:${PORT}`);
  await initDatabase();
});
