"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Divider } from 'primereact/divider';
import { Toast } from 'primereact/toast';
import './LoginPage.css';

type TabType = 'login' | 'signup';

const LoginPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, loading } = useAuth();
  const toastRef = React.useRef<Toast>(null);

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
      toastRef.current?.show({
        severity: 'success',
        summary: 'Connexion réussie',
        detail: 'Bienvenue !',
        life: 3000
      });
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toastRef.current?.show({
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
      toastRef.current?.show({
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

      toastRef.current?.show({
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
      toastRef.current?.show({
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

      toastRef.current?.show({
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
    router.push('/reset-password');
  };

  return (
    <div className="login-page">
      <Toast ref={toastRef} />
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
          <Button
            label={activeTab === 'login' ? 'Continuer avec Google' : 'S\'inscrire avec Google'}
            icon="pi pi-google"
            className="google-button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            loading={isLoading}
          />

          <Divider align="center">
            <span className="divider-text">OU</span>
          </Divider>

          {/* Login Tab Content */}
          {activeTab === 'login' && (
            <form onSubmit={handleEmailLogin} className="auth-form">
              <div className="form-field">
                <label htmlFor="loginEmail">
                  <i className="pi pi-envelope" /> Adresse email
                </label>
                <InputText
                  id="loginEmail"
                  type="email"
                  placeholder="exemple@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={errors.loginEmail ? 'p-invalid' : ''}
                  autoComplete="email"
                />
                {errors.loginEmail && (
                  <small className="p-error">{errors.loginEmail}</small>
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
                  className={errors.loginPassword ? 'p-invalid' : ''}
                  feedback={false}
                  toggleMask
                  autoComplete="current-password"
                />
                {errors.loginPassword && (
                  <small className="p-error">{errors.loginPassword}</small>
                )}
              </div>

              <div className="form-checkbox">
                <Checkbox
                  inputId="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.checked || false)}
                />
                <label htmlFor="rememberMe">Se souvenir de moi</label>
              </div>

              <Button
                type="submit"
                label="Se connecter"
                className="submit-button"
                disabled={isLoading}
                loading={isLoading}
              />

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
                <InputText
                  id="signupDisplayName"
                  placeholder="Chef Cuisinier"
                  value={signupDisplayName}
                  onChange={(e) => setSignupDisplayName(e.target.value)}
                  className={errors.signupDisplayName ? 'p-invalid' : ''}
                  autoComplete="name"
                />
                {errors.signupDisplayName && (
                  <small className="p-error">{errors.signupDisplayName}</small>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="signupEmail">
                  <i className="pi pi-envelope" /> Adresse email
                </label>
                <InputText
                  id="signupEmail"
                  type="email"
                  placeholder="exemple@email.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className={errors.signupEmail ? 'p-invalid' : ''}
                  autoComplete="email"
                />
                {errors.signupEmail && (
                  <small className="p-error">{errors.signupEmail}</small>
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
                  className={errors.signupPassword ? 'p-invalid' : ''}
                  toggleMask
                  autoComplete="new-password"
                />
                {errors.signupPassword && (
                  <small className="p-error">{errors.signupPassword}</small>
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
                  className={errors.signupConfirmPassword ? 'p-invalid' : ''}
                  feedback={false}
                  toggleMask
                  autoComplete="new-password"
                />
                {errors.signupConfirmPassword && (
                  <small className="p-error">{errors.signupConfirmPassword}</small>
                )}
              </div>

              <div className="form-checkbox">
                <Checkbox
                  inputId="acceptTerms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.checked || false)}
                  className={errors.acceptTerms ? 'p-invalid' : ''}
                />
                <label htmlFor="acceptTerms">
                  J'accepte les{' '}
                  <a href="/politique-confidentialite" target="_blank">
                    conditions d'utilisation
                  </a>
                </label>
              </div>
              {errors.acceptTerms && (
                <small className="p-error">{errors.acceptTerms}</small>
              )}

              <Button
                type="submit"
                label="Créer mon compte"
                className="submit-button"
                disabled={isLoading}
                loading={isLoading}
              />
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
