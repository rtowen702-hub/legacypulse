'use client';

import { useState, useEffect } from 'react';
import { encryptVaultItem, decryptVaultItem } from '@/lib/crypto';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [activeTab, setActiveTab] = useState<'vault' | 'trustees'>('vault');

  // Vault states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Financial');
  const [secretMessage, setSecretMessage] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [encryptedOutput, setEncryptedOutput] = useState('');
  const [decryptedOutput, setDecryptedOutput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [selectedBlob, setSelectedBlob] = useState('');

  // Pulse & Trustee states
  const [pulseSettings, setPulseSettings] = useState<any>(null);
  const [trustees, setTrustees] = useState<any[]>([]);
  const [trusteeName, setTrusteeName] = useState('');
  const [trusteeEmail, setTrusteeEmail] = useState('');
  const [trusteeRelation, setTrusteeRelation] = useState('');

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchVaultItems();
        fetchPulseSettings(session.user.id);
        fetchTrustees();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchVaultItems();
        fetchPulseSettings(session.user.id);
        fetchTrustees();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async () => {
    if (!email || !password) return alert('Please enter email and password!');
    const { error } = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) alert(error.message);
    else setShowAuthModal(false);
  };

  const handleLogout = () => {
    supabase.auth.signOut();
    setSavedItems([]);
    setPulseSettings(null);
    setTrustees([]);
  };

  const fetchPulseSettings = async (userId: string) => {
    const { data, error } = await supabase.from('user_pulse_settings').select('*').eq('user_id', userId).single();
    if (error && error.code === 'PGRST116') {
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + 30);
      const { data: newSettings } = await supabase
        .from('user_pulse_settings')
        .insert([{ user_id: userId, checkin_frequency_days: 30, grace_period_days: 14, status: 'ACTIVE', next_checkin_due: nextDue.toISOString() }])
        .select().single();
      setPulseSettings(newSettings);
    } else {
      setPulseSettings(data);
    }
  };

  const handlePulseCheckIn = async () => {
    if (!user || !pulseSettings) return;
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + pulseSettings.checkin_frequency_days);

    const { data, error } = await supabase
      .from('user_pulse_settings')
      .update({ last_checkin_at: new Date().toISOString(), next_checkin_due: nextDue.toISOString(), status: 'ACTIVE' })
      .eq('user_id', user.id).select().single();

    if (!error) {
      alert('Check-in confirmed! Timer extended 30 days.');
      setPulseSettings(data);
    }
  };

  const fetchTrustees = async () => {
    const { data } = await supabase.from('trustees').select('*');
    setTrustees(data || []);
  };

  const handleAddTrustee = async () => {
    if (!user || !trusteeName || !trusteeEmail) return;
    const { error } = await supabase.from('trustees').insert([{ user_id: user.id, full_name: trusteeName, email: trusteeEmail, relationship: trusteeRelation || 'Family' }]);
    if (!error) {
      setTrusteeName(''); setTrusteeEmail(''); setTrusteeRelation('');
      fetchTrustees();
    }
  };

  const handleDeleteTrustee = async (id: string) => {
    await supabase.from('trustees').delete().eq('id', id);
    fetchTrustees();
  };

  const handleEncrypt = async () => {
    if (!secretMessage || !passphrase) return alert('Enter secret note & passphrase!');
    const locked = await encryptVaultItem(secretMessage, passphrase);
    setEncryptedOutput(locked);
    setDecryptedOutput('');
  };

  const handleSaveToSupabase = async () => {
    if (!user || !encryptedOutput || !title) return;
    setIsSaving(true);
    const { error } = await supabase.from('vault_items').insert([{ user_id: user.id, title, category, encrypted_data: encryptedOutput }]);
    setIsSaving(false);
    if (!error) {
      setTitle(''); setSecretMessage(''); setEncryptedOutput('');
      fetchVaultItems();
    }
  };

  const fetchVaultItems = async () => {
    const { data } = await supabase.from('vault_items').select('*');
    setSavedItems(data || []);
  };

  const handleDecryptSaved = async () => {
    if (!selectedBlob || !passphrase) return alert('Select an item and enter your master passphrase!');
    try {
      const unlocked = await decryptVaultItem(selectedBlob, passphrase);
      setDecryptedOutput(unlocked);
    } catch {
      alert('Invalid passphrase. Access denied.');
    }
  };

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* NAVBAR */}
      <nav className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              🛡️
            </div>
            <span className="font-bold text-lg tracking-tight text-white">LegacyPulse</span>
          </div>

          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded-lg border border-slate-800 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => openAuth('login')}
                className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 transition"
              >
                Log In
              </button>
              <button
                onClick={() => openAuth('signup')}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg transition shadow-sm"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* AUTH MODAL */}
      {showAuthModal && !user && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-sm w-full space-y-5 relative shadow-2xl">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-sm"
            >
              ✕
            </button>
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-white">
                {authMode === 'signup' ? 'Create Your Vault' : 'Welcome Back'}
              </h3>
              <p className="text-xs text-slate-400">Zero-knowledge encrypted security.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                onClick={handleAuth}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg text-sm transition mt-2 shadow-sm"
              >
                {authMode === 'signup' ? 'Start Free Trial' : 'Sign In'}
              </button>
            </div>

            <p className="text-center text-xs text-slate-500">
              {authMode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
              <button
                onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                className="text-emerald-400 hover:underline font-medium"
              >
                {authMode === 'signup' ? 'Log In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* CONTENT SWITCHER: LANDING PAGE VS DASHBOARD */}
      {!user ? (
        /* ================= PUBLIC LANDING PAGE ================= */
        <div className="space-y-24 py-16">
          {/* HERO SECTION */}
          <section className="max-w-4xl mx-auto text-center px-6 space-y-8">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-400">
              <span>🔒 Zero-Knowledge Digital Estate Protocol</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Protect your digital life for <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">life’s "just in case"</span> moments.
            </h1>

            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Store mortgage codes, utility roadmaps, pet care guidelines, and private messages. Automatically handed off to family only if something happens to you.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <button
                onClick={() => openAuth('signup')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition shadow-lg shadow-emerald-600/20"
              >
                Create Free Emergency Vault
              </button>
              <a
                href="#pricing"
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold px-8 py-3.5 rounded-xl text-base border border-slate-800 transition"
              >
                View Pricing
              </a>
            </div>
          </section>

          {/* FEATURE GRID */}
          <section className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg">
                  🔑
                </div>
                <h3 className="font-bold text-white text-lg">Zero-Knowledge AES-256</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your data is encrypted locally on your phone or computer before reaching our servers. We can never read your notes.
                </p>
              </div>

              <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg">
                  💚
                </div>
                <h3 className="font-bold text-white text-lg">Automated Pulse Engine</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Non-intrusive periodic check-ins. If you miss a pulse, a 14-day grace period begins before designated contacts are reached.
                </p>
              </div>

              <div className="bg-slate-900/50 border border-slate-800/80 p-8 rounded-2xl space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg">
                  👥
                </div>
                <h3 className="font-bold text-white text-lg">Trustee Handover</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Nominate trusted family members or advisors who will receive decryption access only when an emergency is confirmed.
                </p>
              </div>
            </div>
          </section>

          {/* PRICING SECTION */}
          <section id="pricing" className="max-w-4xl mx-auto px-6 space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-white">Simple, Transparent Pricing</h2>
              <p className="text-slate-400 text-sm">No lock-in contracts. Complete control of your digital legacy.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              {/* FREE TIER */}
              <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-2xl flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-200 text-xl">Free Starter</h3>
                  <div className="text-3xl font-extrabold text-white">$0 <span className="text-xs font-normal text-slate-400">/ forever</span></div>
                  <p className="text-slate-400 text-xs leading-relaxed">Essential protection for critical emergency instructions.</p>
                  
                  <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                    <li className="flex items-center gap-2">✓ Up to 3 Encrypted Vault Items</li>
                    <li className="flex items-center gap-2">✓ 1 Designated Emergency Trustee</li>
                    <li className="flex items-center gap-2">✓ Standard 30-day Pulse Checks</li>
                  </ul>
                </div>

                <button
                  onClick={() => openAuth('signup')}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl text-xs border border-slate-700 transition"
                >
                  Create Free Account
                </button>
              </div>

              {/* PRO TIER */}
              <div className="bg-slate-900 border-2 border-emerald-500/50 p-8 rounded-2xl flex flex-col justify-between space-y-6 relative shadow-xl shadow-emerald-950/20">
                <div className="absolute -top-3.5 right-6 bg-emerald-500 text-slate-950 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-white text-xl">Legacy Pro</h3>
                  <div className="text-3xl font-extrabold text-white">$39 <span className="text-xs font-normal text-slate-400">/ year</span></div>
                  <p className="text-slate-400 text-xs leading-relaxed">Complete digital estate delegation for families and homeowners.</p>
                  
                  <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                    <li className="flex items-center gap-2">✓ <strong className="text-white">Unlimited</strong> Encrypted Vault Items</li>
                    <li className="flex items-center gap-2">✓ <strong className="text-white">Up to 5</strong> Emergency Trustees</li>
                    <li className="flex items-center gap-2">✓ Custom Check-in Durations (30/60/90 days)</li>
                    <li className="flex items-center gap-2">✓ SMS & Push Notification Reminders</li>
                  </ul>
                </div>

                <button
                  onClick={() => openAuth('signup')}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl text-xs transition shadow-md"
                >
                  Start Pro Membership
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* ================= LOGGED IN DASHBOARD SHELL ================= */
        <main className="max-w-6xl mx-auto py-8 space-y-8">
          {/* PULSE ALERT BANNER */}
          {pulseSettings && (
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold">
                  💚
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">Emergency Pulse Active</h3>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-emerald-500/30">
                      {pulseSettings.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Next check-in due on <span className="text-slate-200 font-medium">{new Date(pulseSettings.next_checkin_due).toLocaleDateString()}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={handlePulseCheckIn}
                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2"
              >
                <span>I'm Safe (Confirm Pulse)</span>
              </button>
            </div>
          )}

          {/* DASHBOARD TABS */}
          <div className="border-b border-slate-800 flex gap-8 text-sm font-medium">
            <button
              onClick={() => setActiveTab('vault')}
              className={`pb-3 transition relative ${activeTab === 'vault' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Encrypted Vault ({savedItems.length})
              {activeTab === 'vault' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />}
            </button>

            <button
              onClick={() => setActiveTab('trustees')}
              className={`pb-3 transition relative ${activeTab === 'trustees' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Trusted Contacts ({trustees.length})
              {activeTab === 'trustees' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />}
            </button>
          </div>

          {/* TAB 1: ENCRYPTED VAULT */}
          {activeTab === 'vault' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* LEFT: Add Vault Item */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-white">Add Encrypted Vault Item</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Title / Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Master Safe Combination"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none"
                    >
                      <option value="Financial">Financial & Bank Accounts</option>
                      <option value="Home">Home & Utilities Access</option>
                      <option value="Personal">Personal Directives / Notes</option>
                      <option value="Digital">Digital & Passwords</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Secret Note (Client Encrypted)</label>
                    <textarea
                      placeholder="Enter sensitive instructions..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      value={secretMessage}
                      onChange={(e) => setSecretMessage(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Master Passphrase</label>
                    <input
                      type="password"
                      placeholder="Passphrase used to encrypt..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleEncrypt}
                      className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 rounded-lg border border-slate-700"
                    >
                      1. Encrypt Blob
                    </button>
                    <button
                      onClick={handleSaveToSupabase}
                      disabled={!encryptedOutput || isSaving}
                      className="w-1/2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold py-2.5 rounded-lg transition"
                    >
                      {isSaving ? 'Saving...' : '2. Save Payload'}
                    </button>
                  </div>
                </div>

                {encryptedOutput && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Encrypted Payload Output</span>
                    <p className="font-mono text-[11px] text-slate-400 break-all truncate">{encryptedOutput}</p>
                  </div>
                )}
              </div>

              {/* RIGHT: Saved Vault Items & Decryptor */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-semibold text-white">Your Encrypted Vault Items</h3>

                  {savedItems.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4">No items saved yet. Use the form on the left to encrypt your first entry.</p>
                  ) : (
                    <div className="space-y-2">
                      {savedItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedBlob(item.encrypted_data)}
                          className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                            selectedBlob === item.encrypted_data
                              ? 'bg-slate-800/80 border-emerald-500/50 shadow-sm'
                              : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-slate-100">{item.title}</span>
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                                {item.category}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 block truncate max-w-xs mt-1">
                              {item.encrypted_data}
                            </span>
                          </div>

                          <span className="text-xs text-slate-500">AES-256</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedBlob && (
                    <div className="pt-4 border-t border-slate-800 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="Enter passphrase to decrypt..."
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                        />
                        <button
                          onClick={handleDecryptSaved}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                        >
                          Decrypt Selected
                        </button>
                      </div>

                      {decryptedOutput && (
                        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Decrypted Note</span>
                          <p className="text-sm text-emerald-100 font-medium">{decryptedOutput}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRUSTED CONTACTS */}
          {activeTab === 'trustees' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 max-w-2xl">
              <div>
                <h3 className="text-base font-semibold text-white">Emergency Trustees</h3>
                <p className="text-xs text-slate-400 mt-0.5">Contacts who will be alerted to verify your status if you miss a check-in.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Full Name"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  value={trusteeName}
                  onChange={(e) => setTrusteeName(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  value={trusteeEmail}
                  onChange={(e) => setTrusteeEmail(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Relationship"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  value={trusteeRelation}
                  onChange={(e) => setTrusteeRelation(e.target.value)}
                />
              </div>

              <button
                onClick={handleAddTrustee}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 rounded-lg text-xs border border-slate-700 transition"
              >
                + Add Emergency Contact
              </button>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                {trustees.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                    <div>
                      <div className="font-medium text-sm text-slate-100">{t.full_name} <span className="text-xs text-slate-500 font-normal">({t.relationship})</span></div>
                      <div className="text-xs text-slate-400">{t.email}</div>
                    </div>
                    <button onClick={() => handleDeleteTrustee(t.id)} className="text-xs text-rose-400 hover:underline font-medium">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}