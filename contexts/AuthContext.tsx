import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const isDev = import.meta.env.DEV;
const logDev = (...args: unknown[]) => { if (isDev) console.log(...args); };
const warnDev = (...args: unknown[]) => { if (isDev) console.warn(...args); };
const errorDev = (...args: unknown[]) => { if (isDev) console.error(...args); };

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
                logDev('📍 User agent:', navigator.userAgent);
                logDev('📍 Window size:', window.innerWidth, 'x', window.innerHeight);
                const result = await getRedirectResult(auth);
                
                if (result) {
                    logDev('✅ Redirect результат получен:', result.user.email);
                    
                    // Очищаем флаг инициации
                    sessionStorage.removeItem('auth_redirect_initiated');
                    
                    const credential = GoogleAuthProvider.credentialFromResult(result);
                    
                    if (credential?.accessToken) {
                        logDev('✅ OAuth access token получен через redirect');
                        setAccessToken(credential.accessToken);
                        localStorage.setItem('google_access_token', credential.accessToken);
                        localStorage.setItem('google_access_token_time', Date.now().toString());
                        localStorage.setItem('auth_completed', 'true');
                    } else {
                        errorDev('❌ OAuth access token не получен!');
                        errorDev('⚠️ Это означает, что Google не предоставил доступ к Sheets API.');
                        errorDev('📝 Проверьте настройки OAuth consent screen в Google Cloud Console.');
                        errorDev('📝 Убедитесь, что добавлен scope: https://www.googleapis.com/auth/spreadsheets');
                        
                        // Не используем ID token как fallback - он не работает с Sheets API!
                        // Показываем пользователю, что нужны дополнительные разрешения
                        alert('❌ Не удалось получить доступ к Google Sheets.\n\n' +
                              'Пожалуйста, убедитесь что:\n' +
                              '1. В Google Cloud Console настроен OAuth consent screen\n' +
                              '2. Добавлен scope для Google Sheets API\n' +
                              '3. Приложение не в режиме "Testing" или вы добавлены как тестовый пользователь');
                    }
                } else {
                    logDev('ℹ️ Нет redirect результата (обычный вход)');
                }
            } catch (error) {
                errorDev("❌ Error getting redirect result:", error);
                // Очищаем флаги при ошибке
                sessionStorage.removeItem('auth_redirect_initiated');
                localStorage.removeItem('auth_completed');
            } finally {
                isProcessingRedirect = false;
            }
        };

        handleRedirectResult();

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            logDev('👤 Auth state changed:', currentUser?.email || 'не авторизован');
            logDev('📍 Current time:', new Date().toISOString());
            setUser(currentUser);
            
            if (currentUser) {
                // Проверяем localStorage
                const savedToken = localStorage.getItem('google_access_token');
                const tokenTime = localStorage.getItem('google_access_token_time');
                
                logDev('📍 Saved token exists:', !!savedToken);
                logDev('📍 Token time:', tokenTime);
                
                // Токен действителен 1 час
                const isTokenValid = savedToken && tokenTime && 
                    (Date.now() - parseInt(tokenTime)) < 3600000;

                if (savedToken && isTokenValid) {
                    logDev('✅ OAuth access token восстановлен из localStorage');
                    setAccessToken(savedToken);
                } else {
                    // OAuth access token можно получить только при логине через Google
                    // getIdToken() возвращает Firebase ID token, который НЕ работает с Google Sheets API
                    warnDev('⚠️ OAuth access token отсутствует или истек');
                    warnDev('⚠️ Требуется повторный вход через Google для получения нового access token');
                    setAccessToken(null);
                    localStorage.removeItem('google_access_token');
                    localStorage.removeItem('google_access_token_time');
                }
            } else {
                // Пользователь не авторизован - очищаем токен
                logDev('📍 User not authenticated, clearing tokens');
                setAccessToken(null);
                localStorage.removeItem('google_access_token');
                localStorage.removeItem('google_access_token_time');
            }
            
            logDev('📍 Setting loading to false');
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
                // На мобильных используем redirect вместо popup
                logDev('📱 Мобильное устройство обнаружено, используем redirect для входа');
                
                // Сохраняем флаг, что мы инициировали вход
                sessionStorage.setItem('auth_redirect_initiated', 'true');
                
                await signInWithRedirect(auth, googleProvider);
                // Redirect произойдет, функция вернет управление после redirect
                return;
            } else {
                // На десктопе используем popup
                logDev('💻 Десктоп обнаружен, используем popup для входа');
                const result = await signInWithPopup(auth, googleProvider);
                const credential = GoogleAuthProvider.credentialFromResult(result);
                
                if (credential?.accessToken) {
                    setAccessToken(credential.accessToken);
                    localStorage.setItem('google_access_token', credential.accessToken);
                    localStorage.setItem('google_access_token_time', Date.now().toString());
                    localStorage.setItem('auth_completed', 'true');
                    logDev('✅ Вход через popup успешен');
                    logDev('✅ OAuth access token получен (начинается с:', credential.accessToken.substring(0, 5) + ')');
                } else {
                    errorDev('❌ OAuth access token не получен через popup!');
                    errorDev('📝 См. инструкцию: БЫСТРОЕ-РЕШЕНИЕ-OAuth.md');
                    alert('❌ Не удалось получить доступ к Google Sheets.\n\n' +
                          'См. файл: БЫСТРОЕ-РЕШЕНИЕ-OAuth.md\n' +
                          'Или проверьте настройки в Google Cloud Console.');
                }
            }
        } catch (error: unknown) {
            errorDev("❌ Error signing in with Google:", error);
            
            // Если popup заблокирован, пробуем redirect
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
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

    const refreshAccessToken = async (): Promise<string | null> => {
        // ВАЖНО: OAuth access token нельзя обновить через Firebase
        // Пользователь должен заново войти через Google для получения нового токена
        errorDev('❌ OAuth access token нельзя обновить автоматически');
        errorDev('⚠️ Пользователь должен выйти и войти заново для получения нового access token');
        
        // Очищаем недействительный токен
        setAccessToken(null);
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_access_token_time');
        
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

