import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo">QR</div>
        <span className="navbar-title">ניהול מדבקות</span>
      </div>

      <div className="navbar-links">
        <Link to="/" className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}>
          מוצרים
        </Link>
        <Link to="/settings" className={`navbar-link ${location.pathname === '/settings' ? 'active' : ''}`}>
          הגדרות
        </Link>
      </div>

      <div className="navbar-user">
        <span className="navbar-email">{user?.email}</span>
        <button className="btn-logout" onClick={() => signOut(auth)}>יציאה</button>
      </div>
    </nav>
  );
}
