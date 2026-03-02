import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { logger } from '../utils/logger';

const logDev = (message: string, ...data: unknown[]) => logger.debug('Auth', message, ...data);
const warnDev = (message: string, ...data: unknown[]) => logger.warn('Auth', message, ...data);
const errorDev = (message: string, ...data: unknown[]) => logger.error('Auth', message, ...data);

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isProcessingRedirect = false;
        
        // Таймаут для безопасности - если за 10 секунд не загрузилось, останавливаем loading
        const loadingTimeout = setTimeout(() => {
            warnDev('⚠️ Loading timeout reached, forcing loading=false');
            setLoading(false);
        }, 10000);

        // Обрабатываем redirect результат при возврате после signInWithRedirect
        const handleRedirectResult = async () => {
            if (isProcessingRedirect) return;
            isProcessingRedirect = true;

            try {
                logDev('🔄 Проверяем redirect результат...');
                const result = await getRedirectResult(auth);
                
                if (result) {
                    logDev('✅ Redirect результат получен:', result.user.email);
                    sessionStorage.removeItem('auth_redirect_initiated');
                    localStorage.setItem('auth_completed', 'true');
                } else {
                    logDev('ℹ️ Нет redirect результата (обычный вход)');
                }
            } catch (error) {
                errorDev("❌ Error getting redirect result:", error);
                sessionStorage.removeItem('auth_redirect_initiated');
                localStorage.removeItem('auth_completed');
            } finally {
                isProcessingRedirect = false;
            }
        };

        handleRedirectResult();

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            logDev('👤 Auth state changed:', currentUser?.email || 'не авторизован');
            setUser(currentUser);
            
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
                logDev('⚠️ Вход уже инициирован, ожидаем завершения...');
                return;
            }
            
            // Проверяем, мобильное ли устройство
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isSmallScreen = window.innerWidth < 768;
            
            if (isMobile || isSmallScreen) {
                logDev('📱 Мобильное устройство обнаружено, используем redirect для входа');
                sessionStorage.setItem('auth_redirect_initiated', 'true');
                await signInWithRedirect(auth, googleProvider);
                return;
            } else {
                logDev('💻 Десктоп обнаружен, используем popup для входа');
                await signInWithPopup(auth, googleProvider);
                localStorage.setItem('auth_completed', 'true');
                logDev('✅ Вход через popup успешен');
            }
        } catch (error: unknown) {
            errorDev("❌ Error signing in with Google:", error);
            
            // Если popup заблокирован, пробуем redirect
            const errorCode = (error as { code?: string })?.code;
            if (errorCode === 'auth/popup-blocked' || errorCode === 'auth/popup-closed-by-user') {
                logDev('⚠️ Popup заблокирован, используем redirect');
                try {
                    sessionStorage.setItem('auth_redirect_initiated', 'true');
                    await signInWithRedirect(auth, googleProvider);
                } catch (redirectError) {
                    errorDev("❌ Error with redirect:", redirectError);
                    throw redirectError;
                }
            } else {
                throw error;
            }
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('auth_completed');
            sessionStorage.removeItem('auth_redirect_initiated');
            logDev('✅ Выход выполнен');
        } catch (error) {
            errorDev("❌ Error signing out:", error);
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
        <AuthContext.Provider value={{ 
            user, 
            loading, 
            signInWithGoogle, 
            logout
        }}>
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

