import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    accessToken: string | null;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to validate token format
// Google OAuth access tokens usually start with "ya29."
// Firebase ID tokens (JWTs) start with "ey"
const isValidGoogleAccessToken = (token: string | null): boolean => {
    if (!token) return false;
    // Reject JWTs (Firebase ID Tokens)
    if (token.startsWith('ey')) {
        console.warn('⚠️ Detected Firebase ID Token instead of Google Access Token. Rejecting.');
        return false;
    }
    // Accept tokens that look like OAuth tokens (usually start with ya29.)
    // We can be more permissive and just say "not JWT" to be safe, 
    // but checking for length > 20 is a basic sanity check.
    return token.length > 20;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    useEffect(() => {
        let isProcessingRedirect = false;

        // Таймаут для безопасности - если за 10 секунд не загрузилось, останавливаем loading
        const loadingTimeout = setTimeout(() => {
            console.warn('⚠️ Loading timeout reached, forcing loading=false');
            setLoading(false);
        }, 10000);

        // Обрабатываем redirect результат при возврате после signInWithRedirect
        const handleRedirectResult = async () => {
            if (isProcessingRedirect) return;
            isProcessingRedirect = true;

            try {
                console.log('🔄 Проверяем redirect результат...');
                console.log('📍 User agent:', navigator.userAgent);
                console.log('📍 Window size:', window.innerWidth, 'x', window.innerHeight);
                const result = await getRedirectResult(auth);

                if (result) {
                    console.log('✅ Redirect результат получен:', result.user.email);

                    // Очищаем флаг инициации
                    sessionStorage.removeItem('auth_redirect_initiated');

                    const credential = GoogleAuthProvider.credentialFromResult(result);

                    if (credential?.accessToken) {
                        console.log('✅ OAuth токен получен через redirect');
                        setAccessToken(credential.accessToken);
                        localStorage.setItem('google_access_token', credential.accessToken);
                        localStorage.setItem('google_access_token_time', Date.now().toString());
                        localStorage.setItem('auth_completed', 'true');
                    } else {
                        console.warn('⚠️ Redirect result получен, но OAuth токен отсутствует. Требуется повторный вход.');
                        // Не используем getIdToken как fallback
                        setAccessToken(null);
                    }
                } else {
                    console.log('ℹ️ Нет redirect результата (обычный вход)');
                }
            } catch (error) {
                console.error("❌ Error getting redirect result:", error);
                // Очищаем флаги при ошибке
                sessionStorage.removeItem('auth_redirect_initiated');
                localStorage.removeItem('auth_completed');
            } finally {
                isProcessingRedirect = false;
            }
        };

        handleRedirectResult();

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            console.log('👤 Auth state changed:', currentUser?.email || 'не авторизован');
            console.log('📍 Current time:', new Date().toISOString());
            setUser(currentUser);

            if (currentUser) {
                // Проверяем localStorage
                const savedToken = localStorage.getItem('google_access_token');
                const tokenTime = localStorage.getItem('google_access_token_time');

                console.log('📍 Saved token exists:', !!savedToken);
                console.log('📍 Token time:', tokenTime);

                // Токен действителен 1 час
                const isTokenValid = savedToken && tokenTime &&
                    (Date.now() - parseInt(tokenTime)) < 3600000 &&
                    isValidGoogleAccessToken(savedToken);

                if (savedToken && isTokenValid) {
                    console.log('✅ Токен восстановлен из localStorage');
                    setAccessToken(savedToken);
                } else if (savedToken && !isTokenValid) {
                    console.warn('⚠️ Токен истек или имеет неверный формат. Требуется повторный вход.');
                    // Не используем getIdToken, так как это не OAuth токен
                    setAccessToken(null);
                    localStorage.removeItem('google_access_token');
                    localStorage.removeItem('google_access_token_time');
                } else {
                    console.log('ℹ️ OAuth токен отсутствует. Требуется вход.');
                    setAccessToken(null);
                }
            } else {
                // Пользователь не авторизован - очищаем токен
                console.log('📍 User not authenticated, clearing tokens');
                setAccessToken(null);
                localStorage.removeItem('google_access_token');
                localStorage.removeItem('google_access_token_time');
            }

            console.log('📍 Setting loading to false');
            clearTimeout(loadingTimeout);
            setLoading(false);
        });

        return () => {
            clearTimeout(loadingTimeout);
            unsubscribe();
        };
    }, []);

    const signInWithGoogle = async () => {
        try {
            // Проверяем, не идет ли уже процесс аутентификации
            const redirectInitiated = sessionStorage.getItem('auth_redirect_initiated');

            if (redirectInitiated === 'true') {
                console.log('⚠️ Вход уже инициирован, ожидаем завершения...');
                return;
            }

            // Проверяем, мобильное ли устройство
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isSmallScreen = window.innerWidth < 768;

            if (isMobile || isSmallScreen) {
                // На мобильных используем redirect вместо popup
                console.log('📱 Мобильное устройство обнаружено, используем redirect для входа');

                // Сохраняем флаг, что мы инициировали вход
                sessionStorage.setItem('auth_redirect_initiated', 'true');

                await signInWithRedirect(auth, googleProvider);
                // Redirect произойдет, функция вернет управление после redirect
                return;
            } else {
                // На десктопе используем popup
                console.log('💻 Десктоп обнаружен, используем popup для входа');
                const result = await signInWithPopup(auth, googleProvider);
                const credential = GoogleAuthProvider.credentialFromResult(result);

                if (credential?.accessToken) {
                    setAccessToken(credential.accessToken);
                    localStorage.setItem('google_access_token', credential.accessToken);
                    localStorage.setItem('google_access_token_time', Date.now().toString());
                    localStorage.setItem('auth_completed', 'true');
                    console.log('✅ Вход через popup успешен');
                }
            }
        } catch (error: any) {
            console.error("❌ Error signing in with Google:", error);

            // Если popup заблокирован, пробуем redirect
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                console.log('⚠️ Popup заблокирован, используем redirect');
                try {
                    sessionStorage.setItem('auth_redirect_initiated', 'true');
                    await signInWithRedirect(auth, googleProvider);
                } catch (redirectError) {
                    console.error("❌ Error with redirect:", redirectError);
                    throw redirectError;
                }
            } else {
                throw error;
            }
        }
    };

    const refreshAccessToken = async (): Promise<string | null> => {
        if (!user) {
            console.warn('⚠️ Cannot refresh token: user not logged in');
            return null;
        }

        // Мы не можем тихо обновить OAuth токен без refresh token (который не доступен на клиенте в Firebase Auth для Google API)
        // Поэтому просто возвращаем null, чтобы вызвать re-login
        console.warn('⚠️ Refreshing OAuth token requires re-authentication');
        return null;
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setAccessToken(null);
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_access_token_time');
            localStorage.removeItem('auth_completed');
            sessionStorage.removeItem('auth_redirect_initiated');
            console.log('✅ Выход выполнен');
        } catch (error) {
            console.error("❌ Error signing out:", error);
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center flex-col gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <p className="text-white text-sm">Загрузка...</p>
                <p className="text-slate-400 text-xs mt-2">Проверка аутентификации</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, accessToken, signInWithGoogle, logout, refreshAccessToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

