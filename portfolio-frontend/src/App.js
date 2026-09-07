import React, { useState, useEffect } from 'react';
import { getPortfolio, addStock, deleteStock, loginUser, signupUser, logoutUser } from './services/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isSignup, setIsSignup] = useState(false);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Portfolio Dashboard State
  const [portfolio, setPortfolio] = useState([]);
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sell Modal State
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [sellQuantity, setSellQuantity] = useState('');
  const [sellPrice, setSellPrice] = useState('');

  // Fetch portfolio data
  const fetchPortfolioData = async () => {
    if (!token) return;
    try {
      const data = await getPortfolio();
      setPortfolio(data);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchPortfolioData();
      const interval = setInterval(fetchPortfolioData, 1000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Handle Login / Signup Submit
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isSignup) {
        await signupUser(email, password);
        alert("Account created successfully! Please login.");
        setIsSignup(false);
        setPassword('');
      } else {
        await loginUser(email, password);
        setToken(localStorage.getItem("token"));
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Authentication failed. Check credentials.";
      setAuthError(errorMsg);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setToken(null);
    setPortfolio([]);
  };

  // Handle Add Stock
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!symbol || !quantity || !buyPrice) return;
    setErrorMessage('');

    try {
      setLoading(true);
      await addStock({
        symbol: symbol.toUpperCase(),
        quantity: parseFloat(quantity),
        buy_price: parseFloat(buyPrice),
      });
      setSymbol('');
      setQuantity('');
      setBuyPrice('');
      fetchPortfolioData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Failed to add stock.";
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Stock
  const handleDelete = async (id) => {
    try {
      await deleteStock(id);
      fetchPortfolioData();
    } catch (error) {
      console.error("Error deleting stock:", error);
    }
  };

  // Open Sell Modal
  const openSellModal = (stock) => {
    setSelectedStock(stock);
    setSellQuantity('');
    setSellPrice(stock.current_price || '');
    setIsSellModalOpen(true);
  };

  // Handle Sell Submit
  const handleSellSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStock || !sellQuantity || !sellPrice) return;

    if (parseFloat(sellQuantity) > selectedStock.quantity) {
      alert("Cannot sell more than your current holdings quantity!");
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/portfolio/sell", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          symbol: selectedStock.symbol,
          quantity: parseFloat(sellQuantity),
          sell_price: parseFloat(sellPrice)
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to sell stock");
      }

      setIsSellModalOpen(false);
      fetchPortfolioData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Calculations for Summary Cards
  const totalInvestment = portfolio.reduce((acc, item) => acc + item.total_investment, 0);
  const totalCurrentValue = portfolio.reduce((acc, item) => acc + item.current_value, 0);
  const totalProfitLoss = totalCurrentValue - totalInvestment;
  const totalProfitLossPercentage = totalInvestment > 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;
  
  const totalTodayProfitLoss = portfolio.reduce((acc, item) => acc + (item.today_profit_loss || 0), 0);
  const totalPreviousValue = portfolio.reduce((acc, item) => acc + (item.current_value - (item.today_profit_loss || 0)), 0);
  const totalTodayProfitLossPercentage = totalPreviousValue > 0 ? (totalTodayProfitLoss / totalPreviousValue) * 100 : 0;

  // 1. IF NOT LOGGED IN -> SHOW AUTH SCREEN
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
        <div className="bg-gray-800 p-8 rounded-xl shadow-xl border border-gray-700 w-full max-w-md">
          <h2 className="text-2xl font-bold text-indigo-400 mb-2 text-center">
            {isSignup ? "Create an Account" : "Welcome Back"}
          </h2>
          <p className="text-gray-400 text-sm mb-6 text-center">AI Stock Portfolio Tracker By RJ</p>

          {authError && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded mb-4 text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded py-2 transition"
            >
              {isSignup ? "Sign Up" : "Login"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setIsSignup(!isSignup); setAuthError(''); }}
              className="text-indigo-400 text-sm hover:underline"
            >
              {isSignup ? "Already have an account? Login" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. IF LOGGED IN -> SHOW DASHBOARD
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-indigo-400">AI Stock Portfolio Tracker By RJ</h1>
            <p className="text-gray-400">Manage your investments securely</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm font-semibold transition"
          >
            Logout
          </button>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
            <h3 className="text-gray-400 text-sm font-medium">Total Investment</h3>
            <p className="text-2xl font-bold mt-2">₹ {totalInvestment.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
            <h3 className="text-gray-400 text-sm font-medium">Current Value</h3>
            <p className="text-2xl font-bold mt-2">₹ {totalCurrentValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
            <h3 className="text-gray-400 text-sm font-medium">Total Profit / Loss</h3>
            <p className={`text-2xl font-bold mt-2 ${totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ₹ {totalProfitLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ({totalProfitLossPercentage.toFixed(2)}%)
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
            <h3 className="text-gray-400 text-sm font-medium">Today's Profit / Loss</h3>
            <p className={`text-2xl font-bold mt-2 ${totalTodayProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ₹ {totalTodayProfitLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ({totalTodayProfitLossPercentage.toFixed(2)}%)
            </p>
          </div>
        </div>

        {/* Add Stock Form */}
        <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-indigo-300">Add Stock to Portfolio</h2>

          {errorMessage && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4 flex justify-between items-center">
              <span className="text-sm font-medium">⚠️ {errorMessage}</span>
              <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-white font-bold text-lg px-2">&times;</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Symbol (e.g. RELIANCE.NS)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              required
            />
            <input
              type="number"
              placeholder="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              required
            />
            <input
              type="number"
              step="any"
              placeholder="Buy Price"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded px-4 py-2 transition"
            >
              {loading ? 'Validating...' : 'Add Stock'}
            </button>
          </form>
        </div>

        {/* Holdings Table */}
        <div className="bg-gray-800 rounded-xl shadow border border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-indigo-300">Your Holdings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-700 text-gray-300 text-sm uppercase">
                  <th className="p-4">Symbol</th>
                  <th className="p-4">Qty</th>
                  <th className="p-4">Buy Price</th>
                  <th className="p-4">Current Price</th>
                  <th className="p-4">Current Value</th>
                  <th className="p-4">P&L</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {portfolio.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-gray-400">No stocks found in portfolio. Add one above!</td>
                  </tr>
                ) : (
                  portfolio.map((stock) => (
                    <tr key={stock.id} className="hover:bg-gray-750">
                      <td className="p-4 font-bold">{stock.symbol.replace('.NS', '').replace('.BO', '')}</td>
                      <td className="p-4">{stock.quantity}</td>
                      <td className="p-4">₹{stock.buy_price}</td>
                      <td className="p-4">₹{stock.current_price}</td>
                      <td className="p-4">₹{stock.current_value}</td>
                      <td className={`p-4 font-semibold ${stock.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ₹{stock.profit_loss} ({stock.profit_loss_percentage}%)
                      </td>
                      <td className="p-4 flex space-x-2">
                        <button
                          onClick={() => openSellModal(stock)}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-semibold transition"
                        >
                          Sell
                        </button>
                        <button
                          onClick={() => handleDelete(stock.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-semibold transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sell Modal Popup */}
      {isSellModalOpen && selectedStock && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96 shadow-2xl">
            <h3 className="text-xl font-bold text-orange-400 mb-4">Sell Stock: {selectedStock.symbol}</h3>
            <p className="text-gray-300 text-sm mb-1">Available Qty: <span className="font-semibold text-white">{selectedStock.quantity}</span></p>
            <p className="text-gray-300 text-sm mb-4">Market Price: <span className="font-semibold text-white">₹{selectedStock.current_price}</span></p>
            
            <form onSubmit={handleSellSubmit}>
              <div className="mb-3">
                <label className="block text-gray-400 text-xs mb-1">Quantity to Sell</label>
                <input
                  type="number"
                  step="any"
                  max={selectedStock.quantity}
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(e.target.value)}
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-400 text-xs mb-1">Sell Price (per share)</label>
                <input
                  type="number"
                  step="any"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsSellModalOpen(false)}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded text-sm text-white font-semibold transition"
                >
                  Confirm Sell
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;