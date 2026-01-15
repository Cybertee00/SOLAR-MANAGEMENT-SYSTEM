import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import './Login.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (isAuthenticated()) {
      navigate('/');
    }
    
    // Load remembered username from localStorage
    const rememberedUsername = localStorage.getItem('remembered_username');
    if (rememberedUsername) {
      setUsername(rememberedUsername);
      setRememberMe(true);
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalizedUsername = (username || '').trim();

    if (!normalizedUsername || !password) {
      setError('Please enter both username and password');
      setLoading(false);
      return;
    }

    try {
      console.log('Submitting login form...');
      const result = await login(normalizedUsername, password, rememberMe);
      console.log('Login result:', result);

      if (result.success) {
        // Save username if remember me is checked
        if (rememberMe) {
          localStorage.setItem('remembered_username', normalizedUsername);
        } else {
          localStorage.removeItem('remembered_username');
        }
        navigate('/');
      } else {
        // Handle special error messages (e.g., ACCESS RESTRICTED)
        if (result.error === 'ACCESS RESTRICTED' && result.admin_email) {
          setError(`ACCESS RESTRICTED\n\nYour account access has been restricted. Please contact the administrator at ${result.admin_email} for assistance.`);
        } else {
          setError(result.error || 'Login failed. Please check your credentials.');
        }
      }
    } catch (err) {
      console.error('Login error caught:', err);
      if (err.code === 'ECONNABORTED') {
        setError('Connection timeout. Please check if the server is running and accessible.');
      } else if (err.message && err.message.includes('timeout')) {
        setError('Request timed out. The server may not be responding. Please check: 1) Server is running, 2) Correct API URL, 3) Network connection.');
      } else {
        setError(err.message || 'Network error. Please check your connection and server status.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // For now, show a message. This can be expanded to a forgot password flow later
    alert('Please contact your administrator to reset your password.');
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="login-logo">
            <img src={logo} alt="SPHAirPlatform Logo" />
          </div>
          <h1>SPHAiRPlatform</h1>
          <p>Sign in to your account</p>
        </div>

        {error && (
          <div className={`alert ${error.includes('ACCESS RESTRICTED') ? 'alert-restricted' : 'alert-error'}`}>
            {error.split('\n').map((line, idx) => (
              <React.Fragment key={idx}>
                {line}
                {idx < error.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username or Email</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username or email"
              autoComplete="username"
              disabled={loading}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </div>

          <div className="login-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              className="forgot-password-link"
              onClick={handleForgotPassword}
              disabled={loading}
            >
              Forgot password?
            </button>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="text-muted">
            Need help? Contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
