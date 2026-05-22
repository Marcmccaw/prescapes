/* ============================================
   Prestige Landscapes - Firebase sync layer
   ============================================ */
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBf2ewigXXRsxnk0jmJu-XLo8EguDcvaSQ",
    authDomain: "presscape-c3394.firebaseapp.com",
    projectId: "presscape-c3394",
    storageBucket: "presscape-c3394.firebasestorage.app",
    messagingSenderId: "307277017638",
    appId: "1:307277017638:web:1b32cab7fb0abd65b86ce7",
    measurementId: "G-V3LB69NW16"
  };

  if (!window.firebase) {
    console.warn('Firebase SDK did not load. Using local browser storage only.');
    return;
  }

  const app = firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  let applyingRemote = false;
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function bookingKeyToEmail(key) {
    return key.replace(/^pl_bookings_/, '').toLowerCase();
  }

  function withMeta(data) {
    return {
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function setLocal(key, value) {
    applyingRemote = true;
    originalSetItem(key, JSON.stringify(value));
    applyingRemote = false;
  }

  async function loadAccounts() {
    const snapshot = await db.collection('accounts').get();
    const accounts = {};
    snapshot.forEach(doc => {
      const data = doc.data() || {};
      const email = normalizeEmail(data.email || doc.id);
      accounts[email] = {
        name: data.name || '',
        phone: data.phone || '',
        role: data.role || 'client',
        street: data.street || '',
        zip: data.zip || '',
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || ''
      };
    });
    setLocal('pl_accounts', accounts);
    return accounts;
  }

  async function loadSubmissions() {
    const snapshot = await db.collection('client_submissions').get();
    const submissions = [];
    snapshot.forEach(doc => submissions.push({ id: doc.id, ...(doc.data() || {}) }));
    submissions.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    setLocal('pl_client_submissions', submissions);
    return submissions;
  }

  async function loadPublicJobs() {
    const snapshot = await db.collection('public_jobs').get();
    const jobs = [];
    snapshot.forEach(doc => jobs.push({ id: doc.id, ...(doc.data() || {}) }));
    setLocal('pl_public_jobs', jobs);
    return jobs;
  }

  async function loadBookings() {
    const snapshot = await db.collection('bookings').get();
    snapshot.forEach(doc => {
      const email = normalizeEmail(doc.id);
      const data = doc.data() || {};
      setLocal(`pl_bookings_${email}`, Array.isArray(data.items) ? data.items : []);
    });
    return snapshot.size;
  }

  async function syncNow() {
    try {
      await loadPublicJobs();
      const localAccounts = safeJson(localStorage.getItem('pl_accounts'), {});
      const localSubmissions = safeJson(localStorage.getItem('pl_client_submissions'), []);
      const localBookingEntries = Object.keys(localStorage)
        .filter(key => key.startsWith('pl_bookings_'))
        .map(key => [bookingKeyToEmail(key), safeJson(localStorage.getItem(key), [])]);

      const [remoteAccounts, remoteSubmissions, remoteBookingCount] = await Promise.all([loadAccounts(), loadSubmissions(), loadBookings()]);
      remoteSubmissions.forEach(submission => savePublicJob(submission, submission.id));

      if (Object.keys(remoteAccounts).length === 0 && Object.keys(localAccounts).length > 0) {
        setLocal('pl_accounts', localAccounts);
        saveAccountsMap(localAccounts);
      }

      if (remoteSubmissions.length === 0 && localSubmissions.length > 0) {
        setLocal('pl_client_submissions', localSubmissions);
        saveSubmissions(localSubmissions);
      }

      if (remoteBookingCount === 0 && localBookingEntries.length > 0) {
        localBookingEntries.forEach(([email, bookings]) => {
          setLocal(`pl_bookings_${email}`, bookings);
          saveBookings(email, bookings);
        });
      }
    } catch (err) {
      console.warn('Firebase sync failed. Check Firestore rules and connection.', err);
    } finally {
      readyResolve();
    }
  }

  function startListeners() {
    db.collection('public_jobs').onSnapshot(loadPublicJobs, err => console.warn('Public job listener failed:', err));
    db.collection('accounts').onSnapshot(loadAccounts, err => console.warn('Account listener failed:', err));
    db.collection('client_submissions').onSnapshot(loadSubmissions, err => console.warn('Submission listener failed:', err));
    db.collection('bookings').onSnapshot(loadBookings, err => console.warn('Booking listener failed:', err));
  }

  function saveAccountsMap(accounts) {
    Object.entries(accounts || {}).forEach(([email, account]) => {
      const cleanEmail = normalizeEmail(email);
      db.collection('accounts').doc(cleanEmail).set(withMeta({
        ...account,
        email: cleanEmail,
        phoneDigits: normalizePhone(account.phone),
        role: account.role || 'client'
      }), { merge: true }).catch(err => console.warn('Could not save account:', err));
    });
  }

  function saveSubmissions(submissions) {
    (submissions || []).forEach((submission, index) => {
      const id = submission.id || `lead_${Date.now()}_${index}`;
      db.collection('client_submissions').doc(id).set(withMeta({
        ...submission,
        id
      }), { merge: true }).catch(err => console.warn('Could not save submission:', err));
      savePublicJob(submission, id);
    });
  }

  function getLeadStatus(lead) {
    if (lead.status === 'Approved' || lead.status === 'Quoteing') return 'Quoting';
    return ['Pending', 'Quoting', 'Booked', 'Payment', 'Completed'].includes(lead.status) ? lead.status : 'Pending';
  }

  function savePublicJob(submission, id) {
    const status = getLeadStatus(submission);
    const q = submission.quoting || {};
    const hasDates = (Array.isArray(q.jobDateValues) && q.jobDateValues.length > 0) || (Array.isArray(q.jobDates) && q.jobDates.length > 0);
    const ref = db.collection('public_jobs').doc(id);
    if (!['Booked', 'Payment'].includes(status) || !hasDates) {
      ref.delete().catch(() => {});
      return;
    }
    ref.set(withMeta({
      leadId: id,
      status,
      service: submission.service || 'Scheduled Work',
      description: q.job || 'Job details will be updated soon.',
      jobDateValues: Array.isArray(q.jobDateValues) ? q.jobDateValues : [],
      jobDates: Array.isArray(q.jobDates) ? q.jobDates : [],
      timeStart: q.timeStart || '',
      timeEnd: q.timeEnd || ''
    }), { merge: true }).catch(err => console.warn('Could not save public job:', err));
  }

  function saveBookings(email, bookings) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return;
    db.collection('bookings').doc(cleanEmail).set(withMeta({
      email: cleanEmail,
      items: Array.isArray(bookings) ? bookings : []
    }), { merge: true }).catch(err => console.warn('Could not save bookings:', err));
  }

  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (applyingRemote) return;
    if (key === 'pl_accounts') saveAccountsMap(safeJson(value, {}));
    if (key === 'pl_client_submissions') saveSubmissions(safeJson(value, []));
    if (key.startsWith('pl_bookings_')) saveBookings(bookingKeyToEmail(key), safeJson(value, []));
  };

  localStorage.removeItem = function (key) {
    originalRemoveItem(key);
    if (applyingRemote) return;
    if (key.startsWith('pl_bookings_')) {
      db.collection('bookings').doc(bookingKeyToEmail(key)).delete().catch(err => console.warn('Could not delete bookings:', err));
    }
  };

  auth.onAuthStateChanged(async user => {
    if (user?.email) {
      originalSetItem('pl_current_user', normalizeEmail(user.email));
      await syncNow();
    } else {
      originalRemoveItem('pl_current_user');
      readyResolve();
    }
  });

  startListeners();
  syncNow();

  window.PrestigeFirebase = {
    app,
    auth,
    db,
    ready,
    normalizeEmail,
    normalizePhone,
    syncNow,
    async signUp(email, password, account) {
      const cleanEmail = normalizeEmail(email);
      const credential = await auth.createUserWithEmailAndPassword(cleanEmail, password);
      await loadAccounts();
      const role = account.role || 'client';
      await db.collection('accounts').doc(cleanEmail).set({
        ...account,
        email: cleanEmail,
        role,
        phoneDigits: normalizePhone(account.phone),
        createdAt: new Date().toISOString()
      }, { merge: true });
      originalSetItem('pl_current_user', cleanEmail);
      await syncNow();
      return { user: credential.user, account: { ...account, role } };
    },
    async signIn(email, password) {
      const cleanEmail = normalizeEmail(email);
      const credential = await auth.signInWithEmailAndPassword(cleanEmail, password);
      originalSetItem('pl_current_user', cleanEmail);
      await syncNow();
      return credential.user;
    },
    async signOut() {
      await auth.signOut();
      originalRemoveItem('pl_current_user');
    },
    async getAccount(email) {
      const doc = await db.collection('accounts').doc(normalizeEmail(email)).get();
      return doc.exists ? doc.data() : null;
    },
    async findAccountByPhone(phone) {
      const phoneDigits = normalizePhone(phone);
      if (!phoneDigits) return null;
      const snapshot = await db.collection('accounts').where('phoneDigits', '==', phoneDigits).limit(1).get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { email: doc.id, ...(doc.data() || {}) };
    },
    async deleteSubmission(id) {
      if (!id) return;
      await db.collection('client_submissions').doc(id).delete();
      await db.collection('public_jobs').doc(id).delete().catch(() => {});
      await syncNow();
    },
    async deleteAccount(email) {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail) return;
      await db.collection('accounts').doc(cleanEmail).delete();
      await db.collection('bookings').doc(cleanEmail).delete().catch(() => {});
      await syncNow();
    }
  };
})();
