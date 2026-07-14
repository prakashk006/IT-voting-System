// Automated Security & Validation Test Suite
process.env.PORT = 5001; // Run test server on port 5001
process.env.NODE_ENV = 'test'; // Enable test mode bypass for OTPs

const http = require('http');
const db = require('./db');
const seed = require('./seed');

// Start the server
require('./server');

const BASE_URL = 'http://localhost:5001/api';

const makeRequest = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (err) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('\n======================================================');
  console.log('🚀 RUNNING SECURE 2FA & LOCKOUT VERIFICATION TESTS');
  console.log('======================================================\n');

  let testStudentToken = null;
  let testAdminToken = null;
  let demoOtp = null;

  try {
    // Wait for DB initialization
    await new Promise(r => setTimeout(r, 1200));

    // Reset database to a clean test state before starting
    await db.delete('votes', {});
    await db.delete('candidates', {});
    await db.update('students', {}, { has_voted: 0, otp: null, otp_expiry: null, failed_attempts: 0, is_blocked: 0 });
    await db.update('settings', { key: 'results_released' }, { value: 'false' });
    await seed();

    // TEST 1: Request login for UNREGISTERED student ID
    console.log('Test 1: Attempting login with unregistered student ID...');
    const unregisteredRes = await makeRequest('/auth/login-step1', 'POST', {
      studentId: 'IT202699', // Not in database
      password: 'AA15082005'
    });

    if (unregisteredRes.status !== 404) {
      throw new Error(`Test 1 Failed: Registry verification bypassed! Status: ${unregisteredRes.status}`);
    }
    console.log(`✅ Test 1 Passed. Unregistered email correctly blocked: "${unregisteredRes.body.error}"`);

    // TEST 2: Lockout Protection (Submit 3 failed password attempts)
    console.log('\nTest 2: Inducing Bruteforce Lockout for student IT202602...');
    
    // Attempt 1: Failed password
    const fail1 = await makeRequest('/auth/login-step1', 'POST', {
      studentId: 'IT202602',
      password: 'WRONGPASSWORD'
    });
    console.log(`- Attempt 1: Status ${fail1.status} - ${fail1.body.error}`);

    // Attempt 2: Failed password
    const fail2 = await makeRequest('/auth/login-step1', 'POST', {
      studentId: 'IT202602',
      password: 'WRONGPASSWORD'
    });
    console.log(`- Attempt 2: Status ${fail2.status} - ${fail2.body.error}`);

    // Attempt 3: Failed password (triggers block)
    const fail3 = await makeRequest('/auth/login-step1', 'POST', {
      studentId: 'IT202602',
      password: 'WRONGPASSWORD'
    });
    console.log(`- Attempt 3: Status ${fail3.status} - ${fail3.body.error}`);

    if (fail3.status !== 403) {
      throw new Error(`Test 2 Failed: Account was not blocked after 3 failed attempts. Status: ${fail3.status}`);
    }
    console.log('✅ Test 2 Passed. Account successfully locked.');

    // TEST 3: Attempting login on BLOCKED account with CORRECT password
    console.log('\nTest 3: Attempting correct password on blocked account...');
    const blockedLoginRes = await makeRequest('/auth/login-step1', 'POST', {
      studentId: 'IT202602',
      password: 'BH22102006' // Correct password
    });

    if (blockedLoginRes.status !== 403) {
      throw new Error(`Test 3 Failed: Allowed to authenticate on blocked account. Status: ${blockedLoginRes.status}`);
    }
    console.log(`✅ Test 3 Passed. Block enforced: "${blockedLoginRes.body.error}"`);

    // TEST 4: Log in as Admin to unblock voter
    console.log('\nTest 4: Logging in as Admin...');
    const adminLoginRes = await makeRequest('/admin/login', 'POST', {
      password: 'admin'
    });
    if (adminLoginRes.status !== 200 || !adminLoginRes.body.token) {
      throw new Error('Test 4 Failed: Admin login failed');
    }
    testAdminToken = adminLoginRes.body.token;
    console.log('✅ Test 4 Passed. Admin token issued.');

    // TEST 5: Unblock student IT202602 via Admin API
    console.log('\nTest 5: Unblocking student IT202602 via Admin Control Panel...');
    const unblockRes = await makeRequest('/admin/unblock-student', 'POST', {
      studentId: 'IT202602'
    }, testAdminToken);

    if (unblockRes.status !== 200) {
      throw new Error(`Test 5 Failed: Could not unblock student: ${JSON.stringify(unblockRes.body)}`);
    }
    console.log('✅ Test 5 Passed. Student account unlocked.');

    // TEST 6: Student IT202602 logs in again with correct password
    console.log('\nTest 6: Logging in again as IT202602 after unlock...');
    const loginAfterUnlock = await makeRequest('/auth/login-step1', 'POST', {
      studentId: 'IT202602',
      password: 'BH22102006'
    });

    if (loginAfterUnlock.status !== 200 || !loginAfterUnlock.body.demoOtp) {
      throw new Error(`Test 6 Failed: Login failed after unblocking: ${JSON.stringify(loginAfterUnlock.body)}`);
    }
    demoOtp = loginAfterUnlock.body.demoOtp;
    console.log(`✅ Test 6 Passed. Step 1 Login success! OTP Generated: ${demoOtp}`);

    // TEST 7: OTP 2FA Verification (Incorrect OTP)
    console.log('\nTest 7: Verifying incorrect OTP code...');
    const wrongOtpRes = await makeRequest('/auth/verify-otp', 'POST', {
      studentId: 'IT202602',
      otp: '123456'
    });
    // Wait, the endpoint is login-step2, let's verify path:
    // Ah, in server.js, the endpoint is POST /api/auth/login-step2 !
    // Let's use /auth/login-step2 in our HTTP request
    const wrongOtpResReal = await makeRequest('/auth/login-step2', 'POST', {
      studentId: 'IT202602',
      otp: '123456'
    });

    if (wrongOtpResReal.status !== 400) {
      throw new Error(`Test 7 Failed: Wrong OTP was not rejected. Status: ${wrongOtpResReal.status}`);
    }
    console.log(`✅ Test 7 Passed. Wrong OTP rejected successfully: "${wrongOtpResReal.body.error}"`);

    // TEST 8: OTP 2FA Verification (Correct OTP)
    console.log('\nTest 8: Verifying correct OTP...');
    const correctOtpRes = await makeRequest('/auth/login-step2', 'POST', {
      studentId: 'IT202602',
      otp: demoOtp
    });

    if (correctOtpRes.status !== 200 || !correctOtpRes.body.token) {
      throw new Error(`Test 8 Failed: Verification failed: ${JSON.stringify(correctOtpRes.body)}`);
    }
    testStudentToken = correctOtpRes.body.token;
    console.log('✅ Test 8 Passed. 2FA verification complete. Session token generated.');

    // TEST 9: Cast ballot
    console.log('\nTest 9: Casting ballot...');
    const voteRes = await makeRequest('/vote', 'POST', {
      selections: {
        'President': 1,
        'Vice-President': 3,
        'Secretary': 5,
        'Joint Secretary': 7
      }
    }, testStudentToken);

    if (voteRes.status !== 200) {
      throw new Error(`Test 9 Failed: Voting failed: ${JSON.stringify(voteRes.body)}`);
    }
    console.log('✅ Test 9 Passed. Vote registered.');

    // TEST 10: Double Voting Prevention (Second Vote Attempt)
    console.log('\nTest 10: Attempting to double-vote with same session...');
    const doubleVoteRes = await makeRequest('/vote', 'POST', {
      selections: { 'President': 2 }
    }, testStudentToken);

    if (doubleVoteRes.status === 200) {
      throw new Error('Test 10 Failed: Allowed to double vote!');
    }
    console.log(`✅ Test 10 Passed. Double vote blocked: "${doubleVoteRes.body.error}"`);

    // TEST 11: Attempting to log in again after voting
    console.log('\nTest 11: Attempting to log in again after voting...');
    const reloginRes = await makeRequest('/auth/login-step1', 'POST', {
      studentId: 'IT202602',
      password: 'BH22102006'
    });

    if (reloginRes.status === 200) {
      throw new Error('Test 11 Failed: Re-login allowed for voted student!');
    }
    console.log(`✅ Test 11 Passed. Re-login blocked: "${reloginRes.body.error}"`);

    // TEST 12: Admin dashboard tallies
    console.log('\nTest 12: Checking live standings as Admin...');
    const adminStats = await makeRequest('/admin/stats', 'GET', null, testAdminToken);
    if (adminStats.status !== 200 || adminStats.body.votedCount !== 1) {
      throw new Error(`Test 12 Failed: Turnout count incorrect: ${JSON.stringify(adminStats.body)}`);
    }
    console.log(`✅ Test 12 Passed. Turnout correct. Voted: ${adminStats.body.votedCount}`);

    // TEST 13: Reset election
    console.log('\nTest 13: Resetting election...');
    const resetRes = await makeRequest('/admin/reset-election', 'POST', null, testAdminToken);
    if (resetRes.status !== 200) {
      throw new Error('Test 13 Failed: Reset election failed.');
    }
    console.log('✅ Test 13 Passed. Election reset complete.');

    console.log('\n======================================================');
    console.log('🎉 ALL 2FA & LOCKOUT SECURITY TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILURE:', err.message);
    process.exit(1);
  }
};

runTests();
