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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    useEffect(() => {
        // Обрабатываем redirect результат при возврате после signInWithRedirect
        getRedirectResult(auth).then((result) => {
            if (result) {
                const credential = GoogleAuthProvider.credentialFromResult(result);
                if (credential?.accessToken) {
                    setAccessToken(credential.accessToken);
                    localStorage.setItem('google_access_token', credential.accessToken);
                    console.log('✅ Успешный вход через redirect, токен сохранен');
                } else {
                    console.warn('⚠️ Redirect result получен, но OAuth токен отсутствует');
                    // Пытаемся получить токен через пользователя
                    if (result.user) {
                        // Для получения OAuth токена нужно использовать signInWithCredential
                        // Но это сложно, поэтому просто предупреждаем
                        console.warn('⚠️ Требуется повторный вход для получения OAuth токена');
                    }
                }
            }
        }).catch((error) => {
            console.error("Error getting redirect result", error);
        });

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            
            // Если пользователь авторизован, но токена нет - пытаемся получить его
            if (currentUser) {
                // Проверяем localStorage
                const savedToken = localStorage.getItem('google_access_token');
                if (savedToken && savedToken.length > 0) {
                    setAccessToken(savedToken);
                    console.log('✅ Токен восстановлен из localStorage');
                } else {
                    // Токена нет - нужно перелогиниться для получения OAuth токена
                    console.warn('⚠️ Пользователь авторизован, но OAuth токен отсутствует. Требуется повторный вход.');
                    // Не устанавливаем токен, чтобы пользователь понял, что нужно войти заново
                }
            } else {
                // Пользователь не авторизован - очищаем токен
                setAccessToken(null);
                localStorage.removeItem('google_access_token');
            }
            
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            // Проверяем, мобильное ли устройство
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isSmallScreen = window.innerWidth < 768;
            
            if (isMobile || isSmallScreen) {
                // На мобильных используем redirect вместо popup
                console.log('📱 Мобильное устройство обнаружено, используем redirect для входа');
                await signInWithRedirect(auth, googleProvider);
                // Redirect произойдет, функция вернет управление после redirect
                return;
            } else {
                // На десктопе используем popup
                const result = await signInWithPopup(auth, googleProvider);
                const credential = GoogleAuthProvider.credentialFromResult(result);
                if (credential?.accessToken) {
                    setAccessToken(credential.accessToken);
                    localStorage.setItem('google_access_token', credential.accessToken);
                }
            }
        } catch (error: any) {
            console.error("Error signing in with Google", error);
            // Если popup заблокирован, пробуем redirect
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                console.log('⚠️ Popup заблокирован, используем redirect');
                try {
                    await signInWithRedirect(auth, googleProvider);
                } catch (redirectError) {
                    console.error("Error with redirect", redirectError);
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

        try {
            console.log('🔄 Attempting to refresh access token...');
            // Попытка получить новый токен через повторный вход с popup
            // Но это требует взаимодействия пользователя, поэтому просто возвращаем null
            // и предлагаем пользователю войти заново
            console.warn('⚠️ Token refresh requires user interaction. Please sign in again.');
            return null;
        } catch (error) {
            console.error('❌ Error refreshing access token:', error);
            return null;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setAccessToken(null);
            localStorage.removeItem('google_access_token');
        } catch (error) {
            console.error("Error signing out", error);
            throw error;
        }
    };

    // Restore token from local storage on load if user is logged in
    useEffect(() => {
        const token = localStorage.getItem('google_access_token');
        if (token) setAccessToken(token);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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

