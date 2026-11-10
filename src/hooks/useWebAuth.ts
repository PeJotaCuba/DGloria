import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const WEB_SESSION_TOKEN_KEY = 'dg_web_session_token';

export interface WebAuthUser {
  id: string;
  username: string;
  fullName?: string;
  name?: string;
  role: string;
  active?: boolean;
}

export function useWebAuth(dvcCode: string | null, dvcStatus: string) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(WEB_SESSION_TOKEN_KEY)
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const webLoginMutation = useMutation(api.auth.webLogin);
  const logoutMutation = useMutation(api.auth.logout);

  const isDvcActive = dvcStatus === 'ACTIVE' && Boolean(dvcCode);

  // Validar sesión existente con auth:validateSession y auth:validateWebSession
  const baseSessionValidation = useQuery(
    api.auth.validateSession,
    token ? { token } : 'skip'
  );

  const webSessionValidation = useQuery(
    api.auth.validateWebSession,
    token && dvcCode ? { token, dvcCode } : 'skip'
  );

  // Si la sesión fue revocada o el DVC dejó de estar ACTIVE, limpiar token local
  useEffect(() => {
    if (!token) return;

    if (baseSessionValidation && !baseSessionValidation.isValid) {
      localStorage.removeItem(WEB_SESSION_TOKEN_KEY);
      setToken(null);
      return;
    }

    if (webSessionValidation && !webSessionValidation.isValid) {
      localStorage.removeItem(WEB_SESSION_TOKEN_KEY);
      setToken(null);
    }
  }, [token, baseSessionValidation, webSessionValidation]);

  const login = useCallback(
    async (username: string, password: string) => {
      if (!dvcCode || dvcStatus !== 'ACTIVE') {
        throw new Error('Este navegador no está autorizado (DVC no ACTIVE).');
      }

      setIsLoggingIn(true);
      setAuthError(null);

      try {
        const result = await webLoginMutation({
          username: username.trim(),
          password: password.trim(),
          dvcCode,
        });

        if (result?.success && result?.token) {
          localStorage.setItem(WEB_SESSION_TOKEN_KEY, result.token);
          setToken(result.token);
          return result;
        }
        throw new Error('No se pudo iniciar sesión.');
      } catch (err: any) {
        const msg =
          err?.message?.replace(/^Uncaught Error:\s*/i, '').trim() ||
          'Error al autenticar.';
        setAuthError(msg);
        throw new Error(msg);
      } finally {
        setIsLoggingIn(false);
      }
    },
    [dvcCode, dvcStatus, webLoginMutation]
  );

  const logout = useCallback(async () => {
    const currentToken = token || localStorage.getItem(WEB_SESSION_TOKEN_KEY);
    localStorage.removeItem(WEB_SESSION_TOKEN_KEY);
    setToken(null);
    setAuthError(null);

    if (currentToken) {
      try {
        await logoutMutation({ token: currentToken });
      } catch (err) {
        console.warn('[WebAuth] Error al cerrar sesión en Convex:', err);
      }
    }
  }, [token, logoutMutation]);

  const isCheckingSession =
    Boolean(token) &&
    (baseSessionValidation === undefined || webSessionValidation === undefined);

  const isAuthenticated =
    Boolean(token) &&
    isDvcActive &&
    Boolean(baseSessionValidation?.isValid) &&
    Boolean(webSessionValidation?.isValid);

  const user: WebAuthUser | null = isAuthenticated
    ? ((webSessionValidation?.user || baseSessionValidation?.user) as WebAuthUser)
    : null;

  return {
    token,
    user,
    isAuthenticated,
    isCheckingSession,
    isLoggingIn,
    authError,
    setAuthError,
    login,
    logout,
  };
}
