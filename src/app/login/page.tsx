"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { Password } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import './login.css';

type TabType = 'login' | 'signup';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, loading } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [isLoading, setIsLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Signup form state
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Redirect after login
  const redirectUrl = searchParams.get('redirect') || '/account';

  // If user is already logged in, redirect
  useEffect(() => {
    if (user && !loading) {
      router.push(redirectUrl);
    }
  }, [user, loading, router, redirectUrl]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateLoginForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!loginEmail) {
      newErrors.loginEmail = 'L\'email est requis';
    } else if (!validateEmail(loginEmail)) {
      newErrors.loginEmail = 'Email invalide';
    }

    if (!loginPassword) {
      newErrors.loginPassword = 'Le mot de passe est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignupForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!signupDisplayName.trim()) {
      newErrors.signupDisplayName = 'Le nom d\'affichage est requis';
    }

    if (!signupEmail) {
      newErrors.signupEmail = 'L\'email est requis';
    } else if (!validateEmail(signupEmail)) {
      newErrors.signupEmail = 'Email invalide';
    }

    if (!signupPassword) {
      newErrors.signupPassword = 'Le mot de passe est requis';
    } else if (signupPassword.length < 6) {
      newErrors.signupPassword = 'Le mot de passe doit contenir au moins 6 caractères';
    }

    if (!signupConfirmPassword) {
      newErrors.signupConfirmPassword = 'Veuillez confirmer le mot de passe';
    } else if (signupPassword !== signupConfirmPassword) {
      newErrors.signupConfirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (!acceptTerms) {
      newErrors.acceptTerms = 'Vous devez accepter les conditions d\'utilisation';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
      showToast({
        severity: 'success',
        summary: 'Connexion réussie',
        detail: 'Bienvenue !',
        life: 3000
      });
    } catch (error: any) {
      console.error('Google sign in error:', error);
      showToast({
        severity: 'error',
        summary: 'Erreur de connexion',
        detail: error.message || 'Une erreur est survenue',
        life: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateLoginForm()) return;

    try {
      setIsLoading(true);
      await signInWithEmail(loginEmail, loginPassword);
      showToast({
        severity: 'success',
        summary: 'Connexion réussie',
        detail: 'Bienvenue !',
        life: 3000
      });
    } catch (error: any) {
      console.error('Email login error:', error);
      let errorMessage = 'Une erreur est survenue';

      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Aucun compte avec cet email';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Mot de passe incorrect';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email invalide';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Trop de tentatives. Réessayez plus tard';
      }

      showToast({
        severity: 'error',
        summary: 'Erreur de connexion',
        detail: errorMessage,
        life: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateSignupForm()) return;

    try {
      setIsLoading(true);
      await signUpWithEmail(signupEmail, signupPassword, signupDisplayName);
      showToast({
        severity: 'success',
        summary: 'Compte créé',
        detail: 'Un email de vérification a été envoyé. Redirection...',
        life: 3000
      });
      // Redirect to verify email page after 2 seconds
      setTimeout(() => {
        router.push('/verify-email');
      }, 2000);
    } catch (error: any) {
      console.error('Email signup error:', error);
      let errorMessage = 'Une erreur est survenue';

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Cet email est déjà utilisé';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email invalide';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Mot de passe trop faible';
      }

      showToast({
        severity: 'error',
        summary: 'Erreur d\'inscription',
        detail: errorMessage,
        life: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/reset-password/request');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <h1 className="login-title">Cuisine Artisanale</h1>

          {/* Tabs */}
          <div className="login-tabs">
            <button
              className={`tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Connexion
            </button>
            <button
              className={`tab ${activeTab === 'signup' ? 'active' : ''}`}
              onClick={() => setActiveTab('signup')}
            >
              Inscription
            </button>
          </div>

          {/* Google Button */}
          <button
            className="google-button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="pi pi-spin pi-spinner"></i>
                <span>Chargement...</span>
              </>
            ) : (
              <>
                <i className="pi pi-google"></i>
                <span>{activeTab === 'login' ? 'Continuer avec Google' : 'S\'inscrire avec Google'}</span>
              </>
            )}
          </button>

          <div className="divider">
            <span className="divider-text">OU</span>
          </div>

          {/* Login Tab Content */}
          {activeTab === 'login' && (
            <form onSubmit={handleEmailLogin} className="auth-form">
              <div className="form-field">
                <label htmlFor="loginEmail">
                  <i className="pi pi-envelope" /> Adresse email
                </label>
                <input
                  id="loginEmail"
                  type="email"
                  placeholder="exemple@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={errors.loginEmail ? 'input-invalid' : ''}
                  autoComplete="email"
                />
                {errors.loginEmail && (
                  <small className="error-message">{errors.loginEmail}</small>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="loginPassword">
                  <i className="pi pi-lock" /> Mot de passe
                </label>
                <Password
                  id="loginPassword"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className={errors.loginPassword ? 'input-invalid' : ''}
                  toggleMask
                  autoComplete="current-password"
                />
                {errors.loginPassword && (
                  <small className="error-message">{errors.loginPassword}</small>
                )}
              </div>

              <div className="form-checkbox">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="rememberMe">Se souvenir de moi</label>
              </div>

              <button
                type="submit"
                className="submit-button"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <i className="pi pi-spin pi-spinner"></i>
                    <span>Connexion...</span>
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>

              <div className="form-footer">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleForgotPassword();
                  }}
                  className="forgot-password"
                >
                  Mot de passe oublié ?
                </a>
              </div>
            </form>
          )}

          {/* Signup Tab Content */}
          {activeTab === 'signup' && (
            <form onSubmit={handleEmailSignup} className="auth-form">
              <div className="form-field">
                <label htmlFor="signupDisplayName">
                  <i className="pi pi-user" /> Nom d'affichage
                </label>
                <input
                  id="signupDisplayName"
                  type="text"
                  placeholder="Chef Cuisinier"
                  value={signupDisplayName}
                  onChange={(e) => setSignupDisplayName(e.target.value)}
                  className={errors.signupDisplayName ? 'input-invalid' : ''}
                  autoComplete="name"
                />
                {errors.signupDisplayName && (
                  <small className="error-message">{errors.signupDisplayName}</small>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="signupEmail">
                  <i className="pi pi-envelope" /> Adresse email
                </label>
                <input
                  id="signupEmail"
                  type="email"
                  placeholder="exemple@email.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className={errors.signupEmail ? 'input-invalid' : ''}
                  autoComplete="email"
                />
                {errors.signupEmail && (
                  <small className="error-message">{errors.signupEmail}</small>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="signupPassword">
                  <i className="pi pi-lock" /> Mot de passe (min. 6 caractères)
                </label>
                <Password
                  id="signupPassword"
                  placeholder="••••••••"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className={errors.signupPassword ? 'input-invalid' : ''}
                  toggleMask
                  autoComplete="new-password"
                />
                {errors.signupPassword && (
                  <small className="error-message">{errors.signupPassword}</small>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="signupConfirmPassword">
                  <i className="pi pi-lock" /> Confirmer le mot de passe
                </label>
                <Password
                  id="signupConfirmPassword"
                  placeholder="••••••••"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  className={errors.signupConfirmPassword ? 'input-invalid' : ''}
                  toggleMask
                  autoComplete="new-password"
                />
                {errors.signupConfirmPassword && (
                  <small className="error-message">{errors.signupConfirmPassword}</small>
                )}
              </div>

              <div className="form-checkbox">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className={errors.acceptTerms ? 'checkbox-invalid' : ''}
                />
                <label htmlFor="acceptTerms">
                  J'accepte les{' '}
                  <a href="/politique-confidentialite" target="_blank">
                    conditions d'utilisation
                  </a>
                </label>
              </div>
              {errors.acceptTerms && (
                <small className="error-message">{errors.acceptTerms}</small>
              )}

              <button
                type="submit"
                className="submit-button"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <i className="pi pi-spin pi-spinner"></i>
                    <span>Création...</span>
                  </>
                ) : (
                  'Créer mon compte'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <LoginContent />
    </Suspense>
  );
}
